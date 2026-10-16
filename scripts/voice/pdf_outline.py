"""Prints a PDF's chapters as JSON: [{"title", "text"}], using its outline when present."""

import json
import sys

from pypdf import PdfReader

reader = PdfReader(sys.argv[1])
pages = len(reader.pages)


def page_text(start: int, end: int, limit: int = 2500) -> str:
    text = ""
    for i in range(start, min(end, pages)):
        text += (reader.pages[i].extract_text() or "") + "\n"
        if len(text) > limit:
            break
    return " ".join(text.split())[:limit]


chapters = []
try:
    top = [item for item in reader.outline if not isinstance(item, list)]
    starts = [(item.title, reader.get_destination_page_number(item)) for item in top]
except Exception:
    starts = []
starts = [(t, p) for t, p in starts if t and p is not None]
if len(starts) >= 2:
    for i, (title, page) in enumerate(starts):
        end = starts[i + 1][1] if i + 1 < len(starts) else pages
        chapters.append({"title": title.strip()[:120], "text": page_text(page, max(end, page + 1))})
else:
    # No outline: treat every 15 pages as a section.
    for start in range(0, pages, 15):
        chapters.append({"title": f"Pages {start + 1}-{min(start + 15, pages)}", "text": page_text(start, start + 15)})
title = (reader.metadata.title if reader.metadata and reader.metadata.title else "") or ""
json.dump({"title": title.strip()[:120], "chapters": chapters}, sys.stdout)
