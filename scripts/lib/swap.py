"""Exact-token replacement that does not care how JSX is indented.

The obvious version — `"\s+".join(re.escape(w) for w in old.split())` — is
flexible only where the AUTHOR typed a space. Prettier breaks JSX between
tokens that have no space at all (`className="…"` then a newline then `>`), so
that pattern misses and a long migration run aborts half-applied.

This strips every whitespace character from both needle and haystack, finds the
match in that stripped space, then maps the offsets back to the real source.
"""
import pathlib
import re

_WS = re.compile(r"\s")


def _strip(text):
    """Whitespace-free text, plus stripped-index → original-index."""
    out, index = [], []
    for i, ch in enumerate(text):
        if not _WS.match(ch):
            out.append(ch)
            index.append(i)
    return "".join(out), index


def find_all(source, old):
    """Every (start, end) span in `source` matching `old`, ignoring whitespace."""
    flat, index = _strip(source)
    needle, _ = _strip(old)
    if not needle:
        raise ValueError("empty needle")
    spans, at = [], flat.find(needle)
    while at != -1:
        spans.append((index[at], index[at + len(needle) - 1] + 1))
        at = flat.find(needle, at + 1)
    return spans


def swap(path, old, new, count=1, expect=None):
    """Replace `count` occurrences of `old` with `new`. Asserts before writing."""
    source = pathlib.Path(path).read_text()
    spans = find_all(source, old)
    if expect is not None:
        assert len(spans) == expect, f"{path}: {len(spans)} hit(s), expected {expect}"
    assert len(spans) >= count, f"{path}: {len(spans)} hit(s) for {old.split()[0]!r} … {old.split()[-1]!r}"
    for start, end in reversed(spans[:count]):
        source = source[:start] + new + source[end:]
    pathlib.Path(path).write_text(source)
    return len(spans)
