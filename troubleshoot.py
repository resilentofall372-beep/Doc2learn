"""
Quick Troubleshooting Script for Doc2Learn Upload Issues
Run this in the Doc2learn310 conda environment
"""
import sys
import os

print("🔍 Doc2Learn Upload Troubleshooting")
print("=" * 50)

# 1. Check Python version
print(f"\n1️⃣ Python Version: {sys.version}")

# 2. Check if in conda environment
conda_env = os.environ.get('CONDA_DEFAULT_ENV', 'Not in conda env')
print(f"2️⃣ Conda Environment: {conda_env}")

# 3. Check MongoDB connection
print("\n3️⃣ Testing MongoDB Connection...")
try:
    from pymongo import MongoClient
    client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=2000)
    client.server_info()
    print("   ✅ MongoDB is running")
    
    # Check if doc2learn database exists
    db = client['doc2learn']
    collections = db.list_collection_names()
    print(f"   📊 Collections found: {', '.join(collections) if collections else 'None'}")
    
except Exception as e:
    print(f"   ❌ MongoDB Error: {e}")
    print("   💡 Solution: Start MongoDB service")
    print("      Windows: net start MongoDB")
    print("      Mac: brew services start mongodb-community")

# 4. Check required packages
print("\n4️⃣ Checking Required Packages...")
required_packages = [
    'flask',
    'flask_socketio',
    'flask_cors',
    'flask_pymongo',
    'openai',
    'pymupdf',
    'PIL',
    'pytesseract',
    'docx',
    'pptx',
    'faiss'
]

missing_packages = []
for package in required_packages:
    try:
        __import__(package)
        print(f"   ✅ {package}")
    except ImportError:
        print(f"   ❌ {package} - MISSING")
        missing_packages.append(package)

if missing_packages:
    print(f"\n   💡 Install missing packages:")
    print(f"      pip install {' '.join(missing_packages)}")

# 5. Check uploads directory
print("\n5️⃣ Checking Uploads Directory...")
upload_dir = os.path.join(os.getcwd(), 'uploads')
if os.path.exists(upload_dir):
    print(f"   ✅ Uploads directory exists: {upload_dir}")
    files = os.listdir(upload_dir)
    print(f"   📁 Files in uploads: {len(files)}")
else:
    print(f"   ⚠️  Uploads directory doesn't exist")
    print(f"   💡 It will be created automatically on first upload")

# 6. Check vector_stores directory
print("\n6️⃣ Checking Vector Stores Directory...")
vector_dir = os.path.join(os.getcwd(), 'vector_stores')
if os.path.exists(vector_dir):
    print(f"   ✅ Vector stores directory exists")
    files = os.listdir(vector_dir)
    print(f"   📁 Vector stores: {len(files)}")
else:
    print(f"   ⚠️  Vector stores directory doesn't exist")
    print(f"   💡 It will be created automatically")

# 7. Check environment variables
print("\n7️⃣ Checking Environment Variables...")
env_vars = ['OPENAI_API_KEY', 'MONGO_URI', 'SECRET_KEY']
for var in env_vars:
    value = os.environ.get(var)
    if value:
        print(f"   ✅ {var} is set")
    else:
        print(f"   ⚠️  {var} not set (may use defaults)")

# 8. Test file upload simulation
print("\n8️⃣ Testing Upload Function...")
try:
    from backend.routes.document import upload_document
    print("   ✅ Document upload function imported successfully")
except Exception as e:
    print(f"   ❌ Import Error: {e}")

print("\n" + "=" * 50)
print("✅ Troubleshooting Complete!")
print("\n💡 To start the backend:")
print("   conda activate Doc2learn310")
print("   python -m backend.app")
print("\n💡 To start the frontend:")
print("   cd doc2learn-frontend")
print("   npm run dev")
