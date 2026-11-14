"""Text extraction for uploaded study material.

Returns the text plus a list of page offsets so later stages can cite pages.
Supported: PDF, DOCX, PPTX, TXT/MD, and images (via Tesseract when installed).
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

log = logging.getLogger(__name__)


@dataclass
class Extracted:
    text: str
    pages: list[dict] = field(default_factory=list)  # [{"page": 1, "start": 0, "end": 1234}]
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


def _join_pages(page_texts: list[str]) -> Extracted:
    chunks, pages, cursor = [], [], 0
    for number, page_text in enumerate(page_texts, start=1):
        page_text = _normalise(page_text)
        if not page_text:
            continue
        start = cursor
        chunks.append(page_text)
        cursor += len(page_text) + 2  # account for the separator added below
        pages.append({"page": number, "start": start, "end": cursor - 2})
    return Extracted(text="\n\n".join(chunks), pages=pages)


def _ocr_image(image) -> str:
    try:
        import pytesseract
    except ImportError:
        raise ExtractionError("Image OCR needs pytesseract and the tesseract binary installed.")
    try:
        return pytesseract.image_to_string(image)
    except pytesseract.TesseractNotFoundError:
        raise ExtractionError("Tesseract OCR binary is not installed on the server.")


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

    document = docx.Document(path)
    parts = [p.text for p in document.paragraphs if p.text.strip()]
    for table in document.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                parts.append(" | ".join(cells))
    result = _join_pages(["\n".join(parts)])
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
    result = _join_pages([text])
    result.method = "pasted"
    return result


def extract_txt(path: str) -> Extracted:
    with open(path, "r", encoding="utf-8", errors="ignore") as handle:
        result = _join_pages([handle.read()])
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


def page_for_offset(pages: list[dict], offset: int) -> int | None:
    for page in pages:
        if page["start"] <= offset <= page["end"]:
            return page["page"]
    return pages[-1]["page"] if pages else None
