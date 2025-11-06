from flask import Blueprint, request, jsonify
import firebase_admin
from firebase_admin import auth, credentials
import os

# Create Blueprint
auth_bp = Blueprint('auth', __name__)

# Path to your Firebase service account file
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), "credentials.json")

# Initialize Firebase Admin
try:
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print("⚠️ Firebase service account file not found at:", SERVICE_ACCOUNT_PATH)
    else:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin initialized successfully")
except Exception as e:
    print(f"❌ Firebase Admin initialization failed: {e}")

# ------------------ ROUTES ------------------

@auth_bp.route('/verify-token', methods=['POST'])
def verify_token():
    try:
        data = request.json
        id_token = data.get('token')

        if not id_token:
            return jsonify({'error': 'No token provided'}), 400

        # Verify the Firebase ID token
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        email = decoded_token.get('email')
        name = decoded_token.get('name', 'User')

        return jsonify({
            'success': True,
            'user': {
                'uid': uid,
                'email': email,
                'name': name
            }
        })

    except Exception as e:
        return jsonify({'error': f'Token verification failed: {str(e)}'}), 401


@auth_bp.route('/create-custom-token', methods=['POST'])
def create_custom_token():
    try:
        data = request.json
        uid = data.get('uid')

        if not uid:
            return jsonify({'error': 'No UID provided'}), 400

        custom_token = auth.create_custom_token(uid)
        return jsonify({'token': custom_token.decode('utf-8')})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/health', methods=['GET'])
def auth_health():
    return jsonify({'status': 'Auth service running'})
