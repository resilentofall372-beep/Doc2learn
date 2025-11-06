# backend/models/database.py - FIXED DATABASE INITIALIZATION
from flask_pymongo import PyMongo
from pymongo import MongoClient
import os
from datetime import datetime
import uuid
from bson import ObjectId

mongo = PyMongo()

class Database:
    def __init__(self, app=None):
        self.app = app
        self.db = None
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        try:
            mongo.init_app(app)
            self.db = mongo.db
            self._create_indexes()
            print("✅ MongoDB connected successfully")
        except Exception as e:
            print(f"❌ MongoDB connection failed: {e}")
            self.db = None
    
    def _create_indexes(self):
        """Create database indexes for better performance"""
        try:
            if self.db is not None:
                # Create indexes for documents collection
                self.db.documents.create_index("user_id")
                self.db.documents.create_index("uploaded_on")
                print("✅ Database indexes created")
            else:
                print("⚠️ Cannot create indexes - database not connected")
        except Exception as e:
            print(f"⚠️ Index creation warning: {e}")
    
    def get_db(self):
        if self.db is None:
            print("⚠️ Database not initialized - returning None")
        return self.db

    def is_connected(self):
        return self.db is not None

# MongoDB collections
class Collections:
    USERS = "users"
    DOCUMENTS = "documents"
    QUIZZES = "quizzes"
    ROOMS = "rooms"
    FLASHCARDS = "flashcards"
    MINDMAPS = "mindmaps"

# Database Model Classes
class DocumentModel:
    @staticmethod
    def create_document(db, document_data):
        if db is None:
            raise Exception("Database not connected")
        return db[Collections.DOCUMENTS].insert_one(document_data)
    
    @staticmethod
    def get_document_by_id(db, document_id):
        try:
            if db is None:
                return None
            return db[Collections.DOCUMENTS].find_one({'_id': ObjectId(document_id)})
        except:
            return None
    
    @staticmethod
    def get_user_documents(db, user_id):
        if db is None:
            return []
        return list(db[Collections.DOCUMENTS].find({'user_id': user_id}).sort('uploaded_on', -1))
    
    @staticmethod
    def update_document_text(db, document_id, extracted_text):
        if db is None:
            raise Exception("Database not connected")
        return db[Collections.DOCUMENTS].update_one(
            {'_id': ObjectId(document_id)},
            {'$set': {
                'extracted_text': extracted_text,
                'processed_at': datetime.utcnow(),
                'is_processed': True
            }}
        )

class QuizModel:
    @staticmethod
    def create_quiz(db, quiz_data):
        if db is None:
            raise Exception("Database not connected")
        return db[Collections.QUIZZES].insert_one(quiz_data)
    
    @staticmethod
    def get_quizzes_by_document(db, document_id):
        if db is None:
            return []
        return list(db[Collections.QUIZZES].find({'document_id': document_id}).sort('created_at', -1))
    
    @staticmethod
    def get_quiz_by_id(db, quiz_id):
        try:
            if db is None:
                return None
            return db[Collections.QUIZZES].find_one({'_id': ObjectId(quiz_id)})
        except:
            return None

class FlashcardModel:
    @staticmethod
    def create_flashcards(db, flashcards_data):
        if db is None:
            raise Exception("Database not connected")
        return db[Collections.FLASHCARDS].insert_many(flashcards_data)
    
    @staticmethod
    def get_flashcards_by_document(db, document_id):
        if db is None:
            return []
        return list(db[Collections.FLASHCARDS].find({'document_id': document_id}))

class MindmapModel:
    @staticmethod
    def create_mindmap(db, mindmap_data):
        if db is None:
            raise Exception("Database not connected")
        return db[Collections.MINDMAPS].insert_one(mindmap_data)
    
    @staticmethod
    def get_mindmap_by_document(db, document_id):
        if db is None:
            return None
        return db[Collections.MINDMAPS].find_one({'document_id': document_id})

# Initialize database instance
db_instance = Database()

# Standalone get_db function for imports
def get_db():
    """Get database instance for use in routes"""
    return db_instance.get_db()