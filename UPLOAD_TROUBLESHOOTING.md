# 🔧 Upload Troubleshooting Guide

## Common Upload Issues & Solutions

### Issue 1: "Upload Failed" - Network Error

**Symptoms:**
- Upload button shows error
- Console shows network error or 500 status

**Solutions:**

#### ✅ Step 1: Check if Backend is Running
```powershell
# Open PowerShell in project root
conda activate Doc2learn310
python troubleshoot.py
```

#### ✅ Step 2: Start Backend Properly
```powershell
# Activate conda environment
conda activate Doc2learn310

# Start backend
python -m backend.app
```

**Expected Output:**
```
🔄 Initializing database...
✅ Database connected successfully
 * Running on http://127.0.0.1:5000
```

#### ✅ Step 3: Check MongoDB is Running
```powershell
# Windows - Check service
Get-Service -Name MongoDB

# If not running, start it
net start MongoDB
```

**For Mac/Linux:**
```bash
# Check status
brew services list | grep mongodb

# Start if needed
brew services start mongodb-community
```

---

### Issue 2: CORS Error

**Symptoms:**
- Browser console shows: "Access-Control-Allow-Origin error"
- Upload fails immediately

**Solution:**
Backend already has CORS configured, but ensure frontend is on correct port:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

---

### Issue 3: "No file provided" Error

**Symptoms:**
- File selected but upload fails
- Backend logs show "No file in request"

**Solution:**
```javascript
// Check DocumentUpload component is using correct FormData
const formData = new FormData();
formData.append('file', file);  // Must be 'file' key
formData.append('user_id', user?.user_id || 'default-user');
```

---

### Issue 4: Module Not Found (Backend)

**Symptoms:**
- Backend crashes on start
- `ModuleNotFoundError: No module named 'X'`

**Solution:**
```powershell
# Activate environment
conda activate Doc2learn310

# Install all requirements
pip install -r backend/requirements.txt

# Or install specific missing package
pip install flask flask-socketio flask-cors flask-pymongo
```

---

### Issue 5: MongoDB Connection Error

**Symptoms:**
- Backend starts but upload fails
- Error: "ServerSelectionTimeoutError"

**Solutions:**

#### ✅ Option 1: Start MongoDB Service
```powershell
# Windows
net start MongoDB

# Check if running
Get-Service -Name MongoDB
```

#### ✅ Option 2: Install MongoDB
If not installed:
1. Download from: https://www.mongodb.com/try/download/community
2. Install with default settings
3. Start service

#### ✅ Option 3: Use MongoDB Atlas (Cloud)
```python
# In backend/config.py
MONGO_URI = "mongodb+srv://username:password@cluster.mongodb.net/doc2learn"
```

---

### Issue 6: OCR/Text Extraction Fails

**Symptoms:**
- Upload succeeds but text is "Text extraction failed"
- Warning: "OCR dependencies not available"

**Solution:**
```powershell
# Install OCR dependencies
pip install pytesseract easyocr pymupdf python-docx python-pptx

# For Tesseract OCR (Windows):
# Download from: https://github.com/UB-Mannheim/tesseract/wiki
# Install and add to PATH
```

---

### Issue 7: Large File Upload Fails

**Symptoms:**
- Small files work, large files fail
- Error: "File too large"

**Solutions:**

#### ✅ Frontend Check (Already set to 16MB):
```javascript
// In DocumentUpload.jsx
if (file.size > 16 * 1024 * 1024) {
  // Reject files > 16MB
}
```

#### ✅ Backend Config:
```python
# In backend/config.py or app.py
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB
```

---

## 🧪 Testing Upload Manually

### Test 1: Backend Health Check
```powershell
# In browser or curl
curl http://localhost:5000/api/test
```

**Expected Response:**
```json
{
  "message": "Backend is working",
  "database": "connected"
}
```

### Test 2: Upload Test with curl
```powershell
curl -X POST http://localhost:5000/api/document/upload `
  -F "file=@test.pdf" `
  -F "user_id=test-user"
```

