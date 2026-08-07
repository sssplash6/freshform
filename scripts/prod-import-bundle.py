#!/usr/bin/env python3
"""
Writes sheet-import/PROD-IMPORT.txt: the step-by-step for importing the Master's
sheet into production, with the parsed workbook inlined as one gzipped paste.

    python3 scripts/parse-masters-sheet.py ~/Downloads/"Master's Hours.xlsx"
    python3 scripts/prod-import-bundle.py

Run both again whenever the workbook changes — the file records what it was built
from, including how many students had an email in the Student List tab, so a
bundle made from a half-filled sheet can't be mistaken for a complete one.

Nothing here is committed: sheet-import/ holds real student data and is ignored.
"""

import base64
import gzip
import json
import pathlib
import sys
import textwrap

SHEET = pathlib.Path("sheet-import/masters-hours.json")
MAP = pathlib.Path("sheet-import/mentor-map.prod.json")
OUT = pathlib.Path("sheet-import/PROD-IMPORT.txt")

if not SHEET.exists():
    sys.exit(
        f"No {SHEET}. Parse the workbook first:\n"
        '  python3 scripts/parse-masters-sheet.py ~/Downloads/"Master\'s Hours.xlsx"'
    )

raw = SHEET.read_bytes()
parsed = json.loads(raw)
blob = "\n".join(textwrap.wrap(base64.b64encode(gzip.compress(raw, 9)).decode(), 200))

students = parsed["students"]
roster = parsed.get("roster", [])
with_email = [r for r in roster if (r.get("email") or "").strip()]
no_email = [
    (
        next(
            (
                r["fullName"]
                for r in roster
                if r["fullName"].lower().split(" ")[0] == s["tab"].strip().lower()
                and (r.get("email") or "").strip()
            ),
            None,
        )
        or s["tab"].strip()
    )
    for s in students
]
missing = [
    name
    for name, s in zip(no_email, students)
    if name == s["tab"].strip()
]
n_sessions = sum(len(s["sessions"]) for s in students)
n_tasks = sum(len(s["tasks"]) for s in students)

fallback_map = (
    MAP.read_text().strip()
    if MAP.exists()
    else json.dumps(
        {"Example": {"email": "someone@freshman.academy", "name": "Someone", "create": True}},
        indent=2,
    )
)

emails_line = (
    f"{len(with_email)} of {len(students)} students have an email in the sheet."
    + (
        f" Still without one, so they'd land on a placeholder they can't sign in with: {', '.join(missing)}."
        if missing
        else " Everyone has one."
    )
)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(f"""IMPORTING THE MASTER'S SHEET INTO PRODUCTION  (www.freshlog.net)
================================================================
Built {parsed['parsedOn']} from {parsed['source']}.
Brings in {len(students)} students, {n_tasks} tasks, {n_sessions} logged sessions.
{emails_line}

Hours are NOT imported — they're granted in the app afterwards, and step 8 says
with what. Run everything in the Render web-service Shell, from the app root.
Nothing is written to the database until step 7.

If the workbook has changed since the date above, rebuild this file first:
  python3 scripts/parse-masters-sheet.py ~/Downloads/"Master's Hours.xlsx"
  python3 scripts/prod-import-bundle.py

1. BACK THE DATABASE UP. Step 3 merges two session columns into one and renames a
   task column; your data survives, but a copy costs nothing:

     cp /data/app.db /data/app.db.backup-$(date +%F)
     ls -l /data/

2. Check the live deploy carries the importer — commit 739d483 or later. Hit
   "Manual Deploy" in the Render dashboard if the live commit is older.

3. Apply the migrations it brought with it:

     npm run db:migrate:deploy

   If tsx is missing (the build prunes devDependencies), first:

     npm i --no-save tsx

4. Put the parsed sheet on the box — one paste, the workbook gzipped:

     mkdir -p sheet-import
     base64 -d <<'B64' | gunzip > sheet-import/masters-hours.json
{blob}
B64

   Check it landed:  wc -c sheet-import/masters-hours.json    (expect ~{len(raw) // 1000}KB)

5. Dry run. The first run writes a DRAFT consultant map from the mentor accounts
   that already exist in production, prints it, and stops:

     npm run import:masters

   READ THAT MAP. Every line says which account a sheet name resolves to and
   whether it would be created. Fix any line that's wrong:

     cat > sheet-import/mentor-map.json <<'JSON'
{fallback_map}
JSON

   ("create": true makes a new mentor account; drop it to point at an existing
   one. A wrong address is fixable later on the Mentors page.)

6. Dry run again and read the whole report: every task and session it would add,
   whether each student's task budget reconciles with the sheet's own Completed
   column, and what to allocate.

     npm run import:masters

7. Import for real:

     IMPORT_CONFIRM=WRITE npm run import:masters

   Safe to re-run. Anything already imported is left alone, and a student whose
   email was blank the first time gets their placeholder replaced on the next run
   once the sheet has it.

8. THEN, IN THE APP (Master's Program -> Students -> open a student):
   - "Assign a task" grants the hours. The report printed, per student and
     consultant, hours budgeted, hours already logged, and the latest date from
     their Deadline column — use those.
   - Any student still on an @import.invalid address can't sign in. Fill the
     sheet's Emails column and re-run, or set it under Corrections.
   - Sangina has a task imported as "Untitled task — name this" (the sheet
     budgeted 8h to Sharof without naming the work). Rename it.
   - Samir has a 1h session with Tyler with NO DATE in the sheet, so it wasn't
     imported. Fill the date and re-run, or log it in the app.
   - Sessions that came in without a task can be attached with the pen on any log
     row.

9. Clean up — this file and the parsed sheet hold real student data:

     rm -rf sheet-import
""")

print(f"{OUT} — {len(OUT.read_text())} bytes, paste blob {len(blob)} chars")
print(f"  {len(students)} students · {n_tasks} tasks · {n_sessions} sessions")
print(f"  {emails_line}")
