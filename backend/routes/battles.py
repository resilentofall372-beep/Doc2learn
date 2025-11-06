"""
Battle Routes - AI Study Room Battles
Supports 3 modes:
1. Host Mode (Teacher-Led Live Quiz)
2. Friends Mode (Peer-to-Peer)
3. Classroom Mode (Faculty-Controlled Scheduled/Instant)
"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime, timedelta
import random
import string
from ..models.database import get_db
from ..models.classroom import Classroom, ScheduledQuiz, QuizAttempt, UserProgress
from ..services.nlp_service import generate_quiz_questions

battles_bp = Blueprint('battles', __name__)

def generate_battle_code():
    """Generate unique 6-character battle code"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


# ==================== MODE 1 & 2: HOST MODE & FRIENDS MODE ====================

@battles_bp.route('/battle/create', methods=['POST'])
def create_battle():
    """
    Create a battle room (Host Mode or Friends Mode)
    
    Request Body:
    {
        "mode": "host" or "friends",
        "creator_id": "user_id",
        "creator_name": "John Doe",
        "title": "Math Battle",
        "topic": "Algebra",
        "subtopics": ["Linear Equations", "Quadratic"],
        "difficulty": "medium",
        "total_questions": 10,
        "time_per_question": 30,
        "randomize_questions": true,
        "randomize_options": true,
        "quiz_type": "ai" or "manual",
        "questions": [] (if manual),
        "max_participants": 50
    }
    """
    try:
        db = get_db()
        data = request.json
        
        battle_code = generate_battle_code()
        
        battle = {
            "battle_id": str(ObjectId()),
            "battle_code": battle_code,
            "mode": data.get('mode', 'friends'),  # host or friends
            "creator_id": data.get('creator_id'),
            "creator_name": data.get('creator_name'),
            "title": data.get('title'),
            "topic": data.get('topic'),
            "subtopics": data.get('subtopics', []),
            "difficulty": data.get('difficulty', 'medium'),
            "total_questions": data.get('total_questions', 10),
            "time_per_question": data.get('time_per_question', 30),
            "randomize_questions": data.get('randomize_questions', True),
            "randomize_options": data.get('randomize_options', True),
            "quiz_type": data.get('quiz_type', 'ai'),
            "questions": data.get('questions', []),
            "max_participants": data.get('max_participants', 50),
            "participants": [],
            "battle_state": "lobby",  # lobby, in_progress, completed
            "current_question_index": 0,
            "leaderboard": [],
            "created_at": datetime.utcnow(),
            "started_at": None,
            "completed_at": None
        }
        
        result = db.BATTLES.insert_one(battle)
        battle['_id'] = str(result.inserted_id)
        
        return jsonify({
            "success": True,
            "battle": battle,
            "message": f"Battle room created! Code: {battle_code}"
        }), 201
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@battles_bp.route('/battle/join/<battle_code>', methods=['POST'])
def join_battle(battle_code):
    """
    Join a battle room
    
    Request Body:
    {
        "user_id": "user_123",
        "user_name": "John Doe",
        "avatar": "🎯"
    }
    """
    try:
        db = get_db()
        data = request.json
        
        battle = db.BATTLES.find_one({"battle_code": battle_code})
        
        if not battle:
            return jsonify({"success": False, "error": "Battle not found"}), 404
        
        if battle['battle_state'] != 'lobby':
            return jsonify({"success": False, "error": "Battle already started"}), 400
        
        if len(battle['participants']) >= battle['max_participants']:
            return jsonify({"success": False, "error": "Battle is full"}), 400
        
        # Check if user already joined
        user_exists = any(p['user_id'] == data['user_id'] for p in battle['participants'])
        if user_exists:
            return jsonify({"success": False, "error": "Already joined"}), 400
        
        participant = {
            "user_id": data['user_id'],
            "user_name": data['user_name'],
            "avatar": data.get('avatar', '👤'),
            "score": 0,
            "correct_answers": 0,
            "joined_at": datetime.utcnow()
        }
        
        db.BATTLES.update_one(
            {"battle_code": battle_code},
            {"$push": {"participants": participant}}
        )
        
        battle = db.BATTLES.find_one({"battle_code": battle_code})
        battle['_id'] = str(battle['_id'])
        
        return jsonify({
            "success": True,
            "battle": battle,
            "message": f"{data['user_name']} joined the battle!"
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@battles_bp.route('/battle/<battle_id>/generate-questions', methods=['POST'])
def generate_battle_questions(battle_id):
    """Generate AI questions for the battle"""
    try:
        db = get_db()
        battle = db.BATTLES.find_one({"battle_id": battle_id})
        
        if not battle:
            return jsonify({"success": False, "error": "Battle not found"}), 404
        
        if battle['quiz_type'] == 'manual':
            return jsonify({
                "success": True,
                "questions": battle['questions'],
                "message": "Using manual questions"
            }), 200
        
        # Generate AI questions
        context = f"Generate quiz questions about {battle['topic']}"
        if battle.get('subtopics'):
            context += f" focusing on: {', '.join(battle['subtopics'])}"
        
        questions = generate_quiz_questions(
            context=context,
            num_questions=battle['total_questions'],
            difficulty=battle['difficulty']
        )
        
        # Update battle with questions
        db.BATTLES.update_one(
            {"battle_id": battle_id},
            {"$set": {"questions": questions}}
        )
        
        return jsonify({
            "success": True,
            "questions": questions,
            "message": f"Generated {len(questions)} AI questions"
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@battles_bp.route('/battle/<battle_id>/start', methods=['POST'])
def start_battle(battle_id):
    """Start the battle (Host only)"""
    try:
        db = get_db()
        data = request.json
        
        battle = db.BATTLES.find_one({"battle_id": battle_id})
        
        if not battle:
            return jsonify({"success": False, "error": "Battle not found"}), 404
        
        # Verify creator
        if battle['creator_id'] != data.get('creator_id'):
            return jsonify({"success": False, "error": "Only host can start"}), 403
        
        if len(battle['participants']) < 2:
            return jsonify({"success": False, "error": "Need at least 2 participants"}), 400
        
        if not battle.get('questions') or len(battle['questions']) == 0:
            return jsonify({"success": False, "error": "No questions loaded"}), 400
        
        # Update battle state
        db.BATTLES.update_one(
            {"battle_id": battle_id},
            {
                "$set": {
                    "battle_state": "in_progress",
                    "started_at": datetime.utcnow(),
                    "current_question_index": 0
                }
            }
        )
        
        return jsonify({
            "success": True,
            "message": "Battle started!",
            "first_question": battle['questions'][0]
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ==================== MODE 3: CLASSROOM MODE ====================

@battles_bp.route('/classroom/create', methods=['POST'])
def create_classroom():
    """
    Create a classroom
    
    Request Body:
    {
        "faculty_id": "fac_001",
        "faculty_name": "Prof. Smith",
        "classroom_name": "Data Structures 101",
        "subject": "Computer Science",
        "topic": "Data Structures",
        "student_list": ["stu_001", "stu_002"],
        "batch": "2024-CS-A"
    }
    """
    try:
        db = get_db()
        data = request.json
        
        classroom = Classroom.create_classroom(db, data)
        classroom['_id'] = str(classroom['_id'])
        
        return jsonify({
            "success": True,
            "classroom": classroom,
            "message": "Classroom created successfully"
        }), 201
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@battles_bp.route('/classroom/<classroom_id>/add-students', methods=['POST'])
def add_students_to_classroom(classroom_id):
    """Add students to classroom"""
    try:
        db = get_db()
        data = request.json
        
        Classroom.add_students(db, classroom_id, data['student_ids'])
        
        return jsonify({
            "success": True,
            "message": f"Added {len(data['student_ids'])} students"
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@battles_bp.route('/classroom/<classroom_id>/scheduled-quiz', methods=['POST'])
def create_scheduled_quiz(classroom_id):
    """
    Create a scheduled quiz for classroom
    
    Request Body:
    {
        "faculty_id": "fac_001",
        "title": "Midterm Quiz",
        "description": "Covers topics 1-5",
        "topic": "Networking",
        "subtopics": ["OSI Model", "TCP/IP"],
        "difficulty": "medium",
        "total_questions": 20,
        "time_per_question": 45,
        "quiz_type": "ai",
        "release_date": "2025-09-20T10:00:00Z",
        "due_date": "2025-09-25T23:59:59Z",
        "randomize_questions": true,
        "show_ai_explanations": true
    }
    """
    try:
        db = get_db()
        data = request.json
        data['classroom_id'] = classroom_id
        
        quiz = ScheduledQuiz.create_scheduled_quiz(db, data)
        quiz['_id'] = str(quiz['_id'])
        
        return jsonify({
            "success": True,
            "quiz": quiz,
            "message": "Scheduled quiz created"
        }), 201
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@battles_bp.route('/classroom/<classroom_id>/instant-quiz', methods=['POST'])
def create_instant_quiz(classroom_id):
    """
    Create an instant quiz (releases immediately)
    Similar to scheduled but instant
    """
    try:
        db = get_db()
        data = request.json
        data['classroom_id'] = classroom_id
        
        quiz = ScheduledQuiz.create_instant_quiz(db, data)
        quiz['_id'] = str(quiz['_id'])
        
        # TODO: Send Firebase notification to all students in classroom
        
        return jsonify({
            "success": True,
            "quiz": quiz,
            "message": "Instant quiz created and released!"
        }), 201
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@battles_bp.route('/quiz/<quiz_id>/start-attempt', methods=['POST'])
def start_quiz_attempt(quiz_id):
    """Student starts attempting a scheduled/instant quiz"""
    try:
        db = get_db()
        data = request.json
        
        quiz = ScheduledQuiz.get_quiz(db, quiz_id)
        
        if not quiz:
            return jsonify({"success": False, "error": "Quiz not found"}), 404
        
        # Check if quiz is available
        now = datetime.utcnow()
        if quiz['status'] != 'active' and now < quiz.get('release_date', now):
            return jsonify({"success": False, "error": "Quiz not yet available"}), 400
        
        # Check attempts limit
        previous_attempts = QuizAttempt.get_student_attempts(db, quiz_id, data['student_id'])
        if len(previous_attempts) >= quiz.get('max_attempts', 1) and not quiz.get('allow_retakes'):
            return jsonify({"success": False, "error": "Max attempts reached"}), 400
        
        # Create attempt
        attempt_data = {
            "quiz_id": quiz_id,
            "classroom_id": quiz['classroom_id'],
            "student_id": data['student_id'],
            "student_name": data['student_name'],
            "total_questions": quiz['total_questions']
        }
        
        attempt = QuizAttempt.create_attempt(db, attempt_data)
        attempt['_id'] = str(attempt['_id'])
        
        # Get questions (randomize if needed)
        questions = quiz['questions']
        if quiz.get('randomize_questions'):
            questions = random.sample(questions, len(questions))
        
        return jsonify({
            "success": True,
            "attempt": attempt,
            "questions": questions,
            "message": "Quiz attempt started"
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@battles_bp.route('/attempt/<attempt_id>/submit-answer', methods=['POST'])
def submit_quiz_answer(attempt_id):
    """Submit answer for a question in quiz attempt"""
    try:
        db = get_db()
        data = request.json
        
        answer_data = {
            "question_id": data['question_id'],
            "question_text": data.get('question_text'),
            "selected_answer": data['selected_answer'],
            "correct_answer": data['correct_answer'],
            "is_correct": data['selected_answer'] == data['correct_answer'],
            "time_taken": data.get('time_taken', 0),
            "timestamp": datetime.utcnow()
        }
        
        QuizAttempt.submit_answer(db, attempt_id, answer_data)
        
        # Update user progress topic accuracy
        if data.get('topic'):
            UserProgress.update_topic_accuracy(
                db,
                data['student_id'],
                data['topic'],
                answer_data['is_correct']
            )
        
        return jsonify({
            "success": True,
            "is_correct": answer_data['is_correct'],
            "message": "Answer submitted"
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@battles_bp.route('/attempt/<attempt_id>/complete', methods=['POST'])
def complete_quiz_attempt(attempt_id):
    """Complete quiz attempt and calculate final score"""
    try:
        db = get_db()
        data = request.json
        
        attempt = db.QUIZ_ATTEMPTS.find_one({"attempt_id": attempt_id})
        
        if not attempt:
            return jsonify({"success": False, "error": "Attempt not found"}), 404
        
        # Calculate score and XP
        correct = attempt['correct_answers']
        total = attempt['total_questions']
        accuracy = (correct / total) * 100 if total > 0 else 0
        
        score = correct * 10  # 10 points per correct answer
        xp_earned = int(score * 1.5)  # 1.5x score as XP
        
        final_data = {
            "time_taken_seconds": data.get('time_taken_seconds', 0),
            "score": score,
            "xp_earned": xp_earned
        }
        
        QuizAttempt.complete_attempt(db, attempt_id, final_data)
        
        # Update user progress
        UserProgress.add_xp(db, attempt['student_id'], xp_earned)
        UserProgress.update_streak(db, attempt['student_id'])
        
        # Update battle stats
        db.USER_PROGRESS.update_one(
            {"user_id": attempt['student_id']},
            {
                "$inc": {
                    "battles_participated": 1,
                    "total_questions_answered": total,
                    "total_correct_answers": correct
                }
            }
        )
        
        return jsonify({
            "success": True,
            "score": score,
            "xp_earned": xp_earned,
            "accuracy": accuracy,
            "message": "Quiz completed!"
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ==================== LEADERBOARDS & PROGRESS ====================

@battles_bp.route('/leaderboard/global', methods=['GET'])
def get_global_leaderboard():
    """Get global leaderboard (top 100 users by XP)"""
    try:
        db = get_db()
        
        leaderboard = list(db.USER_PROGRESS.find(
            {},
            {
                "user_id": 1,
                "total_xp": 1,
                "level": 1,
                "current_streak": 1,
                "battles_participated": 1,
                "battles_won": 1
            }
        ).sort("total_xp", -1).limit(100))
        
        for entry in leaderboard:
            entry['_id'] = str(entry['_id'])
        
        return jsonify({
            "success": True,
            "leaderboard": leaderboard
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@battles_bp.route('/leaderboard/classroom/<classroom_id>', methods=['GET'])
def get_classroom_leaderboard(classroom_id):
    """Get classroom-specific leaderboard"""
    try:
        db = get_db()
        
        classroom = Classroom.get_classroom(db, classroom_id)
        if not classroom:
            return jsonify({"success": False, "error": "Classroom not found"}), 404
        
        # Get progress for all students in classroom
        leaderboard = list(db.USER_PROGRESS.find(
            {"user_id": {"$in": classroom['student_list']}},
            {
                "user_id": 1,
                "total_xp": 1,
                "level": 1,
                "current_streak": 1
            }
        ).sort("total_xp", -1))
        
        for entry in leaderboard:
            entry['_id'] = str(entry['_id'])
        
        return jsonify({
            "success": True,
            "classroom_name": classroom['classroom_name'],
            "leaderboard": leaderboard
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@battles_bp.route('/progress/<user_id>', methods=['GET'])
def get_user_progress(user_id):
    """Get user's progress, XP, streaks, weak topics"""
    try:
        db = get_db()
        
        progress = UserProgress.get_or_create_progress(db, user_id)
        progress['_id'] = str(progress['_id'])
        
        # Calculate accuracy
        if progress['total_questions_answered'] > 0:
            progress['overall_accuracy'] = (
                progress['total_correct_answers'] / progress['total_questions_answered']
            ) * 100
        else:
            progress['overall_accuracy'] = 0
        
        return jsonify({
            "success": True,
            "progress": progress
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
