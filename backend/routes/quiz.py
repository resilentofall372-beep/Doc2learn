# backend/routes/quiz.py - FIXED
from flask import Blueprint, request, jsonify
from datetime import datetime
from bson import ObjectId
from backend.models.database import db_instance, Collections

quiz_bp = Blueprint('quiz', __name__)

@quiz_bp.route('/submit', methods=['POST'])
def submit_quiz():
    try:
        data = request.json
        quiz_id = data.get('quiz_id')
        user_answers = data.get('answers', {})
        time_taken = data.get('time_taken', 0)
        
        if not db_instance.get_db():
            return jsonify({'error': 'Database not connected'}), 500
            
        # Get quiz from MongoDB
        quiz = db_instance.get_db()[Collections.QUIZZES].find_one({'_id': ObjectId(quiz_id)})
        if not quiz:
            return jsonify({'error': 'Quiz not found'}), 404
        
        # Calculate score
        score = 0
        results = []
        
        for i, question in enumerate(quiz.get('questions', [])):
            user_answer = user_answers.get(str(i))
            correct_answer = question.get('answer')
            is_correct = user_answer == correct_answer
            
            if is_correct:
                score += 1
            
            results.append({
                'question_index': i,
                'question': question.get('question'),
                'user_answer': user_answer,
                'correct_answer': correct_answer,
                'is_correct': is_correct,
                'explanation': question.get('explanation', '')
            })
        
        total_questions = len(quiz.get('questions', []))
        percentage = (score / total_questions) * 100 if total_questions > 0 else 0
        
        # Update quiz with results
        db_instance.get_db()[Collections.QUIZZES].update_one(
            {'_id': ObjectId(quiz_id)},
            {'$set': {
                'submitted_at': datetime.utcnow(),
                'score': score,
                'total_questions': total_questions,
                'percentage': percentage,
                'time_taken': time_taken,
                'user_answers': user_answers,
                'results': results
            }}
        )
        
        return jsonify({
            'success': True,
            'score': score,
            'total_questions': total_questions,
            'percentage': percentage,
            'time_taken': time_taken,
            'results': results,
            'message': 'Quiz submitted successfully'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quiz_bp.route('/<quiz_id>', methods=['GET'])
def get_quiz(quiz_id):
    try:
        if not db_instance.get_db():
            return jsonify({'error': 'Database not connected'}), 500
            
        quiz = db_instance.get_db()[Collections.QUIZZES].find_one({'_id': ObjectId(quiz_id)})
        if not quiz:
            return jsonify({'error': 'Quiz not found'}), 404
        
        # Convert ObjectId to string
        quiz['_id'] = str(quiz['_id'])
        
        return jsonify({
            'success': True,
            'quiz': quiz
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quiz_bp.route('/document/<document_id>', methods=['GET'])
def get_document_quizzes(document_id):
    try:
        if not db_instance.get_db():
            return jsonify({'error': 'Database not connected'}), 500
            
        quizzes = list(db_instance.get_db()[Collections.QUIZZES].find({'document_id': document_id}).sort('created_at', -1))
        
        # Convert ObjectIds to strings
        for quiz in quizzes:
            quiz['_id'] = str(quiz['_id'])
        
        return jsonify({
            'success': True,
            'quizzes': quizzes
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500