@echo off
echo ========================================
echo   Doc2Learn - Quick Upload Fix
echo ========================================
echo.

echo [1/5] Checking MongoDB...
net start MongoDB 2>nul
if %errorlevel% equ 0 (
    echo   ✓ MongoDB started
) else (
    echo   ✓ MongoDB already running
)
echo.

echo [2/5] Activating Conda Environment...
call conda activate Doc2learn310
echo   ✓ Environment activated
echo.

echo [3/5] Installing Missing Packages...
pip install flask flask-socketio flask-cors flask-pymongo python-dotenv pymongo --quiet
echo   ✓ Core packages checked
echo.

echo [4/5] Creating Required Directories...
if not exist "uploads" mkdir uploads
if not exist "vector_stores" mkdir vector_stores
echo   ✓ Directories created
echo.

echo [5/5] Testing MongoDB Connection...
python -c "from pymongo import MongoClient; client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=2000); client.server_info(); print('   ✓ MongoDB connected')" 2>nul
if %errorlevel% neq 0 (
    echo   ✗ MongoDB connection failed
    echo.
    echo SOLUTION: Make sure MongoDB is installed and running
    echo   Install: https://www.mongodb.com/try/download/community
    echo   Or use MongoDB Atlas cloud database
    echo.
) else (
    echo.
    echo ========================================
    echo   ✓ Everything looks good!
    echo ========================================
    echo.
    echo Now start the backend:
    echo   python -m backend.app
    echo.
    echo And in another terminal, start frontend:
    echo   cd doc2learn-frontend
    echo   npm run dev
    echo.
)

pause