**Success Response:**
```json
{
  "success": true,
  "document_id": "507f1f77bcf86cd799439011",
  "message": "Document processed successfully"
}
```

---

## 🚀 Complete Startup Checklist

### Backend Startup:
- [ ] MongoDB service is running
- [ ] Conda environment activated: `conda activate Doc2learn310`
- [ ] All packages installed: `pip install -r backend/requirements.txt`
- [ ] Backend running: `python -m backend.app`
- [ ] Console shows: "Database connected successfully"
- [ ] No error messages in console

### Frontend Startup:
- [ ] Node modules installed: `npm install`
- [ ] Running on port 5173: `npm run dev`
- [ ] Can access: `http://localhost:5173`
- [ ] No CORS errors in browser console

### Test Upload:
- [ ] Can select file
- [ ] File size < 16MB
- [ ] Allowed file type (PDF, DOCX, PPTX, TXT, JPG, PNG)
- [ ] Upload button works
- [ ] Success notification appears
- [ ] Document appears in dashboard

---

## 🐛 Debug Mode

### Enable Detailed Logging:

**Backend (document.py):**
```python
@document_bp.route('/upload', methods=['POST', 'OPTIONS'])
def upload_document():
    print("📤 Upload endpoint hit")
    print(f"   Files: {list(request.files.keys())}")
    print(f"   Form: {dict(request.form)}")
    # ... rest of code
```

**Frontend (DocumentUpload.jsx):**
```javascript
const handleFile = async (file) => {
  console.log('📤 Uploading file:', file.name, file.size, file.type);
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('user_id', user?.user_id || 'default-user');
  
  console.log('FormData entries:', [...formData.entries()]);
  
  const response = await documentAPI.uploadDocument(formData);
  console.log('✅ Response:', response);
};
```

---

## 📞 Still Having Issues?

### Quick Diagnostic:
```powershell
# Run full diagnostic
conda activate Doc2learn310
python troubleshoot.py
```

### Check Console Outputs:
1. **Backend console** - Look for errors during upload
2. **Browser console (F12)** - Check for JavaScript errors
3. **Network tab (F12)** - See actual request/response

### Common Error Messages:

| Error | Likely Cause | Solution |
|-------|-------------|----------|
| "No file provided" | FormData key mismatch | Use 'file' as key |
| "ServerSelectionTimeoutError" | MongoDB not running | Start MongoDB service |
| "CORS error" | Wrong ports | Frontend:5173, Backend:5000 |
| "ModuleNotFoundError" | Missing packages | pip install requirements.txt |
| "File too large" | Size > 16MB | Compress or split file |
| "Invalid file type" | Unsupported format | Use PDF, DOCX, TXT, etc. |

---

## ✅ Success Indicators

When upload works correctly, you should see:

### Backend Console:
```
📤 Upload endpoint hit
📄 Processing file: document.pdf for user: user_123
🔍 Extracting text...
✅ Text extracted: 1250 characters
✅ Document saved to MongoDB with ID: 507f1f77bcf86cd799439011
🔄 Processing document with RAG...
```

### Frontend:
```
✅ Success notification
Document appears in dashboard
Can generate quiz/flashcards from it
```

---

## 🔄 Reset Everything (Nuclear Option)

If nothing works:

```powershell
# 1. Stop all servers
# Ctrl+C in backend terminal
# Ctrl+C in frontend terminal

# 2. Restart MongoDB
net stop MongoDB
net start MongoDB

# 3. Reinstall backend dependencies
conda activate Doc2learn310
pip uninstall -r backend/requirements.txt -y
pip install -r backend/requirements.txt

# 4. Reinstall frontend dependencies
cd doc2learn-frontend
rm -rf node_modules
npm install

# 5. Clear browser cache
# Open DevTools (F12) → Application → Clear Storage → Clear site data

# 6. Restart everything
# Terminal 1: python -m backend.app
# Terminal 2: cd doc2learn-frontend && npm run dev
```

---

This guide should help you diagnose and fix any upload issues! 🎯
