#!/usr/bin/env python3
"""
Reads the "Master's Hours" workbook (one tab per student) and writes the flat
JSON that prisma/import-masters.ts imports. Stdlib only — an .xlsx is a zip of
XML, so no dependency is worth adding for a one-off migration.

    python3 scripts/parse-masters-sheet.py ~/Downloads/"Master's Hours.xlsx"
    # → sheet-import/masters-hours.json  (git-ignored: real student data)

The two halves of each tab are found by their header text, not by column letter,
so inserting a column doesn't silently shift the import:

  <consultant> | Duration | Date | Notes        the meetings log (left half)
  Purpose | Consultant | Hour Limit | Timeline | Progress    the plan (right half)
  Hours | Completed | Remain                   the tab's own totals

The left half's consultant column carries no header in the sheet, so it is read
as the column immediately left of "Duration".

Nothing here decides anything: dates are resolved and rows are labelled, but
every judgement (who a first name is, what hours to allocate) belongs to the
importer, which reports before it writes.
"""

import json
import re
import sys
import zipfile
from datetime import date, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}

# Excel's day 1 is 1900-01-02 in the wild because of the 1900 leap-year bug, so
# serials count from 1899-12-30.
EXCEL_EPOCH = date(1899, 12, 30)
MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


def parse_xml(data: bytes) -> ET.Element:
    """
    Parse one part of the workbook. XXE and entity-expansion attacks both need a
    document type declaration, and a spreadsheet has no business carrying one, so
    refusing it outright keeps us on the stdlib parser without the exposure.
    """
    if re.search(rb"<!DOCTYPE|<!ENTITY", data[:4096], re.IGNORECASE):
        raise ValueError("refusing to parse XML with a DTD — not a plain spreadsheet part")
    return ET.fromstring(data)


def col_of(ref: str) -> str:
    """"AB12" → "AB"."""
    return re.match(r"[A-Z]+", ref).group(0)


