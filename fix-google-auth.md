# Fix Google Sheets Authentication

## Vấn đề hiện tại:
- "Invalid JWT Signature" - Service Account credentials bị lỗi
- Server không thể kết nối Google Sheets để load drug data

## Cách sửa:

### Option 1: Tạo Service Account mới (Khuyến nghị)

1. **Truy cập Google Cloud Console:**
   ```
   https://console.cloud.google.com/
   ```

2. **Chọn project "vietanhprojects" hoặc tạo project mới**

3. **Enable Google Sheets API:**
   - Vào APIs & Services → Library
   - Tìm "Google Sheets API" 
   - Click Enable

4. **Tạo Service Account:**
   - Vào IAM & Admin → Service Accounts
   - Click "Create Service Account"
   - Name: pedmed-service-account
   - Click Create & Continue
   - Skip roles (not needed)
   - Click Done

5. **Tạo Key:**
   - Click vào service account vừa tạo
   - Vào tab "Keys"
   - Click "Add Key" → "Create new key"
   - Chọn JSON format
   - Download file JSON

6. **Share Google Sheets:**
   - Mở Google Sheets: https://docs.google.com/spreadsheets/d/1mDJIil1rmEXEl7tV5qq3j6HkbKe1padbPhlQMiYaq9U
   - Click Share
   - Add email từ service account (trong file JSON: client_email)
   - Give "Editor" permission

7. **Update .env:**
   - Copy toàn bộ nội dung file JSON
   - Paste vào GOOGLE_CREDENTIALS trong .env (trên 1 dòng)

### Option 2: Fix current credentials

Có thể thử regenerate key cho service account hiện tại:
- Vào Google Cloud Console
- Find service account: pedmed-vnch@vietanhprojects.iam.gserviceaccount.com  
- Tạo key mới và thay thế

### Option 3: Use API Key thay vì Service Account (đơn giản hơn)

1. Vào Google Cloud Console → APIs & Services → Credentials
2. Click "Create Credentials" → "API Key"
3. Copy API key
4. Set public access cho Google Sheets (Anyone with link can view)
5. Use API key trong code thay vì service account

## Test sau khi fix:

```bash
cd backend
node check-creds.js
```

Nếu thành công sẽ thấy:
- ✅ Google Sheets connection successful
- ✅ Loaded drug data from sheets
