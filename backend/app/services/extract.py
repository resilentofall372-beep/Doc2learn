"""Text extraction for uploaded study material.

Returns the text plus a list of page offsets so later stages can cite pages.
Supported: PDF, DOCX, PPTX, TXT/MD, and images (OCR via Indra, a small CPU model).

Files without real pages (Word, Markdown, plain or pasted text) are split into *sections* at
their headings instead: each section is one "page" entry with a `title`, so a citation can say
"7.1 Plugin Manifest" rather than "p. 1" for the whole file.
"""
from __future__ import annotations

import logging
import re
import threading
from dataclasses import dataclass, field

log = logging.getLogger(__name__)


@dataclass
class Extracted:
    text: str
    # [{"page": 1, "start": 0, "end": 1234}] plus "title" for a section of a file without pages
    pages: list[dict] = field(default_factory=list)
    method: str = "text"
    warnings: list[str] = field(default_factory=list)

    @property
    def page_count(self) -> int:
        return len(self.pages) or (1 if self.text else 0)


class ExtractionError(Exception):
    pass


def _normalise(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _join_pages(page_texts: list) -> Extracted:
    """Join pages (str) or titled sections ((title, text)) into one text with offsets."""
    chunks, pages, cursor = [], [], 0
    for number, item in enumerate(page_texts, start=1):
        title, page_text = item if isinstance(item, tuple) else (None, item)
        page_text = _normalise(page_text)
        if not page_text:
            continue
        start = cursor
        chunks.append(page_text)
        cursor += len(page_text) + 2  # account for the separator added below
        page = {"page": len(pages) + 1 if title is not None else number, "start": start, "end": cursor - 2}
        if title is not None:
            page["title"] = title
        pages.append(page)
    return Extracted(text="\n\n".join(chunks), pages=pages)


# A line that reads like a numbered heading: "7.1 Plugin Manifest", "3. Entry points", "Section 4: Setup".
_NUMBERED_HEADING = re.compile(r"^(?:(?i:section|chapter|part)\s+)?(\d+(?:\.\d+){0,3})[.:)]?\s+[A-Z][^\n]{1,80}$")
_MD_HEADING = re.compile(r"^#{1,3}\s+(.+?)\s*#*$")
SECTION_TARGET = 2500  # characters per section when a file has no headings at all


def _heading_of(line: str) -> str | None:
    line = line.strip()
    md = _MD_HEADING.match(line)
    if md:
        return md.group(1).strip()
    numbered = _NUMBERED_HEADING.match(line)
    if numbered and not line.endswith((".", ",", ";", ":")):
        # "7.1 Plugin Manifest" is a heading; "3. Open the file and check the logs" is more likely a step.
        words = len(line.split())
        if words <= 12 and ("." in numbered.group(1) or words <= 6):
            return line
    return None


def split_sections(text: str, headings: list[str | None] | None = None) -> list[tuple[str, str]]:
    """Split text into (title, text) sections.

    `headings` (one entry per line, from Word heading styles) marks heading lines; without it,
    Markdown headings and numbered headings are used. With no headings at all, the text is cut
    into parts of about SECTION_TARGET characters at paragraph breaks, titled "Part N".
    """
    lines = text.split("\n")
    sections: list[list] = []
    for i, line in enumerate(lines):
        title = headings[i] if headings is not None else _heading_of(line)
        if title:
            sections.append([title[:80], [line]])
        elif sections:
            sections[-1][1].append(line)
        elif line.strip():
            sections.append([None, [line]])  # text before the first heading
    if not any(title for title, _ in sections):
        parts, current = [], []
        for para in re.split(r"\n{2,}", text):
            current.append(para)
            if sum(len(p) for p in current) >= SECTION_TARGET:
                parts.append("\n\n".join(current))
                current = []
        if current:
            parts.append("\n\n".join(current))
        if len(parts) <= 1:
            return [("", text)] if text.strip() else []
        return [(f"Part {n}", part) for n, part in enumerate(parts, start=1)]
    result = []
    for title, body in sections:
        result.append((title or "Introduction", "\n".join(body)))
    return result


def sections_in_place(text: str) -> list[dict]:
    """Page entries ({page, start, end, title}) for the headings already in `text`, without
    changing the text (for documents stored before they were split). [] if under 2 headings."""
    pages, offset = [], 0
    for line in text.split("\n"):
        title = _heading_of(line)
        if title:
            if pages:
                pages[-1]["end"] = max(pages[-1]["start"], offset - 1)
            elif offset > 0:
                pages.append({"page": 1, "start": 0, "end": offset - 1, "title": "Introduction"})
            pages.append({"page": len(pages) + 1, "start": offset, "end": len(text), "title": title[:80]})
        offset += len(line) + 1
    return pages if len(pages) >= 2 else []


def _sectioned(text: str, headings: list[str | None] | None = None) -> Extracted:
    sections = split_sections(text, headings)
    if len(sections) <= 1:
        return _join_pages([text])  # one short block: a single page, nothing to cite more finely
    return _join_pages(sections)


_ocr_converter = None
_ocr_lock = threading.Lock()


def _get_ocr_converter():
    """Load the Indra OCR models once and reuse them (weights download on first use)."""
    global _ocr_converter
    if _ocr_converter is None:
        try:
            import indra_ocr
        except ImportError:
            raise ExtractionError("Image OCR needs the indra-ocr package installed.")
        try:
            _ocr_converter = indra_ocr.load(threads=2)
        except Exception as exc:  # noqa: BLE001
            raise ExtractionError(f"Indra OCR models could not be loaded: {exc.__class__.__name__}")
    return _ocr_converter


def _ocr_image(image) -> str:
    import numpy as np

    gray = np.asarray(image.convert("L"), dtype=np.uint8)
    with _ocr_lock:
        converter = _get_ocr_converter()
        page = converter.ocr(gray)
    return page.text or ""


def extract_pdf(path: str) -> Extracted:
    import fitz  # PyMuPDF

    page_texts: list[str] = []
    ocr_pages = 0
    with fitz.open(path) as doc:
        for page in doc:
            text = page.get_text("text")
            if len(text.strip()) < 20:
                # Likely a scanned page: fall back to OCR if available.
                try:
                    from PIL import Image

                    pix = page.get_pixmap(dpi=200)
                    image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                    text = _ocr_image(image)
                    ocr_pages += 1
                except ExtractionError as exc:
                    log.info("Skipping OCR for page %s: %s", page.number + 1, exc)
                except Exception as exc:  # noqa: BLE001
                    log.warning("OCR failed on page %s: %s", page.number + 1, exc)
            page_texts.append(text)
    result = _join_pages(page_texts)
    result.method = "pdf+ocr" if ocr_pages else "pdf"
    if ocr_pages:
        result.warnings.append(f"{ocr_pages} page(s) were scanned images and went through OCR.")
    return result


def extract_docx(path: str) -> Extracted:
    import docx

    from docx.table import Table
    from docx.text.paragraph import Paragraph

    document = docx.Document(path)
    lines: list[str] = []
    headings: list[str | None] = []
    styled = False
    # Walk the body in order so tables stay next to the section they belong to.
    for child in document.element.body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            para = Paragraph(child, document)
            text = " ".join(para.text.split("\n")).strip()  # soft line breaks would misalign `headings`
            if not text:
                continue
            style = (para.style.name if para.style is not None else "") or ""
            is_heading = style.lower().startswith(("heading", "title")) and len(text) <= 120
            styled = styled or is_heading
            lines.append(text)
            headings.append(text if is_heading else None)
        elif tag == "tbl":
            for row in Table(child, document).rows:
                cells = [" ".join(c.text.split()) for c in row.cells if c.text.strip()]
                if cells:
                    lines.append(" | ".join(cells))
                    headings.append(None)
    text = "\n".join(lines)
    # Documents without heading styles still often number their headings ("7.1 Plugin Manifest").
    result = _sectioned(text, headings if styled else None)
    result.method = "docx"
    return result


def extract_pptx(path: str) -> Extracted:
    from pptx import Presentation

    slides: list[str] = []
    for slide in Presentation(path).slides:
        texts = []
        for shape in slide.shapes:
            if getattr(shape, "has_text_frame", False) and shape.text_frame.text.strip():
                texts.append(shape.text_frame.text)
        slides.append("\n".join(texts))
    result = _join_pages(slides)  # one "page" per slide
    result.method = "pptx"
    return result


def from_text(text: str) -> Extracted:
    """Text typed or pasted by the learner, treated like a one-page .txt file."""
    result = _sectioned(_normalise(text))
    result.method = "pasted"
    return result


def extract_txt(path: str) -> Extracted:
    with open(path, "r", encoding="utf-8", errors="ignore") as handle:
        result = _sectioned(_normalise(handle.read()))
    result.method = "text"
    return result


def extract_image(path: str) -> Extracted:
    from PIL import Image

    with Image.open(path) as image:
        text = _ocr_image(image.convert("RGB"))
    result = _join_pages([text])
    result.method = "ocr"
    return result


_HANDLERS = {
    "pdf": extract_pdf,
    "docx": extract_docx,
    "pptx": extract_pptx,
    "txt": extract_txt,
    "md": extract_txt,
    "jpg": extract_image,
    "jpeg": extract_image,
    "png": extract_image,
}


def extract_text(path: str, extension: str) -> Extracted:
    handler = _HANDLERS.get(extension.lower())
    if handler is None:
        raise ExtractionError(f"Unsupported file type: .{extension}")
    try:
        result = handler(path)
    except ExtractionError:
        raise
    except Exception as exc:  # noqa: BLE001
        log.exception("Extraction failed")
        raise ExtractionError(f"Could not read this {extension.upper()} file: {exc.__class__.__name__}")
    if len(result.text) < 50:
        raise ExtractionError(
            "Very little text could be extracted. If this is a scanned document, "
            "make sure OCR is available on the server."
        )
    return result


def section_titles(pages: list[dict]) -> dict[str, str]:
    """{"3": "7.1 Plugin Manifest"} for the titled sections of a document."""
    return {str(p["page"]): p["title"] for p in pages or [] if p.get("title")}


def page_for_offset(pages: list[dict], offset: int) -> int | None:
    for page in pages:
        if page["start"] <= offset <= page["end"]:
            return page["page"]
    return pages[-1]["page"] if pages else None
