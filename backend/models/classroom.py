"""
Classroom Model for Faculty-Led Battles
Supports Mode 3: Classroom/Assignment Mode
"""
from datetime import datetime
from bson import ObjectId

class Classroom:
    """Classroom management for faculty-controlled battles"""
    
    @staticmethod
    def create_classroom(db, data):
        """Create a new classroom"""
        classroom = {
            "classroom_id": str(ObjectId()),
            "faculty_id": data.get('faculty_id'),
            "faculty_name": data.get('faculty_name'),
            "classroom_name": data.get('classroom_name'),
            "subject": data.get('subject'),
            "topic": data.get('topic'),
            "student_list": data.get('student_list', []),  # Array of student IDs
            "batch": data.get('batch'),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "is_active": True,
            "settings": {
                "allow_peer_battles": data.get('allow_peer_battles', True),
                "leaderboard_visible": data.get('leaderboard_visible', True),
                "ai_explanations": data.get('ai_explanations', True)
            }
        }
        
        result = db.CLASSROOMS.insert_one(classroom)
        classroom['_id'] = result.inserted_id
        return classroom
    
    @staticmethod
    def add_students(db, classroom_id, student_ids):
        """Add students to classroom"""
        return db.CLASSROOMS.update_one(
            {"classroom_id": classroom_id},
            {
                "$addToSet": {"student_list": {"$each": student_ids}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
    
    @staticmethod
    def remove_students(db, classroom_id, student_ids):
        """Remove students from classroom"""
        return db.CLASSROOMS.update_one(
            {"classroom_id": classroom_id},
            {
                "$pull": {"student_list": {"$in": student_ids}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
    
    @staticmethod
    def get_classroom(db, classroom_id):
        """Get classroom by ID"""
        return db.CLASSROOMS.find_one({"classroom_id": classroom_id})
    
    @staticmethod
    def get_faculty_classrooms(db, faculty_id):
        """Get all classrooms for a faculty"""
        return list(db.CLASSROOMS.find({"faculty_id": faculty_id, "is_active": True}))
    
    @staticmethod
    def get_student_classrooms(db, student_id):
        """Get all classrooms a student belongs to"""
        return list(db.CLASSROOMS.find({"student_list": student_id, "is_active": True}))


class ScheduledQuiz:
    """Scheduled quiz management for classrooms"""
    
    @staticmethod
    def create_scheduled_quiz(db, data):
        """Create a scheduled quiz"""
        quiz = {
            "quiz_id": str(ObjectId()),
            "classroom_id": data.get('classroom_id'),
            "faculty_id": data.get('faculty_id'),
            "title": data.get('title'),
            "description": data.get('description'),
            "topic": data.get('topic'),
            "subtopics": data.get('subtopics', []),
            "difficulty": data.get('difficulty', 'medium'),  # easy/medium/hard/adaptive
            "total_questions": data.get('total_questions', 10),
            "time_per_question": data.get('time_per_question', 30),
            "quiz_type": data.get('quiz_type', 'ai'),  # ai or manual
            "release_date": data.get('release_date'),  # ISO datetime
            "due_date": data.get('due_date'),  # ISO datetime
            "attempt_window_hours": data.get('attempt_window_hours', 72),
            "randomize_questions": data.get('randomize_questions', True),
            "randomize_options": data.get('randomize_options', True),
            "show_ai_explanations": data.get('show_ai_explanations', True),
            "allow_retakes": data.get('allow_retakes', False),
            "max_attempts": data.get('max_attempts', 1),
            "questions": data.get('questions', []),  # Pre-loaded or empty for AI
            "status": "scheduled",  # scheduled/active/completed/cancelled
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = db.SCHEDULED_QUIZZES.insert_one(quiz)
        quiz['_id'] = result.inserted_id
        return quiz
    
    @staticmethod
    def create_instant_quiz(db, data):
        """Create an instant quiz (immediate release)"""
        quiz_data = data.copy()
        quiz_data['release_date'] = datetime.utcnow()
        quiz_data['due_date'] = datetime.utcnow()  # Instant means now
        quiz_data['status'] = 'active'
        
        quiz = ScheduledQuiz.create_scheduled_quiz(db, quiz_data)
        
        # Mark as instant for Firebase notification
        db.SCHEDULED_QUIZZES.update_one(
            {"quiz_id": quiz['quiz_id']},
            {"$set": {"is_instant": True}}
        )
        
        return quiz
    
    @staticmethod
    def get_quiz(db, quiz_id):
        """Get quiz by ID"""
        return db.SCHEDULED_QUIZZES.find_one({"quiz_id": quiz_id})
    
    @staticmethod
    def get_classroom_quizzes(db, classroom_id, status=None):
        """Get all quizzes for a classroom"""
        query = {"classroom_id": classroom_id}
        if status:
            query['status'] = status
        return list(db.SCHEDULED_QUIZZES.find(query).sort("created_at", -1))
    
    @staticmethod
    def update_quiz_status(db, quiz_id, status):
        """Update quiz status"""
        return db.SCHEDULED_QUIZZES.update_one(
            {"quiz_id": quiz_id},
            {
                "$set": {
                    "status": status,
                    "updated_at": datetime.utcnow()
                }
            }
        )


class QuizAttempt:
    """Student quiz attempts for scheduled/instant quizzes"""
    
    @staticmethod
    def create_attempt(db, data):
        """Record a quiz attempt"""
        attempt = {
            "attempt_id": str(ObjectId()),
            "quiz_id": data.get('quiz_id'),
            "classroom_id": data.get('classroom_id'),
            "student_id": data.get('student_id'),
            "student_name": data.get('student_name'),
            "started_at": datetime.utcnow(),
            "completed_at": None,
            "time_taken_seconds": 0,
            "score": 0,
            "total_questions": data.get('total_questions', 0),
            "correct_answers": 0,
            "answers": [],  # Array of {question_id, selected_answer, is_correct, time_taken}
            "xp_earned": 0,
            "status": "in_progress",  # in_progress/completed/abandoned
            "created_at": datetime.utcnow()
        }
        
        result = db.QUIZ_ATTEMPTS.insert_one(attempt)
        attempt['_id'] = result.inserted_id
        return attempt
    
    @staticmethod
    def submit_answer(db, attempt_id, answer_data):
        """Submit an answer for a question"""
        return db.QUIZ_ATTEMPTS.update_one(
            {"attempt_id": attempt_id},
            {
                "$push": {"answers": answer_data},
                "$inc": {
                    "correct_answers": 1 if answer_data.get('is_correct') else 0
                }
            }
        )
    
    @staticmethod
    def complete_attempt(db, attempt_id, final_data):
        """Mark attempt as complete and calculate final score"""
        return db.QUIZ_ATTEMPTS.update_one(
            {"attempt_id": attempt_id},
            {
                "$set": {
                    "completed_at": datetime.utcnow(),
                    "time_taken_seconds": final_data.get('time_taken_seconds'),
                    "score": final_data.get('score'),
                    "xp_earned": final_data.get('xp_earned'),
                    "status": "completed"
                }
            }
        )
    
    @staticmethod
    def get_student_attempts(db, quiz_id, student_id):
        """Get all attempts by a student for a quiz"""
        return list(db.QUIZ_ATTEMPTS.find({
            "quiz_id": quiz_id,
            "student_id": student_id
        }).sort("created_at", -1))
    
    @staticmethod
    def get_quiz_attempts(db, quiz_id):
        """Get all attempts for a quiz"""
        return list(db.QUIZ_ATTEMPTS.find({"quiz_id": quiz_id}))


class UserProgress:
    """Track student progress, XP, streaks, badges"""
    
    @staticmethod
    def get_or_create_progress(db, user_id):
        """Get or create user progress document"""
        progress = db.USER_PROGRESS.find_one({"user_id": user_id})
        
        if not progress:
            progress = {
                "user_id": user_id,
                "total_xp": 0,
                "level": 1,
                "current_streak": 0,
                "longest_streak": 0,
                "last_activity_date": None,
                "battles_participated": 0,
                "battles_won": 0,
                "total_questions_answered": 0,
                "total_correct_answers": 0,
                "badges": [],
                "weak_topics": {},  # {topic: {correct: X, total: Y, accuracy: Z}}
                "strong_topics": {},
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            result = db.USER_PROGRESS.insert_one(progress)
            progress['_id'] = result.inserted_id
        
        return progress
    
    @staticmethod
    def add_xp(db, user_id, xp_amount):
        """Add XP and update level"""
        progress = UserProgress.get_or_create_progress(db, user_id)
        new_xp = progress['total_xp'] + xp_amount
        new_level = (new_xp // 100) + 1  # 100 XP per level
        
        return db.USER_PROGRESS.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "total_xp": new_xp,
                    "level": new_level,
                    "updated_at": datetime.utcnow()
                }
            }
        )
    
    @staticmethod
    def update_streak(db, user_id):
        """Update daily streak"""
        progress = UserProgress.get_or_create_progress(db, user_id)
        today = datetime.utcnow().date()
        last_activity = progress.get('last_activity_date')
        
        if last_activity:
            last_date = last_activity.date() if isinstance(last_activity, datetime) else last_activity
            days_diff = (today - last_date).days
            
            if days_diff == 1:
                # Continue streak
                new_streak = progress['current_streak'] + 1
            elif days_diff == 0:
                # Same day, no change
                new_streak = progress['current_streak']
            else:
                # Streak broken
                new_streak = 1
        else:
            new_streak = 1
        
        longest_streak = max(progress.get('longest_streak', 0), new_streak)
        
        return db.USER_PROGRESS.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "current_streak": new_streak,
                    "longest_streak": longest_streak,
                    "last_activity_date": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
    
    @staticmethod
    def update_topic_accuracy(db, user_id, topic, is_correct):
        """Update weak/strong topics based on performance"""
        field_key = f"weak_topics.{topic}"
        
        return db.USER_PROGRESS.update_one(
            {"user_id": user_id},
            {
                "$inc": {
                    f"{field_key}.total": 1,
                    f"{field_key}.correct": 1 if is_correct else 0
                },
                "$set": {"updated_at": datetime.utcnow()}
            },
            upsert=True
        )
