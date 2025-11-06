# backend/routes/document.py - FIXED DATABASE HANDLING
from flask import Blueprint, request, jsonify
import os
from datetime import datetime
from bson import ObjectId
from backend.models.database import db_instance, Collections

document_bp = Blueprint('document', __name__)

# Try to import OCR service
try:
    from backend.services.ocr_service import ocr_service
    OCR_AVAILABLE = True
    print("✅ OCR Service loaded successfully")
except ImportError as e:
    print(f"⚠️ OCR dependencies not available: {e}")
    OCR_AVAILABLE = False
    class DummyOCRService:
        def extract_text(self, file_path):
            return f"Text extraction not available. File: {os.path.basename(file_path)}"
    ocr_service = DummyOCRService()

# Import RAG service
try:
    from backend.services.rag_service import rag_service
    RAG_AVAILABLE = True
    print("✅ RAG Service loaded successfully")
except ImportError as e:
    print(f"⚠️ RAG Service not available: {e}")
    RAG_AVAILABLE = False

@document_bp.route('/upload', methods=['POST', 'OPTIONS'])
def upload_document():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    file_path = None
    try:
        print("📤 Upload endpoint hit")
        print(f"   Request method: {request.method}")
        print(f"   Request headers: {dict(request.headers)}")
        print(f"   Request files: {list(request.files.keys())}")
        print(f"   Request form: {dict(request.form)}")
        
        if 'file' not in request.files:
            print("❌ No file in request")
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        user_id = request.form.get('user_id', 'default-user')
        
        if file.filename == '':
            print("❌ Empty filename")
            return jsonify({'error': 'No file selected'}), 400

        print(f"📄 Processing file: {file.filename} for user: {user_id}")

        # Create uploads directory if it doesn't exist
        upload_dir = 'uploads'
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, file.filename)
        file.save(file_path)

        print("🔍 Extracting text...")
        # Extract text with error handling
        try:
            extracted_text = ocr_service.extract_text(file_path)
            print(f"✅ Text extracted: {len(extracted_text)} characters")
        except Exception as ocr_error:
            print(f"⚠️ OCR extraction failed: {ocr_error}")
            extracted_text = f"Text extraction failed: {str(ocr_error)}"

        # Check database connection
        db = db_instance.get_db()
        document_id = None
        
        if db is not None and db_instance.is_connected():
            # Store in MongoDB if connected
            document_data = {
                'user_id': user_id,
                'filename': file.filename,
                'file_size': os.path.getsize(file_path),
                'file_type': file.content_type,
                'extracted_text': extracted_text,
                'uploaded_on': datetime.utcnow(),
                'processed_at': datetime.utcnow(),
                'is_processed': True,
                'status': 'completed',
                'ocr_available': OCR_AVAILABLE
            }
            
            result = db[Collections.DOCUMENTS].insert_one(document_data)
            document_id = str(result.inserted_id)
            print(f"✅ Document saved to MongoDB with ID: {document_id}")
            
            # Process with RAG if available
            if RAG_AVAILABLE and rag_service.embeddings_available:
                print("🔄 Processing document with RAG...")
                rag_result = rag_service.process_document(document_id, extracted_text)
                print(f"📊 RAG Processing: {rag_result}")
        else:
            # If database not connected, still process the file but don't store
            document_id = f"temp-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            print("⚠️ Database not connected - file processed but not stored")

        # Clean up temporary file
        if os.path.exists(file_path):
            os.remove(file_path)

        return jsonify({
            'success': True,
            'document_id': document_id,
            'text': extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text,
            'message': 'Document processed successfully',
            'database_stored': db_instance.is_connected(),
            'ocr_status': 'available' if OCR_AVAILABLE else 'limited'
        })

    except Exception as e:
        print(f"❌ Upload error: {str(e)}")
        # Clean up file if it exists
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        return jsonify({'error': str(e)}), 500

