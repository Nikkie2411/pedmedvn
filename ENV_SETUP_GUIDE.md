# ==============================================
# HƯỚNG DẪN CẬP NHẬT FILE .env
# ==============================================

# 1. Mở file JSON credentials đã download từ Google Cloud
# 2. Copy toàn bộ nội dung JSON (bỏ dấu xuống dòng)
# 3. Thay thế dòng GOOGLE_CREDENTIALS trong file .env

# VÍ DỤ:
# GOOGLE_CREDENTIALS={"type":"service_account","project_id":"vietanhprojects-123456","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n","client_email":"pedmedvn-sheets-service@vietanhprojects-123456.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/pedmedvn-sheets-service%40vietanhprojects-123456.iam.gserviceaccount.com"}

# BƯỚC THỰC HIỆN:
# 1. Mở file .env
# 2. Tìm dòng GOOGLE_CREDENTIALS={"type":"service_account","project_id":"your-project-id",...}
# 3. Thay thế bằng JSON credentials thực tế
# 4. Lưu file
