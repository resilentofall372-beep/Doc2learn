# test_env.py
from dotenv import load_dotenv
import os

print('🚀 Starting environment test...')

# Load environment variables from .env file
load_dotenv()

print('🔍 Checking environment variables...')
print(f'OPENAI_API_KEY loaded: {"✅ Yes" if os.getenv("OPENAI_API_KEY") else "❌ No"}')
print(f'FLASK_ENV: {os.getenv("FLASK_ENV")}')
print(f'SECRET_KEY: {os.getenv("SECRET_KEY")}')

# Show first few characters of API key for verification
api_key = os.getenv('OPENAI_API_KEY')
if api_key:
    print(f'API Key starts with: {api_key[:20]}...')
    print('🎉 Environment variables loaded successfully!')
    print('✅ You can now run: python app.py')
else:
    print('❌ Failed to load environment variables')
    print('💡 Troubleshooting:')
    print('   1. Make sure .env file is in the same folder')
    print('   2. Check .env file has correct content')
    print('   3. Ensure no spaces around = signs')