@document_bp.route('/user/<user_id>', methods=['GET'])
def get_user_documents(user_id):
    try:
        print(f"📋 Fetching documents for user: {user_id}")
        
        db = db_instance.get_db()
        documents = []
        
        if db is not None and db_instance.is_connected():
            # Get documents from MongoDB
            documents = list(db[Collections.DOCUMENTS].find(
                {'user_id': user_id}
            ).sort('uploaded_on', -1))
            
            # Convert ObjectIds to strings
            for doc in documents:
                doc['_id'] = str(doc['_id'])
        else:
            print("⚠️ Database not connected - returning empty documents list")
        
        print(f"✅ Found {len(documents)} documents for user {user_id}")
        
        return jsonify({
            'success': True,
            'documents': documents,
            'database_connected': db_instance.is_connected()
        })
        
    except Exception as e:
        print(f"❌ Error fetching documents: {str(e)}")
        return jsonify({
            'success': True,
            'documents': [],
            'error': str(e)
        })

@document_bp.route('/<document_id>', methods=['GET'])
def get_document(document_id):
    try:
        print(f"📄 Fetching document: {document_id}")
        
        db = db_instance.get_db()
        if db is None or not db_instance.is_connected():
            return jsonify({'error': 'Database not connected'}), 500
            
        # Validate document_id format
        if not document_id or len(document_id) != 24:
            return jsonify({'error': 'Invalid document ID format'}), 400
            
        document = db[Collections.DOCUMENTS].find_one(
            {'_id': ObjectId(document_id)}
        )
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Convert ObjectId to string
        document['_id'] = str(document['_id'])
        
        return jsonify({
            'success': True,
            'document': document
        })
        
    except Exception as e:
        print(f"❌ Error fetching document: {str(e)}")
        return jsonify({'error': str(e)}), 500

@document_bp.route('/test', methods=['GET'])
def test_endpoint():
    return jsonify({
        'success': True,
        'message': 'Document routes are working!',
        'database_connected': db_instance.is_connected(),
        'ocr_available': OCR_AVAILABLE,
        'rag_available': RAG_AVAILABLE
    })

