# backend/routes/assistant.py
"""
AI Study Assistant Routes
Endpoints for chat, explanations, practice problems, summaries, and study plans
"""

from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..models.database import db_instance
from ..models.chat import ChatModel
from ..models.database import DocumentModel
from ..services.assistant_service import AssistantService

assistant_bp = Blueprint('assistant', __name__, url_prefix='/api/assistant')
assistant_service = AssistantService()

@assistant_bp.route('/chat', methods=['POST'])
def chat_with_document():
    """
    Chat with a document using RAG
    Body: {document_id, user_id, question}
    """
    try:
        data = request.json
        document_id = data.get('document_id')
        user_id = data.get('user_id')
        question = data.get('question', '').strip()
        
        if not document_id or not question:
            return jsonify({'error': 'document_id and question are required'}), 400
        
        db = db_instance.get_db()
        
        # Get document
        document = DocumentModel.get_document_by_id(db, document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        document_text = document.get('extracted_text', '')
        if not document_text:
            return jsonify({'error': 'Document has no text content'}), 400
        
        # Get or create chat session
        session = ChatModel.get_chat_session(db, document_id, user_id)
        session_id = str(session['_id'])
        
        # Get chat history
        chat_history = ChatModel.get_chat_history(db, session_id)
        
        # Add user message
        ChatModel.add_message(db, session_id, 'user', question)
        
        # Get AI response
        result = assistant_service.chat_with_document(
            document_text, 
            question, 
            document_id,
            chat_history
        )
        
        # Add assistant message
        ChatModel.add_message(
            db, 
            session_id, 
            'assistant', 
            result['answer'],
            metadata={
                'sources': result.get('sources', []),
                'confidence': result.get('confidence', 'medium')
            }
        )
        
        return jsonify({
            'success': True,
            'answer': result['answer'],
            'sources': result.get('sources', []),
            'confidence': result.get('confidence', 'medium'),
            'session_id': session_id
        }), 200
        
    except Exception as e:
        print(f"❌ Chat error: {e}")
        return jsonify({'error': str(e)}), 500

@assistant_bp.route('/explain', methods=['POST'])
def explain_concept():
    """
    Explain a concept from the document
    Body: {document_id, concept}
    """
    try:
        data = request.json
        document_id = data.get('document_id')
        concept = data.get('concept', '').strip()
        
        if not document_id or not concept:
            return jsonify({'error': 'document_id and concept are required'}), 400
        
        db = db_instance.get_db()
        
        # Get document
        document = DocumentModel.get_document_by_id(db, document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        document_text = document.get('extracted_text', '')
        
        # Get explanation
        result = assistant_service.explain_concept(document_text, concept, document_id)
        
        return jsonify({
            'success': True,
            **result
        }), 200
        
    except Exception as e:
        print(f"❌ Explain error: {e}")
        return jsonify({'error': str(e)}), 500

@assistant_bp.route('/practice', methods=['POST'])
def generate_practice():
    """
    Generate practice problems
    Body: {document_id, topic, num_problems}
    """
    try:
        data = request.json
        document_id = data.get('document_id')
        topic = data.get('topic', 'general')
        num_problems = data.get('num_problems', 5)
        
        if not document_id:
            return jsonify({'error': 'document_id is required'}), 400
        
        db = db_instance.get_db()
        
        # Get document
        document = DocumentModel.get_document_by_id(db, document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        document_text = document.get('extracted_text', '')
        
        # Generate practice problems
        result = assistant_service.generate_practice_problems(
            document_text, 
            topic, 
            document_id,
            num_problems
        )
        
        return jsonify({
            'success': True,
            **result
        }), 200
        
    except Exception as e:
        print(f"❌ Practice generation error: {e}")
        return jsonify({'error': str(e)}), 500

@assistant_bp.route('/summarize', methods=['POST'])
def summarize_document():
    """
    Summarize document
    Body: {document_id, summary_type}
    """
    try:
        data = request.json
        document_id = data.get('document_id')
        summary_type = data.get('summary_type', 'brief')  # 'brief' or 'detailed'
        
        if not document_id:
            return jsonify({'error': 'document_id is required'}), 400
        
        db = db_instance.get_db()
        
        # Get document
        document = DocumentModel.get_document_by_id(db, document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        document_text = document.get('extracted_text', '')
        
        # Generate summary
        result = assistant_service.summarize_document(document_text, summary_type)
        
        return jsonify({
            'success': True,
            **result
        }), 200
        
    except Exception as e:
        print(f"❌ Summarize error: {e}")
        return jsonify({'error': str(e)}), 500

@assistant_bp.route('/study-plan', methods=['POST'])
def create_study_plan():
    """
    Create personalized study plan
    Body: {document_id, user_id, weak_areas, days}
    """
    try:
        data = request.json
        document_id = data.get('document_id')
        user_id = data.get('user_id')
        weak_areas = data.get('weak_areas', [])
        days = data.get('days', 7)
        
        if not document_id:
            return jsonify({'error': 'document_id is required'}), 400
        
        db = db_instance.get_db()
        
        # Get document
        document = DocumentModel.get_document_by_id(db, document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        document_text = document.get('extracted_text', '')
        
        # Create study plan
        result = assistant_service.create_study_plan(
            weak_areas, 
            document_text, 
            document_id,
            days
        )
        
        return jsonify({
            'success': True,
            **result
        }), 200
        
    except Exception as e:
        print(f"❌ Study plan error: {e}")
        return jsonify({'error': str(e)}), 500

@assistant_bp.route('/chat/history/<document_id>/<user_id>', methods=['GET'])
def get_chat_history(document_id, user_id):
    """Get chat history for a document and user"""
    try:
        db = db_instance.get_db()
        
        # Get session
        session = ChatModel.get_chat_session(db, document_id, user_id)
        if not session:
            return jsonify({'messages': []}), 200
        
        # Get history
        messages = ChatModel.get_chat_history(db, str(session['_id']))
        
        # Format messages
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                'role': msg['role'],
                'content': msg['content'],
                'timestamp': msg['timestamp'].isoformat() if msg.get('timestamp') else None,
                'metadata': msg.get('metadata', {})
            })
        
        return jsonify({
            'success': True,
            'messages': formatted_messages,
            'session_id': str(session['_id'])
        }), 200
        
    except Exception as e:
        print(f"❌ Get history error: {e}")
        return jsonify({'error': str(e)}), 500

@assistant_bp.route('/chat/clear', methods=['POST'])
def clear_chat():
    """Clear chat history"""
    try:
        data = request.json
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({'error': 'session_id is required'}), 400
        
        db = db_instance.get_db()
        ChatModel.clear_chat_history(db, session_id)
        
        return jsonify({
            'success': True,
            'message': 'Chat history cleared'
        }), 200
        
    except Exception as e:
        print(f"❌ Clear chat error: {e}")
        return jsonify({'error': str(e)}), 500
