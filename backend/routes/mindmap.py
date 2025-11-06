# backend/routes/mindmap.py
from flask import Blueprint, request, jsonify
from datetime import datetime
from backend.models.database import db_instance, Collections
import re

mindmap_bp = Blueprint('mindmap', __name__)

@mindmap_bp.route('/generate', methods=['POST'])
def generate_mindmap():
    try:
        data = request.json
        text = data.get('text', '')
        document_id = data.get('document_id')
        
        if not text or len(text) < 50:
            return jsonify({'error': 'Text too short for mindmap generation'}), 400
        
        print(f"\n{'='*50}")
        print(f"🗺️ MINDMAP GENERATION REQUEST")
        print(f"{'='*50}")
        print(f"📊 Text length: {len(text)} characters")
        print(f"{'='*50}\n")
        
        # Try OpenAI first
        try:
            from openai import OpenAI
            import os
            import json
            
            api_key = os.getenv('OPENAI_API_KEY')
            if api_key and api_key != 'your-openai-key-here' and len(api_key) > 20:
                print("🤖 Attempting to use OpenAI for mindmap generation...")
                client = OpenAI(api_key=api_key)
                
                text_for_ai = text[:3000] if len(text) > 3000 else text
                
                prompt = f"""Create a hierarchical mind map structure from this text.
                
Text:
{text_for_ai}

Return ONLY a valid JSON object (no markdown, no code blocks) with this structure:
{{
  "central_topic": "Main topic of the document",
  "branches": [
    {{
      "topic": "Main branch 1",
      "subtopics": ["subtopic 1", "subtopic 2"]
    }},
    {{
      "topic": "Main branch 2",
      "subtopics": ["subtopic 3", "subtopic 4"]
    }}
  ]
}}

Create 3-5 main branches with 2-4 subtopics each."""

                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=1000
                )
                
                content = response.choices[0].message.content.strip()
                
                # Remove markdown code blocks if present
                if content.startswith('```'):
                    content = content.split('```')[1]
                    if content.startswith('json'):
                        content = content[4:]
                    content = content.strip()
                
                result = json.loads(content)
                
                print(f"✅ Mindmap generated successfully using OpenAI!")
                return jsonify({
                    'success': True,
                    'mindmap': result,
                    'generated_by': 'openai'
                })
        except Exception as ai_error:
            print(f"⚠️ OpenAI generation failed: {ai_error}")
        
        # Fallback: Generate mindmap from text structure
        print("📝 Using fallback mindmap generation")
        
        # Clean text
        clean_text = re.sub(r'\s+', ' ', text).strip()
        
        # Split into sentences
        sentences = [s.strip() for s in re.split(r'[.!?]+', clean_text) if len(s.strip()) > 15]
        
        print(f"📊 Found {len(sentences)} sentences")
        print(f"📄 Sample sentences: {sentences[:3]}")
        
        # Extract meaningful words (not common words)
        common_words = {'the', 'is', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 
                       'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might',
                       'can', 'this', 'that', 'these', 'those', 'and', 'or', 'but', 'in', 'on',
                       'at', 'to', 'for', 'of', 'with', 'from', 'by', 'about', 'as', 'into'}
        
        words = [w for w in clean_text.lower().split() if len(w) > 4 and w not in common_words]
        
        # Get unique key terms (most common meaningful words)
        from collections import Counter
        word_freq = Counter(words)
        key_terms = [word for word, count in word_freq.most_common(20)]
        
        print(f"🔑 Key terms: {key_terms[:10]}")
        
        # Create central topic from first meaningful sentence or key terms
        if sentences:
            # Use first substantial sentence as central topic
            central_topic = sentences[0][:60].strip()
            if central_topic.endswith(','):
                central_topic = central_topic[:-1]
        else:
            central_topic = "Document Overview"
        
        # Create branches based on content clustering
        branches = []
        num_branches = min(5, max(3, len(sentences) // 4))
        sentences_per_branch = max(1, len(sentences) // num_branches)
        
        for i in range(num_branches):
            start_idx = i * sentences_per_branch
            end_idx = min((i + 1) * sentences_per_branch, len(sentences))
            branch_sentences = sentences[start_idx:end_idx]
            
            if not branch_sentences:
                continue
            
            # Create branch topic from key terms in this section
            branch_text = ' '.join(branch_sentences)
            branch_words = [w for w in branch_text.lower().split() if w in key_terms]
            
            if branch_words:
                # Use most common key term in section as branch topic
                branch_topic = branch_words[0].capitalize()
                if len(branch_words) > 1:
                    branch_topic = f"{branch_words[0].capitalize()} and {branch_words[1].capitalize()}"
            else:
                # Fallback: use beginning of first sentence
                branch_topic = branch_sentences[0][:30].strip()
                if ' ' in branch_topic:
                    # Get first few words
                    branch_topic = ' '.join(branch_topic.split()[:4])
            
            # Create subtopics from sentences in this section
            subtopics = []
            for sent in branch_sentences[:4]:  # Max 4 subtopics per branch
                # Clean and shorten sentence
                subtopic = sent.strip()
                if len(subtopic) > 50:
                    # Get first clause or phrase
                    subtopic = subtopic[:50].strip()
                    if ' ' in subtopic:
                        subtopic = ' '.join(subtopic.split()[:-1]) + '...'
                
                if subtopic and subtopic not in subtopics:
                    subtopics.append(subtopic)
            
            if subtopics:
                branches.append({
                    'topic': branch_topic,
                    'subtopics': subtopics
                })
        
        # Ensure we have at least 3 branches
        if len(branches) < 3 and key_terms:
            for i in range(3 - len(branches)):
                if i < len(key_terms):
                    branches.append({
                        'topic': key_terms[i].capitalize(),
                        'subtopics': [sentences[min(i, len(sentences)-1)][:50] + '...']
                    })
        
        mindmap = {
            'central_topic': central_topic,
            'branches': branches
        }
        
        print(f"✅ Generated mindmap with {len(branches)} branches")
        
        return jsonify({
            'success': True,
            'mindmap': mindmap,
            'generated_by': 'fallback',
            'message': 'Mindmap generated from document structure'
        })
        
    except Exception as e:
        print(f"❌ Mindmap generation error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@mindmap_bp.route('/document/<document_id>', methods=['GET'])
def get_mindmap(document_id):
    try:
        # TODO: Fetch mindmap from database if stored
        return jsonify({
            'success': True,
            'mindmap': None,
            'message': 'Mindmap retrieval endpoint'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500