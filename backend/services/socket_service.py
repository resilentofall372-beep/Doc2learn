from flask_socketio import SocketIO, join_room, leave_room, emit
from datetime import datetime
import time

socketio = SocketIO(cors_allowed_origins="*")

# Store active rooms and their data
active_rooms = {}
user_rooms = {}

@socketio.on('connect')
def handle_connect():
    print('✅ Client connected')
    emit('connected', {'message': 'Connected to server', 'timestamp': datetime.utcnow().isoformat()})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('join_room')
def handle_join_room(data):
    try:
        room_id = data['room_id']
        participant_id = data['participant_id']
        participant_name = data.get('participant_name', 'Anonymous')
        
        join_room(room_id)
        
        # Initialize room if it doesn't exist
        if room_id not in active_rooms:
            active_rooms[room_id] = {
                'participants': [],
                'quiz_state': 'lobby',
                'current_question_index': 0,
                'question_start_time': None,
                'answers_submitted': []
            }
        
        # Add participant to room
        participant_exists = False
        for participant in active_rooms[room_id]['participants']:
            if participant['id'] == participant_id:
                participant['name'] = participant_name
                participant_exists = True
                break
        
        if not participant_exists:
            active_rooms[room_id]['participants'].append({
                'id': participant_id,
                'name': participant_name,
                'score': 0,
                'answers': [],
                'is_ready': False
            })
        
        user_rooms[participant_id] = room_id
        
        print(f"👤 {participant_name} joined room {room_id}")
        
        # Notify all participants in the room
        emit('participant_joined', {
            'participant_id': participant_id,
            'participant_name': participant_name,
            'participants': active_rooms[room_id]['participants'],
            'message': f'{participant_name} joined the room',
            'timestamp': datetime.utcnow().isoformat()
        }, room=room_id)
        
    except Exception as e:
        print(f"❌ Error joining room: {e}")
        emit('error', {'message': str(e)})

@socketio.on('leave_room')
def handle_leave_room(data):
    try:
        room_id = data['room_id']
        participant_id = data['participant_id']
        participant_name = data.get('participant_name', 'Anonymous')
        
        leave_room(room_id)
        
        if room_id in active_rooms:
            active_rooms[room_id]['participants'] = [
                p for p in active_rooms[room_id]['participants'] 
                if p['id'] != participant_id
            ]
            
            # Remove room if empty
            if not active_rooms[room_id]['participants']:
                del active_rooms[room_id]
        
        if participant_id in user_rooms:
            del user_rooms[participant_id]
        
        print(f"👋 {participant_name} left room {room_id}")
        
        emit('participant_left', {
            'participant_id': participant_id,
            'participant_name': participant_name,
            'participants': active_rooms.get(room_id, {}).get('participants', []),
            'message': f'{participant_name} left the room',
            'timestamp': datetime.utcnow().isoformat()
        }, room=room_id)
        
    except Exception as e:
        print(f"❌ Error leaving room: {e}")
        emit('error', {'message': str(e)})

@socketio.on('start_quiz')
def handle_start_quiz(data):
    """Host starts the quiz - triggers countdown and first question"""
    try:
        room_id = data['room_id']
        questions = data['questions']
        host_id = data['host_id']
        
        if room_id not in active_rooms:
            emit('error', {'message': 'Room not found'})
            return
        
        # Update room state
        active_rooms[room_id]['quiz_state'] = 'in_progress'
        active_rooms[room_id]['questions'] = questions
        active_rooms[room_id]['current_question_index'] = 0
        active_rooms[room_id]['question_start_time'] = time.time()
        active_rooms[room_id]['answers_submitted'] = []
        
        # Reset all participant scores
        for participant in active_rooms[room_id]['participants']:
            participant['score'] = 0
            participant['answers'] = []
        
        print(f"🎮 Quiz started in room {room_id} by {host_id}")
        print(f"📝 {len(questions)} questions loaded")
        
        # Notify all participants
        emit('quiz_started', {
            'started_by': host_id,
            'total_questions': len(questions),
            'current_question_index': 0,
            'question': questions[0] if questions else None,
            'timestamp': datetime.utcnow().isoformat()
        }, room=room_id)
        
    except Exception as e:
        print(f"❌ Error starting quiz: {e}")
        import traceback
        traceback.print_exc()
        emit('error', {'message': str(e)})

