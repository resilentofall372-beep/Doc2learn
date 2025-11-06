# backend/services/ocr_service.py - UPDATED WITH DEPENDENCY HANDLING
import os
import re
from datetime import datetime

class OCRService:
    def __init__(self):
        # Use environment variable for API key
        api_key = os.environ.get('OPENAI_API_KEY', 'dummy-key')
        
        # Try to import OpenAI, but handle if not available
        try:
            from openai import OpenAI
            self.openai_client = OpenAI(api_key=api_key)
            self.openai_available = True
        except ImportError:
            print("⚠️ OpenAI not available")
            self.openai_available = False
            self.openai_client = None
        
        # Try to import other OCR dependencies
        try:
            import fitz  # PyMuPDF
            from PIL import Image
            import pytesseract
            import easyocr
            import docx
            from pptx import Presentation
            import torch
            
            self.fitz = fitz
            self.PIL = Image
            self.pytesseract = pytesseract
            self.easyocr = easyocr
            self.docx = docx
            self.pptx = Presentation
            self.torch = torch
            
            # Initialize EasyOCR if available
            try:
                self.easyocr_reader = easyocr.Reader(['en'], gpu=torch.cuda.is_available())
            except Exception as e:
                print(f"EasyOCR initialization failed: {e}")
                self.easyocr_reader = None
                
            self.dependencies_available = True
            print("✅ All OCR dependencies loaded successfully")
            
        except ImportError as e:
            print(f"⚠️ Some OCR dependencies not available: {e}")
            self.dependencies_available = False
            self.easyocr_reader = None

    def extract_text(self, file_path: str) -> str:
        """Extract text from various file formats"""
        if not self.dependencies_available:
            return f"OCR dependencies not installed. File: {os.path.basename(file_path)}"
            
        ext = os.path.splitext(file_path)[1].lower()
        
        try:
            if ext == '.txt':
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    return f.read()
            elif ext == '.docx':
                doc = self.docx.Document(file_path)
                text = '\n'.join([p.text for p in doc.paragraphs])
                return text
            elif ext == '.pptx':
                prs = self.pptx.Presentation(file_path)
                texts = []
                for slide in prs.slides:
                    for shape in slide.shapes:
                        if hasattr(shape, "text") and shape.text.strip():
                            texts.append(shape.text)
                return '\n'.join(texts)
            elif ext == '.pdf':
                return self.extract_pdf_text(file_path)
            elif ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']:
                return self.fast_multi_ocr(file_path)
            else:
                return f"[Unsupported format: {ext}]"
        except Exception as e:
            return f"[Error: {e}]"

    def extract_pdf_text(self, file_path: str) -> str:
        """Extract text from PDF"""
        try:
            doc = self.fitz.open(file_path)
            text_parts = []
            for page_num in range(len(doc)):
                page = doc[page_num]
                page_text = page.get_text()
                if page_text.strip():
                    text_parts.append(f"--- Page {page_num + 1} ---")
                    text_parts.append(page_text)
            doc.close()
            return '\n'.join(text_parts) if text_parts else "[No text found in PDF]"
        except Exception as e:
            return f"[PDF error: {e}]"

    def fast_multi_ocr(self, image_path: str) -> str:
        """OCR using multiple engines"""
        text = self.fast_easyocr(image_path) if self.easyocr_reader else ""
        if not text.strip():
            text = self.fast_tesseract(image_path)
        return text if text.strip() else "[No text extracted]"

    def fast_easyocr(self, image_path: str) -> str:
        """EasyOCR implementation"""
        if not self.easyocr_reader:
            return ""
        results = self.easyocr_reader.readtext(image_path, detail=0, paragraph=True)
        return " ".join(results)

    def fast_tesseract(self, image_path: str) -> str:
        """Tesseract OCR implementation"""
        try:
            return self.pytesseract.image_to_string(self.PIL.Image.open(image_path))
        except:
            return ""

    # ... KEEP ALL YOUR EXISTING OpenAI FUNCTIONS (they will work if dependencies are available) ...
    # generate_quiz_with_preferences, generate_flashcards, generate_mindmap, etc.

# Singleton instance
ocr_service = OCRService()