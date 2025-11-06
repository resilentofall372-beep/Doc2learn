# backend/models/chat.py
from datetime import datetime
from bson import ObjectId

class ChatModel:
    """Model for AI assistant chat history"""
    
    @staticmethod
    def create_chat_session(db, document_id, user_id):
        """Create a new chat session"""
        session = {
            'document_id': document_id,
            'user_id': user_id,
            'created_at': datetime.utcnow(),
            'last_activity': datetime.utcnow(),
            'messages': []
        }
        result = db['CHAT_SESSIONS'].insert_one(session)
        return str(result.inserted_id)
    
    @staticmethod
    def get_chat_session(db, document_id, user_id):
        """Get existing chat session or create new one"""
        session = db['CHAT_SESSIONS'].find_one({
            'document_id': document_id,
            'user_id': user_id
        })
        
        if not session:
            session_id = ChatModel.create_chat_session(db, document_id, user_id)
            session = db['CHAT_SESSIONS'].find_one({'_id': ObjectId(session_id)})
        
        return session
    
    @staticmethod
    def add_message(db, session_id, role, content, metadata=None):
        """Add a message to chat session"""
        message = {
            'role': role,  # 'user' or 'assistant'
            'content': content,
            'timestamp': datetime.utcnow(),
            'metadata': metadata or {}
        }
        
        db['CHAT_SESSIONS'].update_one(
            {'_id': ObjectId(session_id)},
            {
                '$push': {'messages': message},
                '$set': {'last_activity': datetime.utcnow()}
            }
        )
        
        return message
    
    @staticmethod
    def get_chat_history(db, session_id, limit=50):
        """Get chat history for a session"""
        session = db['CHAT_SESSIONS'].find_one({'_id': ObjectId(session_id)})
        if not session:
            return []
        
        messages = session.get('messages', [])
        return messages[-limit:]  # Return last N messages
    
    @staticmethod
    def clear_chat_history(db, session_id):
        """Clear chat history but keep session"""
        db['CHAT_SESSIONS'].update_one(
            {'_id': ObjectId(session_id)},
            {'$set': {'messages': [], 'last_activity': datetime.utcnow()}}
        )
    
    @staticmethod
    def delete_chat_session(db, session_id):
        """Delete entire chat session"""
        db['CHAT_SESSIONS'].delete_one({'_id': ObjectId(session_id)})