@socketio.on('submit_answer')
def handle_submit_answer(data):
    """Participant submits an answer with time tracking"""
    try:
        room_id = data['room_id']
        participant_id = data['participant_id']
        question_index = data['question_index']
        selected_answer = data['selected_answer']
        answer_time = data.get('answer_time', 0)  # Time taken to answer
        
        if room_id not in active_rooms:
            emit('error', {'message': 'Room not found'})
            return
        
        room = active_rooms[room_id]
        
        # Check if answer already submitted for this question
        if any(a['participant_id'] == participant_id and a['question_index'] == question_index 
               for a in room['answers_submitted']):
            return
        
        # Get correct answer
        correct_answer = room['questions'][question_index]['answer']
        is_correct = selected_answer == correct_answer
        
        # Calculate score with speed bonus
        score = 0
        if is_correct:
            # Base points: 100
            # Speed bonus: Up to 50 points (faster = more points)
            max_time = data.get('max_time', 30)
            speed_bonus = max(0, int(50 * (1 - (answer_time / max_time))))
            score = 100 + speed_bonus
        
        # Update participant score and answers
        for participant in room['participants']:
            if participant['id'] == participant_id:
                participant['score'] += score
                participant['answers'].append({
                    'question_index': question_index,
                    'selected_answer': selected_answer,
                    'is_correct': is_correct,
                    'time_taken': answer_time,
                    'score_earned': score
                })
                break
        
        # Record answer submission
        room['answers_submitted'].append({
            'participant_id': participant_id,
            'question_index': question_index,
            'selected_answer': selected_answer,
            'is_correct': is_correct,
            'time_taken': answer_time,
            'score_earned': score
        })
        
        print(f"✅ Answer submitted: {participant_id} - Q{question_index} - {'✓' if is_correct else '✗'} - {score} pts")
        
        # Notify room about answer submission
        emit('answer_submitted', {
            'participant_id': participant_id,
            'question_index': question_index,
            'is_correct': is_correct,
            'score_earned': score,
            'answers_count': len([a for a in room['answers_submitted'] if a['question_index'] == question_index]),
            'total_participants': len(room['participants']),
            'timestamp': datetime.utcnow().isoformat()
        }, room=room_id)
        
        # Update leaderboard
        leaderboard = sorted(room['participants'], key=lambda p: p['score'], reverse=True)
        emit('leaderboard_update', {
            'leaderboard': leaderboard,
            'timestamp': datetime.utcnow().isoformat()
        }, room=room_id)
        
    except Exception as e:
        print(f"❌ Error submitting answer: {e}")
        import traceback
        traceback.print_exc()
        emit('error', {'message': str(e)})

@socketio.on('next_question')
def handle_next_question(data):
    """Host moves to next question"""
    try:
        room_id = data['room_id']
        
        if room_id not in active_rooms:
            emit('error', {'message': 'Room not found'})
            return
        
        room = active_rooms[room_id]
        room['current_question_index'] += 1
        room['question_start_time'] = time.time()
        room['answers_submitted'] = [a for a in room['answers_submitted'] 
                                     if a['question_index'] < room['current_question_index']]
        
        current_index = room['current_question_index']
        
        # Check if quiz is complete
        if current_index >= len(room['questions']):
            room['quiz_state'] = 'completed'
            
            # Calculate final results
            leaderboard = sorted(room['participants'], key=lambda p: p['score'], reverse=True)
            
            # Add rankings
            for rank, participant in enumerate(leaderboard, 1):
                participant['rank'] = rank
            
            print(f"🏁 Quiz completed in room {room_id}")
            
            emit('quiz_completed', {
                'leaderboard': leaderboard,
                'total_questions': len(room['questions']),
                'timestamp': datetime.utcnow().isoformat()
            }, room=room_id)
        else:
            # Send next question
            next_question = room['questions'][current_index]
            
            print(f"➡️ Room {room_id} - Question {current_index + 1}/{len(room['questions'])}")
            
            emit('next_question', {
                'question_index': current_index,
                'question': next_question,
                'total_questions': len(room['questions']),
                'timestamp': datetime.utcnow().isoformat()
            }, room=room_id)
        
    except Exception as e:
        print(f"❌ Error moving to next question: {e}")
        import traceback
        traceback.print_exc()
        emit('error', {'message': str(e)})

@socketio.on('question_timer_expired')
def handle_timer_expired(data):
    """Automatically move to next question when timer expires"""
    try:
        room_id = data['room_id']
        question_index = data['question_index']
        
        if room_id in active_rooms:
            room = active_rooms[room_id]
            
            # Only auto-advance if we're still on the same question
            if room['current_question_index'] == question_index:
                handle_next_question({'room_id': room_id})
        
    except Exception as e:
        print(f"❌ Error handling timer expiry: {e}")
        emit('error', {'message': str(e)})

@socketio.on('send_message')
def handle_send_message(data):
    try:
        room_id = data['room_id']
        user_id = data['user_id']
        user_name = data['user_name']
        message = data['message']
        
        emit('new_message', {
            'user_id': user_id,
            'user_name': user_name,
            'message': message,
            'timestamp': '2024-01-01'  # Add actual timestamp
        }, room=room_id)
        
    except Exception as e:
        emit('error', {'message': str(e)})