@document_bp.route('/ask', methods=['POST'])
def ask_document():
    """
    Q&A endpoint - Ask questions about a document using RAG
    """
    try:
        data = request.json
        document_id = data.get('document_id')
        question = data.get('question', '')
        
        if not document_id or not question:
            return jsonify({'error': 'document_id and question are required'}), 400
        
        print(f"\n{'='*50}")
        print(f"❓ DOCUMENT Q&A REQUEST")
        print(f"📄 Document ID: {document_id}")
        print(f"❓ Question: {question}")
        print(f"{'='*50}\n")
        
        # Get document from database
        db = db_instance.get_db()
        if db is None:
            return jsonify({'error': 'Database not connected'}), 500
        
        document = db[Collections.DOCUMENTS].find_one({'_id': ObjectId(document_id)})
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Use RAG to find relevant context
        context = ""
        if RAG_AVAILABLE and rag_service.embeddings_available:
            print("🔍 Searching for relevant context using RAG...")
            context = rag_service.get_context_for_generation(document_id, question, max_chunks=3)
        
        # Fallback to full text if RAG not available
        if not context:
            context = document.get('extracted_text', '')[:2000]
        
        print(f"📝 Using context ({len(context)} chars)")
        
        # Try to use OpenAI for answer
        try:
            from openai import OpenAI
            import os
            
            api_key = os.getenv('OPENAI_API_KEY')
            if api_key and api_key != 'your-openai-key-here' and len(api_key) > 20:
                print("🤖 Generating answer with OpenAI...")
                client = OpenAI(api_key=api_key)
                
                prompt = f"""Answer the following question based ONLY on the provided context.
If the answer cannot be found in the context, say "I don't have enough information to answer that question."

Context:
{context}

Question: {question}

Answer:"""
                
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=500
                )
                
                answer = response.choices[0].message.content.strip()
                
                print(f"✅ Answer generated!")
                return jsonify({
                    'success': True,
                    'answer': answer,
                    'method': 'openai_rag' if RAG_AVAILABLE else 'openai_fulltext'
                })
        except Exception as ai_error:
            print(f"⚠️ OpenAI failed: {ai_error}")
        
        # Fallback: Extract relevant sentence from context
        sentences = [s.strip() for s in context.split('.') if len(s.strip()) > 20]
        
        # Simple keyword matching
        question_words = set(question.lower().split())
        best_sentence = ""
        max_overlap = 0
        
        for sentence in sentences:
            sentence_words = set(sentence.lower().split())
            overlap = len(question_words & sentence_words)
            if overlap > max_overlap:
                max_overlap = overlap
                best_sentence = sentence
        
        answer = best_sentence if best_sentence else "I couldn't find a specific answer to that question in the document."
        
        return jsonify({
            'success': True,
            'answer': answer,
            'method': 'keyword_matching'
        })
        
    except Exception as e:
        print(f"❌ Q&A error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@document_bp.route('/generate-quiz', methods=['POST'])
def generate_quiz():
    try:
        data = request.json
        text = data.get('text', '')
        num_questions = data.get('num_questions', 5)
        difficulty = data.get('difficulty', 'medium')
        
        print(f"\n{'='*50}")
        print(f"📝 QUIZ GENERATION REQUEST")
        print(f"{'='*50}")
        print(f"📊 Text length: {len(text)} characters")
        print(f"📊 Num questions: {num_questions}")
        print(f"📊 Difficulty: {difficulty}")
        print(f"📄 Text preview (first 300 chars):\n{text[:300]}")
        print(f"{'='*50}\n")
        
        if not text or len(text) < 50:
            return jsonify({
                'error': 'Text too short or empty. Please upload a document with more content.',
                'text_length': len(text)
            }), 400
        
        print(f"📝 Generating {num_questions} quiz questions (difficulty: {difficulty})")
        
        # Try to get relevant context using RAG if available
        context_text = text
        if RAG_AVAILABLE and rag_service.embeddings_available and data.get('document_id'):
            print("🔍 Using RAG to find relevant content...")
            query = f"Generate quiz questions about the main concepts and key points"
            rag_context = rag_service.get_context_for_generation(
                data.get('document_id'), 
                query, 
                max_chunks=5
            )
            if rag_context:
                context_text = rag_context
                print(f"✅ Using RAG context ({len(context_text)} chars)")
        
        # Try to use OpenAI if available
        openai_success = False
        try:
            from openai import OpenAI
            import os
            import json
            
            api_key = os.getenv('OPENAI_API_KEY')
            if api_key and api_key != 'your-openai-key-here' and len(api_key) > 20:
                print("🤖 Attempting to use OpenAI for quiz generation...")
                client = OpenAI(api_key=api_key)
                
                # Limit text to prevent token overflow (use RAG context if available)
                text_for_ai = context_text[:4000] if len(context_text) > 4000 else context_text
                
                prompt = f"""Generate {num_questions} high-quality multiple choice questions based on this text.
Make questions specific, clear, and directly related to the content.

Text:
{text_for_ai}

Requirements:
- Questions should test understanding of the main concepts
- Difficulty level: {difficulty}
  * Easy: Basic recall and understanding questions
  * Medium: Application and analysis questions  
  * Hard: Critical thinking and synthesis questions
- ALL 4 options (A, B, C, D) must be plausible and related to the content
- NO "None of the above" or "All of the above" options
- Options should be distinct and clearly different from each other
- Include detailed explanations for correct answers

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks):
{{
  "questions": [
    {{
      "question": "Clear, specific question?",
      "options": {{
        "A": "Specific and relevant option",
        "B": "Another plausible option",
        "C": "Third relevant option",
        "D": "Fourth distinct option"
      }},
      "answer": "A",
      "explanation": "Detailed explanation of why this is correct and why others are wrong"
    }}
  ]
}}"""
                
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=2000
                )
                
                content = response.choices[0].message.content.strip()
                
                # Remove markdown code blocks if present
                if content.startswith('```'):
                    content = content.split('```')[1]
                    if content.startswith('json'):
                        content = content[4:]
                    content = content.strip()
                
                result = json.loads(content)
                
                if 'questions' in result and len(result['questions']) > 0:
                    # Save to database
                    db = db_instance.get_db()
                    if db is not None:
                        quiz_data = {
                            'document_id': data.get('document_id'),
                            'questions': result['questions'],
                            'num_questions': num_questions,
                            'difficulty': difficulty,
                            'created_at': datetime.utcnow(),
                            'generated_by': 'openai'
                        }
                        quiz_result = db[Collections.QUIZZES].insert_one(quiz_data)
                        result['quiz_id'] = str(quiz_result.inserted_id)
                    
                    print(f"✅ Quiz generated successfully using OpenAI!")
                    openai_success = True
                    return jsonify({
                        'success': True,
                        'generated_by': 'openai',
                        **result
                    })
            else:
                print("⚠️ OpenAI API key not configured or invalid")
                
        except Exception as ai_error:
            print(f"⚠️ OpenAI generation failed: {ai_error}")
            print(f"📋 Error details: {type(ai_error).__name__}")
            import traceback
            traceback.print_exc()
        
        if not openai_success:
            print("📝 Falling back to IMPROVED rule-based quiz generation")
        
        # IMPROVED Fallback: Generate proper, intelligent questions
        print(f"📄 Text length: {len(text)} characters")
        
        questions = []
        
        # Clean and extract meaningful content from text
        import re
        import random
        
        # ADVANCED TEXT CLEANING
        clean_text = text
        
        # Remove page markers like "Page 1", "Page 2", "--- Page 2 ---", etc.
        clean_text = re.sub(r'[-–—]*\s*Page\s+\d+\s*[-–—]*', ' ', clean_text, flags=re.IGNORECASE)
        clean_text = re.sub(r'Module\s*[-–—]*\s*\d+\s*[-–—]*\s*Page\s*\d+\s*[-–—]*', ' ', clean_text, flags=re.IGNORECASE)
        
        # Remove code blocks (lines with { } ; or code patterns)
        lines = clean_text.split('\n')
        cleaned_lines = []
        for line in lines:
            line_stripped = line.strip()
            # Skip lines that look like code
            if any(pattern in line_stripped for pattern in ['{', '}', 'public void', 'private ', 'class ', 'System.out', 'import ', 'function(', '=>', 'const ', 'let ', 'var ']):
                continue
            # Skip lines with too many special characters
            special_char_count = sum(1 for c in line_stripped if c in '{};()[]<>/\\')
            if len(line_stripped) > 0 and special_char_count / len(line_stripped) > 0.15:
                continue
            # Skip very short lines or lines with only symbols
            if len(line_stripped) > 10:
                cleaned_lines.append(line)
        
        clean_text = ' '.join(cleaned_lines)
        
        # Remove bullet points and list markers
        clean_text = re.sub(r'[•●○■□▪▫◦⦿⦾]', '', clean_text)
        clean_text = re.sub(r'^\s*[\d]+[.)]\s*', '', clean_text, flags=re.MULTILINE)
        
        # Remove extra whitespace and normalize
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        
        # Split into sentences (more robust)
        sentences = []
        for s in re.split(r'[.!?]+', clean_text):
            s = s.strip()
            
            # Skip sentences that still look like code or garbage
            if any(pattern in s for pattern in ['System.', 'public ', 'private ', 'class ', '();', '{', '}', '//']):
                continue
            
            # Skip sentences with page markers
            if re.search(r'(Page\s+\d+|Module\s*[-–—]*\s*\d+)', s, re.IGNORECASE):
                continue
            
            # Must be at least 50 chars and 8 words, contain letters
            if len(s) > 50 and len(s.split()) > 8 and any(c.isalpha() for c in s):
                # Check if it's a proper sentence (not just fragments)
                if s.count(' ') >= 5:  # At least 5 spaces (6+ words)
                    sentences.append(s)
        
        # Extract key concepts (capitalized words, technical terms)
        words = clean_text.split()
        concepts = []
        for word in words:
            cleaned = word.strip('.,;:()[]{}')
            if cleaned and len(cleaned) > 3 and cleaned[0].isupper():
                if cleaned not in ['The', 'This', 'That', 'These', 'Those', 'There', 'When', 'Where', 'What', 'Which', 'Who', 'However', 'Therefore', 'Moreover', 'Furthermore']:
                    concepts.append(cleaned)
        
        # Extract meaningful multi-word terms
        key_phrases = []
        for i in range(len(words) - 3):
            phrase = ' '.join(words[i:i+4])
            if len(phrase) > 15:
                lower_phrase = phrase.lower()
                if not any(lower_phrase.startswith(skip) for skip in ['the ', 'and ', 'or ', 'but ', 'from this', 'in this', 'on this', 'at this', 'to this']):
                    key_phrases.append(phrase.strip('.,;:'))
        
        print(f"📊 Found {len(sentences)} quality sentences, {len(set(concepts))} unique concepts")
        
        # Helper function to create intelligent questions
        def create_smart_question(sentence, all_concepts):
            """Generate a proper question from a sentence"""
            sentence_lower = sentence.lower()
            sentence_words = sentence.split()
            
            # Extract key nouns/concepts from this sentence
            sentence_concepts = [w.strip('.,;:()[]{}') for w in sentence_words if w.strip('.,;:()[]{}') in all_concepts]
            
            # Pattern matching for different question types
            if any(word in sentence_lower for word in ['define', 'definition', 'refers to', 'is a ', 'means that', 'known as']):
                if sentence_concepts:
                    return f"What is {sentence_concepts[0]}?"
                words_list = [w for w in sentence_words[:5] if len(w) > 3]
                return f"How is {' '.join(words_list[:2])} defined?"
            
            elif any(word in sentence_lower for word in ['because', 'reason', 'cause', 'due to', 'since ', 'results in', 'leads to']):
                if sentence_concepts:
                    return f"Why does {sentence_concepts[0]} occur?"
                return "What is the cause mentioned in the text?"
            
            elif any(word in sentence_lower for word in ['method', 'process', 'procedure', 'steps', 'approach', 'technique']):
                if sentence_concepts:
                    return f"What process is described regarding {sentence_concepts[0]}?"
                return "What method or process is explained?"
            
            elif any(word in sentence_lower for word in ['benefit', 'advantage', 'important', 'significant', 'crucial', 'essential']):
                if sentence_concepts:
                    return f"What is important about {sentence_concepts[0]}?"
                return "What significance is highlighted?"
            
            elif any(word in sentence_lower for word in ['example', 'instance', 'such as', 'including', 'like ']):
                return "Which of the following examples is mentioned?"
            
            elif any(word in sentence_lower for word in ['differ', 'contrast', 'unlike', 'whereas', 'while ', 'compared to']):
                if sentence_concepts and len(sentence_concepts) >= 2:
                    return f"How does {sentence_concepts[0]} differ from {sentence_concepts[1]}?"
                return "What contrast is described?"
            
            elif '?' in sentence:
                # If sentence is already a question, use it
                return sentence.strip()
            
            else:
                # General comprehension - extract main subject
                if sentence_concepts:
                    return f"What does the text state about {sentence_concepts[0]}?"
                else:
                    # Extract subject from beginning of sentence
                    meaningful = [w for w in sentence_words[:6] if len(w) > 3]
                    if len(meaningful) >= 2:
                        return f"What information is provided about {' '.join(meaningful[:2])}?"
                    return "According to the text, which statement is correct?"
        
        # Generate high-quality questions
        difficulty_config = {
            'easy': {'start_pct': 0.0, 'spacing': 1},
            'medium': {'start_pct': 0.25, 'spacing': 2},
            'hard': {'start_pct': 0.4, 'spacing': 3}
        }
        
        config = difficulty_config.get(difficulty, difficulty_config['medium'])
        start_idx = int(len(sentences) * config['start_pct'])
        
        generated = 0
        attempts = 0
        max_attempts = len(sentences) * 2
        
        # Helper to clean and validate option text
        def is_valid_option(text):
            """Check if text is suitable for a quiz option"""
            if not text or len(text) < 20:
                return False
            # Check for code patterns
            if any(pattern in text for pattern in ['System.', '{', '}', '();', '//', 'public ', 'class ']):
                return False
            # Check for page markers
            if re.search(r'(Page\s+\d+|Module\s*[-–—]*\s*\d+)', text, re.IGNORECASE):
                return False
            # Must contain mostly letters
            letter_count = sum(1 for c in text if c.isalpha())
            if len(text) > 0 and letter_count / len(text) < 0.5:
                return False
            return True
        
        def clean_option_text(text):
            """Clean option text for display"""
            # Remove any remaining page markers
            text = re.sub(r'Module\s*[-–—]*\s*\d+\s*[-–—]*\s*Page\s*\d+\s*[-–—]*', '', text, flags=re.IGNORECASE)
            text = re.sub(r'[-–—]*\s*Page\s+\d+\s*[-–—]*', '', text, flags=re.IGNORECASE)
            # Clean up extra spaces
            text = re.sub(r'\s+', ' ', text).strip()
            return text
        
        while generated < num_questions and attempts < max_attempts:
            attempts += 1
            sentence_idx = (start_idx + attempts * config['spacing']) % len(sentences)
            sentence = sentences[sentence_idx]
            
            # Skip very short or generic sentences
            if len(sentence.split()) < 8:
                continue
            
            # Validate this is a good sentence for a question
            if not is_valid_option(sentence):
                continue
            
            # Create intelligent question
            question_text = create_smart_question(sentence, concepts)
            
            # Create plausible but distinct options
            available_sentences = [s for j, s in enumerate(sentences) 
                                  if j != sentence_idx and len(s) > 60 and is_valid_option(s)]
            
            if len(available_sentences) >= 3:
                # Correct answer (clean and truncated appropriately)
                correct_answer = clean_option_text(sentence)
                if len(correct_answer) > 200:
                    # Find a good breaking point
                    last_space = correct_answer[:200].rfind(' ')
                    if last_space > 150:
                        correct_answer = correct_answer[:last_space] + "..."
                    else:
                        correct_answer = correct_answer[:200] + "..."
                
                # Wrong options from other parts
                wrong_options = []
                selected_indices = random.sample(range(len(available_sentences)), min(3, len(available_sentences)))
                
                for idx in selected_indices:
                    wrong_sent = available_sentences[idx]
                    wrong_opt = clean_option_text(wrong_sent)
                    if len(wrong_opt) > 200:
                        last_space = wrong_opt[:200].rfind(' ')
                        if last_space > 150:
                            wrong_opt = wrong_opt[:last_space] + "..."
                        else:
                            wrong_opt = wrong_opt[:200] + "..."
                    wrong_options.append(wrong_opt)
                
                # Final validation - make sure all options are clean
                if not all(is_valid_option(opt) for opt in [correct_answer] + wrong_options):
                    continue
                
                # Randomize correct answer position
                correct_positions = ['A', 'B', 'C', 'D']
                correct_pos = correct_positions[generated % 4]
                
                options = {}
                wrong_idx = 0
                for pos in correct_positions:
                    if pos == correct_pos:
                        options[pos] = correct_answer
                    else:
                        if wrong_idx < len(wrong_options):
                            options[pos] = wrong_options[wrong_idx]
                            wrong_idx += 1
                        else:
                            options[pos] = "This information is not found in the document"
                
                questions.append({
                    "question": question_text,
                    "options": options,
                    "answer": correct_pos,
                    "explanation": f"The correct information from the text is: '{correct_answer[:250]}' The other options are from different sections and do not answer this specific question."
                })
                generated += 1
        
        # If still not enough, add fill-in-the-blank questions
        while len(questions) < num_questions and sentences:
            sentence = sentences[len(questions) % len(sentences)]
            words_list = sentence.split()
            
            if len(words_list) > 12:
                # Find an important word to blank out (prefer longer words)
                important_words = [(i, w) for i, w in enumerate(words_list) if len(w) > 5 and w[0].isupper()]
                
                if important_words:
                    blank_idx, blank_word = random.choice(important_words)
                    before = ' '.join(words_list[:blank_idx])
                    after = ' '.join(words_list[blank_idx+1:])
                    
                    # Create distractors
                    other_important = [w for i, w in important_words if i != blank_idx]
                    distractors = other_important[:3] if len(other_important) >= 3 else []
                    
                    while len(distractors) < 3:
                        distractors.append(f"[Option {len(distractors)+1}]")
                    
                    questions.append({
                        "question": f"Complete the statement: {before} _____ {after}",
                        "options": {
                            "A": blank_word,
                            "B": distractors[0],
                            "C": distractors[1],
                            "D": distractors[2]
                        },
                        "answer": "A",
                        "explanation": f"The complete sentence is: '{sentence}'"
                    })
                else:
                    break
            else:
                break
        
        # FINAL VALIDATION: Remove any questions with bad options
        validated_questions = []
        for q in questions:
            # Check all options are clean
            all_clean = True
            for opt_key, opt_text in q['options'].items():
                if not opt_text or len(opt_text) < 15:
                    all_clean = False
                    break
                # Check for page markers or code
                if re.search(r'(Page\s+\d+|Module\s*[-–—]*\s*\d+|System\.|class |public |{|})', opt_text, re.IGNORECASE):
                    all_clean = False
                    break
            
            if all_clean:
                validated_questions.append(q)
        
        # Use validated questions
        questions = validated_questions
        
        print(f"✅ Generated {len(questions)} clean, validated questions")
        
        # If we don't have enough good questions, show a better error
        if len(questions) == 0:
            return jsonify({
                'error': 'Unable to generate quality questions from this document. The document may contain mostly code, images, or formatted content. Please try a document with more text content.',
                'success': False
            }), 400
        
        # Save to database
        db = db_instance.get_db()
        quiz_id = None
        if db is not None:
            quiz_data = {
                'document_id': data.get('document_id'),
                'questions': questions,
                'num_questions': num_questions,
                'difficulty': difficulty,
                'created_at': datetime.utcnow(),
                'generated_by': 'fallback'
            }
            quiz_result = db[Collections.QUIZZES].insert_one(quiz_data)
            quiz_id = str(quiz_result.inserted_id)
        
        return jsonify({
            'success': True,
            'questions': questions,
            'quiz_id': quiz_id,
            'message': 'Quiz generated (OpenAI not configured, using fallback)'
        })
        
    except Exception as e:
        print(f"❌ Quiz generation error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@document_bp.route('/generate-flashcards', methods=['POST'])
def generate_flashcards():
    try:
        data = request.json
        text = data.get('text', '')
        document_id = data.get('document_id')
        num_cards = data.get('num_cards', 10)
        
        print(f"\n{'='*50}")
        print(f"📇 FLASHCARD GENERATION REQUEST")
        print(f"{'='*50}")
        print(f"📊 Text length: {len(text)} characters")
        print(f"📊 Num cards: {num_cards}")
        print(f"📄 Document ID: {document_id}")
        print(f"{'='*50}\n")
        
        if not text or len(text) < 50:
            return jsonify({
                'error': 'Text too short or empty. Please upload a document with more content.',
                'text_length': len(text)
            }), 400
        
        print(f"📇 Generating {num_cards} flashcards")
        
        # Try to get relevant context using RAG if available
        context_text = text
        if RAG_AVAILABLE and rag_service.embeddings_available and document_id:
            print("🔍 Using RAG to find relevant content...")
            query = f"Extract key concepts, definitions, and important facts for flashcards"
            rag_context = rag_service.get_context_for_generation(
                document_id, 
                query, 
                max_chunks=5
            )
            if rag_context:
                context_text = rag_context
                print(f"✅ Using RAG context ({len(context_text)} chars)")
        
        # Try to use OpenAI if available
        try:
            from openai import OpenAI
            import os
            import json
            
            api_key = os.getenv('OPENAI_API_KEY')
            if api_key and api_key != 'your-openai-key-here' and len(api_key) > 20:
                print("🤖 Attempting to use OpenAI for flashcard generation...")
                client = OpenAI(api_key=api_key)
                
                # Limit text to prevent token overflow
                text_for_ai = context_text[:4000] if len(context_text) > 4000 else context_text
                
                prompt = f"""Generate {num_cards} educational flashcards based on this text.
Each flashcard should have a clear question/concept on the front and a detailed answer on the back.

Text:
{text_for_ai}

Requirements:
- Focus on key concepts, definitions, important facts, and main ideas
- Front should be a clear question or concept name
- Back should provide a concise but complete explanation
- Make them useful for studying and retention
- Cover different aspects of the content

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks):
{{
  "flashcards": [
    {{
      "front": "What is [concept]?",
      "back": "Clear, detailed explanation of the concept"
    }},
    {{
      "front": "Define [term]",
      "back": "Precise definition with context"
    }}
  ]
}}"""
                
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=2000
                )
                
                response_text = response.choices[0].message.content.strip()
                print(f"📝 Raw AI response:\n{response_text}\n")
                
                # Clean up response
                if '```json' in response_text:
                    response_text = response_text.split('```json')[1].split('```')[0].strip()
                elif '```' in response_text:
                    response_text = response_text.split('```')[1].split('```')[0].strip()
                
                result = json.loads(response_text)
                flashcards = result.get('flashcards', [])
                
                if flashcards and len(flashcards) > 0:
                    print(f"✅ Generated {len(flashcards)} flashcards with OpenAI!")
                    
                    # Save to database
                    db = db_instance.get_db()
                    if db is not None and document_id:
                        flashcard_data = {
                            'document_id': document_id,
                            'flashcards': flashcards,
                            'num_cards': len(flashcards),
                            'created_at': datetime.utcnow(),
                            'generated_by': 'openai'
                        }
                        db[Collections.FLASHCARDS].insert_one(flashcard_data)
                    
                    return jsonify({
                        'success': True,
                        'flashcards': flashcards,
                        'message': f'Generated {len(flashcards)} flashcards with AI'
                    })
                    
        except Exception as ai_error:
            print(f"⚠️ OpenAI flashcard generation failed: {ai_error}")
            import traceback
            traceback.print_exc()
        
        # Fallback: Smart extraction from text
        print("📝 Using fallback flashcard generation...")
        
        # Split into sentences
        sentences = [s.strip() for s in text.split('.') if len(s.strip()) > 20]
        
        # Extract key phrases (simple heuristic: longer phrases with important words)
        important_words = ['is', 'are', 'was', 'were', 'means', 'refers', 'defined', 'called', 'known']
        
        flashcards = []
        for sentence in sentences[:num_cards * 2]:  # Process more to find good ones
            if len(flashcards) >= num_cards:
                break
                
            # Look for definition-like sentences
            sentence_lower = sentence.lower()
            has_important = any(word in sentence_lower for word in important_words)
            
            if has_important and len(sentence) > 30:
                # Try to split into question and answer
                parts = sentence.split(' is ', 1) if ' is ' in sentence else \
                        sentence.split(' are ', 1) if ' are ' in sentence else \
                        sentence.split(' means ', 1) if ' means ' in sentence else \
                        [sentence[:len(sentence)//2], sentence[len(sentence)//2:]]
                
                if len(parts) == 2:
                    front = f"What is {parts[0].strip()}?" if not parts[0].strip().endswith('?') else parts[0].strip()
                    back = parts[1].strip()
                    
                    flashcards.append({
                        'front': front[:150],  # Limit length
                        'back': back[:300]
                    })
        
        # If we don't have enough, add more general ones
        while len(flashcards) < min(num_cards, len(sentences)):
            idx = len(flashcards)
            if idx < len(sentences):
                flashcards.append({
                    'front': f"What does the document say about section {idx + 1}?",
                    'back': sentences[idx][:300]
                })
            else:
                break
        
        # Ensure we have at least some flashcards
        if len(flashcards) == 0:
            flashcards = [{
                'front': 'Main topic of the document',
                'back': text[:300] + '...' if len(text) > 300 else text
            }]
        
        print(f"✅ Generated {len(flashcards)} flashcards (fallback)")
        
        # Save to database
        db = db_instance.get_db()
        if db is not None and document_id:
            flashcard_data = {
                'document_id': document_id,
                'flashcards': flashcards,
                'num_cards': len(flashcards),
                'created_at': datetime.utcnow(),
                'generated_by': 'fallback'
            }
            db[Collections.FLASHCARDS].insert_one(flashcard_data)
        
        return jsonify({
            'success': True,
            'flashcards': flashcards,
            'message': f'Generated {len(flashcards)} flashcards'
        })
        
    except Exception as e:
        print(f"❌ Flashcard generation error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@document_bp.route('/generate-mindmap', methods=['POST'])
def generate_mindmap():
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        print(f"🗺️ Generating mindmap")
        
        # Simple fallback mindmap structure
        words = text.split()[:50]
        
        mindmap = {
            'central_topic': 'Document Summary',
            'branches': [
                {
                    'topic': 'Main Ideas',
                    'subtopics': [' '.join(words[:10])]
                },
                {
                    'topic': 'Key Points',
                    'subtopics': [' '.join(words[10:20])]
                },
                {
                    'topic': 'Details',
                    'subtopics': [' '.join(words[20:30])]
                }
            ]
        }
        
        return jsonify({
            'success': True,
            'mindmap': mindmap,
            'message': 'Mindmap generated'
        })
        
    except Exception as e:
        print(f"❌ Mindmap generation error: {str(e)}")
        return jsonify({'error': str(e)}), 500