def col_index(letters: str) -> int:
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        root = parse_xml(zf.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    out = []
    for si in root.findall("m:si", NS):
        # A string is either one <t> or a run of them (mixed formatting).
        out.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
    return out


def sheet_paths(zf: zipfile.ZipFile) -> list[tuple[str, str]]:
    """[(tab name, zip path)] in the workbook's own tab order."""
    rels = {}
    root = parse_xml(zf.read("xl/_rels/workbook.xml.rels"))
    for rel in root:
        target = rel.get("Target")
        rels[rel.get("Id")] = target if target.startswith("xl/") else f"xl/{target.lstrip('/')}"
    out = []
    wb = parse_xml(zf.read("xl/workbook.xml"))
    for sheet in wb.find("m:sheets", NS):
        rid = sheet.get(f"{{{NS['r']}}}id")
        out.append((sheet.get("name"), rels[rid]))
    return out


def read_grid(zf: zipfile.ZipFile, path: str, strings: list[str]) -> list[dict[str, object]]:
    """One dict per row: {column letter: value}, values str or float."""
    root = parse_xml(zf.read(path))
    rows = []
    for row in root.iter(f"{{{NS['m']}}}row"):
        cells: dict[str, object] = {}
        for c in row.findall("m:c", NS):
            ref, ctype = c.get("r"), c.get("t")
            if ctype == "inlineStr":
                node = c.find("m:is", NS)
                text = "".join(t.text or "" for t in node.iter(f"{{{NS['m']}}}t")) if node is not None else ""
                value: object = text.strip()
            else:
                v = c.find("m:v", NS)
                if v is None or v.text is None:
                    continue
                if ctype == "s":
                    value = strings[int(v.text)].strip()
                elif ctype == "str":
                    value = v.text.strip()
                elif ctype == "b":
                    value = "TRUE" if v.text == "1" else "FALSE"
                else:
                    try:
                        value = float(v.text)
                    except ValueError:
                        value = v.text.strip()
            if value != "":
                cells[col_of(ref)] = value
        if cells:
            rows.append({"_row": int(row.get("r")), **cells})
    return rows


def as_text(v: object) -> str | None:
    if v is None:
        return None
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else str(v)
    text = str(v).strip()
    return text or None


def as_number(v: object) -> float | None:
    if isinstance(v, float):
        return v
    if v is None:
        return None
    text = str(v).strip().replace(",", ".")
    m = re.search(r"-?\d+(\.\d+)?", text)
    return float(m.group(0)) if m else None


def as_date(v: object, today: date) -> str | None:
    """A cell in a Date column → ISO date. Handles serials and "Jul 26"/"26 July"."""
    if isinstance(v, float):
        # A date column's numbers are serials; anything else is out of range.
        if 20000 <= v <= 80000:
            return (EXCEL_EPOCH + timedelta(days=int(v))).isoformat()
        return None
    text = str(v).strip()
    if not text:
        return None
    iso = re.match(r"(\d{4})-(\d{2})-(\d{2})", text)
    if iso:
        return iso.group(0)
    # "Jun 7", "July 26", "7 Jun", "Jun 7 2025"
    month = next((n for name, n in MONTHS.items() if name in text.lower()), None)
    day = re.search(r"\b(\d{1,2})\b", text)
    if not month or not day:
        return None
    year = re.search(r"\b(20\d{2})\b", text)
    if year:
        y = int(year.group(1))
    else:
        # No year in the sheet: this cycle, unless that lands in the future, in
        # which case the row belongs to last year's cycle.
        y = today.year
        if date(y, month, min(int(day.group(1)), 28)) > today + timedelta(days=60):
            y -= 1
    try:
        return date(y, month, int(day.group(1))).isoformat()
    except ValueError:
        return None


def display_date(iso: str, today: date) -> str:
    """ISO → the way the team says it out loud, matching src/lib/format.ts."""
    d = date.fromisoformat(iso)
    short = f"{list(MONTHS)[d.month - 1].capitalize()} {d.day}"
    return short if d.year == today.year else f"{short}, {d.year}"


def header_map(rows: list[dict[str, object]]) -> tuple[dict[str, str], int]:
    """{lowercased header: column letter} from the first row that has them, plus its row number."""
    for row in rows[:5]:
        found = {}
        for col, value in row.items():
            if col == "_row" or not isinstance(value, str):
                continue
            found[value.strip().lower()] = col
        if "duration" in found or "purpose" in found:
            return found, int(row["_row"])  # type: ignore[arg-type]
    return {}, 0


def parse_tab(name: str, rows: list[dict[str, object]], today: date) -> dict[str, object]:
    headers, header_row = header_map(rows)
    warnings: list[str] = []
    if not headers:
        return {"tab": name, "skipped": "no Duration/Purpose header found",
                "sessions": [], "tasks": [], "totals": {}, "warnings": []}

    dur_col = headers.get("duration")
    date_col = headers.get("date")
    notes_col = headers.get("notes")
    # The log's consultant column is the unlabelled one just left of Duration.
    log_mentor_col = None
    if dur_col:
        idx = col_index(dur_col) - 1
        if idx >= 0:
            log_mentor_col = chr(65 + idx) if idx < 26 else None

    purpose_col = headers.get("purpose")
    plan_mentor_col = headers.get("consultant")
    limit_col = headers.get("hour limit")
    timeline_col = headers.get("timeline")
    progress_col = headers.get("progress")

    sessions, tasks = [], []
    for row in rows:
        if int(row["_row"]) <= header_row:  # type: ignore[arg-type]
            continue

        mentor = as_text(row.get(log_mentor_col)) if log_mentor_col else None
        hours = as_number(row.get(dur_col)) if dur_col else None
        if mentor and hours:
            raw_date = as_text(row.get(date_col)) if date_col else None
            iso = as_date(row.get(date_col), today) if date_col else None
            if date_col and row.get(date_col) is not None and not iso:
                warnings.append(f"row {row['_row']}: could not read the date {raw_date!r}")
            sessions.append({
                "row": row["_row"],
                "consultant": mentor,
                "hours": hours,
                "date": iso,
                "rawDate": raw_date,
                "note": as_text(row.get(notes_col)) if notes_col else None,
            })
        elif mentor and not hours:
            warnings.append(f"row {row['_row']}: {mentor} has no duration — session skipped")

        purpose = as_text(row.get(purpose_col)) if purpose_col else None
        limit = as_number(row.get(limit_col)) if limit_col else None
        plan_mentor = as_text(row.get(plan_mentor_col)) if plan_mentor_col else None
        # A plan row is one with a consultant and something planned. Purpose can be
        # blank — one tab budgets 8 hours to a consultant without naming the work,
        # and dropping that row would lose the hours it accounts for.
        if purpose or (plan_mentor and limit is not None):
            if not plan_mentor:
                warnings.append(f"row {row['_row']}: task {purpose!r} names no consultant — skipped")
            else:
                if not purpose:
                    warnings.append(
                        f"row {row['_row']}: {plan_mentor} has {limit}h planned with no purpose written "
                        f"— imported as an untitled task to name in the app"
                    )
                raw_timeline = row.get(timeline_col) if timeline_col else None
                timeline_iso = as_date(raw_timeline, today) if raw_timeline is not None else None
                tasks.append({
                    "row": row["_row"],
                    "purpose": purpose,
                    "consultant": plan_mentor,
                    "hourLimit": limit,
                    # A real date renders like the app does; anything the team typed
                    # by hand ("Mar-May") is kept verbatim.
                    "timeline": display_date(timeline_iso, today) if timeline_iso
                                else as_text(raw_timeline),
                    "timelineDate": timeline_iso,
                    "progress": as_text(row.get(progress_col)) if progress_col else None,
                })

    totals_row = next((r for r in rows if int(r["_row"]) == header_row + 1), {})  # type: ignore[arg-type]
    totals = {
        key: as_number(totals_row.get(headers[key]))
        for key in ("hours", "completed", "remain")
        if key in headers
    }

    return {"tab": name, "sessions": sessions, "tasks": tasks,
            "totals": totals, "warnings": warnings}


def parse_roster(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    """The Student List tab: full names, plus the email/telegram columns if filled."""
    headers, header_row = {}, 0
    for row in rows[:5]:
        found = {str(v).strip().lower(): k for k, v in row.items()
                 if k != "_row" and isinstance(v, str)}
        if "full name" in found:
            headers, header_row = found, int(row["_row"])  # type: ignore[arg-type]
            break
    if not headers:
        return []
    name_col = headers["full name"]
    email_col = headers.get("emails") or headers.get("email")
    tg_col = headers.get("telegram")
    out = []
    for row in rows:
        if int(row["_row"]) <= header_row:  # type: ignore[arg-type]
            continue
        full = as_text(row.get(name_col))
        if not full:
            continue
        out.append({
            "fullName": full,
            "email": as_text(row.get(email_col)) if email_col else None,
            "telegram": as_text(row.get(tg_col)) if tg_col else None,
        })
    return out


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("usage: parse-masters-sheet.py <workbook.xlsx> [output.json]")
    src = Path(sys.argv[1]).expanduser()
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("sheet-import/masters-hours.json")
    today = date.today()

    with zipfile.ZipFile(src) as zf:
        strings = shared_strings(zf)
        students, roster, ignored = [], [], []
        for name, path in sheet_paths(zf):
            grid = read_grid(zf, path, strings)
            # Tab names carry stray trailing spaces in this workbook.
            tab = name.strip()
            parsed = parse_tab(tab, grid, today)
            if parsed.get("skipped"):
                ignored.append({"tab": tab, "why": parsed["skipped"]})
                if tab.lower() == "student list":
                    roster = parse_roster(grid)
                continue
            students.append(parsed)

    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {"source": src.name, "parsedOn": today.isoformat(),
               "students": students, "roster": roster, "ignoredTabs": ignored}
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False))

    print(f"{src.name} → {out}\n")
    consultants: dict[str, int] = {}
    for s in students:
        print(f"  {s['tab']:<14} {len(s['sessions']):>3} sessions  {len(s['tasks']):>2} tasks"
              f"   totals {s['totals'] or '—'}"
              + (f"   ⚠ {len(s['warnings'])}" if s["warnings"] else ""))
        for row in s["sessions"] + s["tasks"]:
            key = str(row["consultant"])
            consultants[key] = consultants.get(key, 0) + 1
    for t in ignored:
        print(f"  {t['tab']:<14} not a student tab — {t['why']}")
    if roster:
        print(f"\n  Student List: {len(roster)} names"
              + (f", {sum(1 for r in roster if r['email'])} with emails" if roster else ""))
        for r in roster:
            print(f"    {r['fullName']:<28} {r['email'] or '(no email)'}")
    print("\n  consultant names in the sheet:")
    for name, n in sorted(consultants.items(), key=lambda kv: -kv[1]):
        print(f"    {name:<16} {n} rows")
    warned = [(s["tab"], w) for s in students for w in s.get("warnings", [])]
    if warned:
        print(f"\n  {len(warned)} warnings:")
        for tab, w in warned[:40]:
            print(f"    {tab}: {w}")


if __name__ == "__main__":
    main()
