# 🚀 Complete Startup Guide for Doc2Learn

## Prerequisites Check

### 1. MongoDB
```powershell
# Check if MongoDB is installed
Get-Service -Name MongoDB -ErrorAction SilentlyContinue

# If not installed, download from:
# https://www.mongodb.com/try/download/community
```

### 2. Conda Environment
```powershell
# Check if environment exists
conda env list | Select-String "Doc2learn310"

# If not exists, create it:
conda create -n Doc2learn310 python=3.10
```

### 3. Node.js & npm
```powershell
node --version  # Should be v16+ or v18+
npm --version   # Should be 8+
```

---

## Step-by-Step Startup

### Terminal 1: Backend

```powershell
# 1. Navigate to project root
cd C:\Users\utkar\OneDrive\Desktop\Doc2learn

# 2. Start MongoDB (if not auto-starting)
net start MongoDB

# 3. Activate conda environment
conda activate Doc2learn310

# 4. Install/Update dependencies (first time or after pulling updates)
pip install -r backend/requirements.txt

# 5. Start backend server
python -m backend.app

# Expected output:
# 🔄 Initializing database...
# ✅ Database connected successfully
# ✅ OCR Service loaded successfully
# ✅ RAG Service loaded successfully
#  * Running on http://127.0.0.1:5000
```

**Keep this terminal running!**

---

### Terminal 2: Frontend

```powershell
# 1. Navigate to frontend directory
cd C:\Users\utkar\OneDrive\Desktop\Doc2learn\doc2learn-frontend

# 2. Install/Update dependencies (first time or after pulling updates)
npm install

# 3. Start development server
npm run dev

# Expected output:
#   VITE v4.x.x  ready in xxx ms
#   ➜  Local:   http://localhost:5173/
#   ➜  Network: use --host to expose
```

**Keep this terminal running!**

---

## Testing Upload & Quiz Generation

### Test 1: Document Upload (Dashboard)

1. Open browser: `http://localhost:5173`
2. Login with your credentials
3. Go to Dashboard
4. Upload a test document (PDF, DOCX, or TXT)
5. Check console logs:
   - **Browser (F12)**: Should show "✅ Upload successful"
   - **Backend terminal**: Should show "✅ Document saved to MongoDB"

**If upload fails:**
- Check backend terminal for errors
- Check browser console (F12) → Network tab
- Run: `python troubleshoot.py`

---

### Test 2: Create Quiz Room

1. Click "Study Rooms" in navigation
2. Click "Create Quiz Room"
3. **Step 1: Settings**
   - Enter room name (e.g., "Test Quiz")
   - Select number of questions (10)
   - Select time per question (30s)
   - Select difficulty (Medium)
   - Click "Next: Upload Document"

4. **Step 2: Document Upload**
   - Upload a document (PDF/DOCX/TXT with at least 200 words)
   - Wait for "✅ Document uploaded successfully!"
   - Should see Document ID displayed
   - Click "🎮 Create Quiz Room"

5. **You should be redirected to room lobby**
   - Room code should be visible (e.g., "A7K3M9")
   - Document ID should show in "Document Status" section

**Console logs to watch:**
```
Browser Console:
📤 Uploading file: test.pdf
✅ Upload successful
🎮 Creating room with data: {document_id: "..."}
✅ Room created

Backend Console:
📤 Upload endpoint hit
✅ Document saved to MongoDB with ID: 507f...
✅ Room created with ID: 507f...
```

---

### Test 3: Generate Quiz

1. In the room lobby (as host), click "✨ Generate Quiz Questions"
2. Watch console logs:

**Browser Console:**
```
📝 Generating quiz for document: 507f...
1️⃣ Fetching document...
✅ Document fetched
2️⃣ Generating 10 quiz questions...
   Text length: 1250 characters
✅ Quiz generated
```

**Backend Console:**
```
==================================================
📝 QUIZ GENERATION REQUEST
==================================================
📊 Text length: 1250 characters
📊 Num questions: 10
📊 Difficulty: medium
==================================================
🤖 Attempting to use OpenAI for quiz generation...
✅ OpenAI quiz generated successfully
```

3. Should see "✅ 10 questions ready!" message
4. "🚀 Start Quiz Now" button should appear

---

## Common Issues & Solutions

### Issue 1: Backend Fails to Start

**Error:** `ModuleNotFoundError: No module named 'flask'`
```powershell
# Solution:
conda activate Doc2learn310
pip install -r backend/requirements.txt
```

**Error:** `ServerSelectionTimeoutError` (MongoDB)
```powershell
# Solution: Start MongoDB
net start MongoDB

# Or check status
Get-Service -Name MongoDB
```

---

### Issue 2: Upload Fails

**Check 1: Backend Running?**
```powershell
# In browser, try:
http://localhost:5000/api/test

# Should return: {"message": "Backend is working"}
```

**Check 2: MongoDB Running?**
```powershell
Get-Service -Name MongoDB
# Status should be "Running"
```

**Check 3: CORS Error?**
- Frontend must be on `http://localhost:5173`
- Backend must be on `http://localhost:5000`
- Check browser console for CORS errors

---

### Issue 3: Quiz Generation Fails

**Check 1: Document ID exists?**
- Look at room lobby → "Document Status" section
- Should show "✅ Document Uploaded"
- Should show Document ID

**Check 2: Document has content?**
```powershell
# In MongoDB Compass or shell:
db.DOCUMENTS.findOne({_id: ObjectId("YOUR_DOCUMENT_ID")})

# Check 'extracted_text' field
# Should have at least 50 characters
```

**Check 3: OpenAI API Key set?**
```powershell
# Check if .env file exists in backend/
# Should have: OPENAI_API_KEY=sk-...

# If not set, quiz will use fallback questions
```

---

### Issue 4: Room Creation Fails

**Check 1: User authenticated?**
- Login first before creating room
- Check localStorage: `authToken` should exist

**Check 2: Backend route exists?**
```powershell
# Test room creation endpoint:
curl -X POST http://localhost:5000/api/room/create `
  -H "Content-Type: application/json" `
  -d '{\"host_id\":\"test\",\"host_name\":\"Test\"}'
```

---

## Diagnostic Commands

### Quick Health Check
```powershell
# In project root with conda activated:
python troubleshoot.py
```

### Manual MongoDB Check
```powershell
# Connect to MongoDB
mongosh

# List databases
show dbs

# Use doc2learn
use doc2learn

# List collections
show collections

# Count documents
db.DOCUMENTS.countDocuments()
db.ROOMS.countDocuments()

# View latest document
db.DOCUMENTS.find().sort({uploaded_on: -1}).limit(1).pretty()

# View latest room
db.ROOMS.find().sort({created_at: -1}).limit(1).pretty()
```

### Backend API Test
```powershell
# Test upload endpoint
curl -X POST http://localhost:5000/api/document/upload `
  -F "file=@test.pdf" `
  -F "user_id=test-user"

# Test room creation
curl -X POST http://localhost:5000/api/room/create `
  -H "Content-Type: application/json" `
  -d '{\"host_id\":\"test\",\"host_name\":\"Test\",\"room_name\":\"Test Room\",\"num_questions\":10,\"time_per_question\":30,\"difficulty\":\"medium\"}'
```

---

## Complete Flow Test

### Step-by-Step Test Checklist

- [ ] MongoDB is running
- [ ] Backend started successfully (no errors)
- [ ] Frontend started successfully (no errors)
- [ ] Can access login page (http://localhost:5173)
- [ ] Can login/signup
- [ ] Dashboard loads
- [ ] Can upload document from dashboard
- [ ] Document appears in documents list
- [ ] Can navigate to "Study Rooms"
- [ ] Can click "Create Quiz Room"
- [ ] Can fill settings form
- [ ] Can upload document in room creation
- [ ] Document ID appears after upload
- [ ] Room creation succeeds
- [ ] Room lobby loads with room code
- [ ] Document status shows "✅ Document Uploaded"
- [ ] Can click "Generate Quiz Questions"
- [ ] Quiz generation succeeds
- [ ] "Start Quiz" button appears
- [ ] Can start quiz (with 2+ participants)

---

## Production Deployment Checklist

When ready to deploy:

- [ ] Set strong `SECRET_KEY` in backend/.env
- [ ] Set real `OPENAI_API_KEY`
- [ ] Use MongoDB Atlas (cloud) instead of local
- [ ] Update CORS origins to production URLs
- [ ] Build frontend: `npm run build`
- [ ] Set up proper authentication (JWT refresh tokens)
- [ ] Enable HTTPS
- [ ] Set up proper logging
- [ ] Add rate limiting
- [ ] Set up monitoring (Sentry, LogRocket, etc.)

---

## Quick Commands Reference

```powershell
# Start MongoDB
net start MongoDB

# Activate environment
conda activate Doc2learn310

# Backend
python -m backend.app

# Frontend
cd doc2learn-frontend; npm run dev

# Troubleshoot
python troubleshoot.py

# Fix upload issues
.\fix-upload.bat

# View logs
# Backend: Check terminal output
# Frontend: Browser F12 → Console
# MongoDB: C:\Program Files\MongoDB\Server\X.X\log\mongod.log
```

---

🎉 **You're all set!** If you encounter any issues, check the troubleshooting sections above or the `UPLOAD_TROUBLESHOOTING.md` file.
