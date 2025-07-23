const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

/**
 * Google Drive Integration cho PedMed Chatbot
 * Tự động tải và xử lý documents từ Google Drive
 */
class GoogleDriveService {
    constructor() {
        this.drive = null;
        this.docs = null;
        this.folderId = '11XjgzBUJ4HtkBcXzynKcgGLbzxiE3rR1'; // Folder ID từ link
        this.knowledgeBasePath = path.join(__dirname, '..', 'data', 'knowledge_base.json');
        this.documentsPath = path.join(__dirname, '..', 'documents');
    }

    /**
     * Khởi tạo Google Drive API client
     */
    async initialize() {
        try {
            let auth;
            
            // TRY 1: Sử dụng service account từ environment variable (cho Render/production)
            if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                console.log('🔐 Using Google Service Account from environment variable');
                try {
                    const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
                    auth = new google.auth.GoogleAuth({
                        credentials: serviceAccountKey,
                        scopes: [
                            'https://www.googleapis.com/auth/drive.readonly',
                            'https://www.googleapis.com/auth/documents.readonly'
                        ]
                    });
                } catch (parseError) {
                    console.error('❌ Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', parseError.message);
                    return false;
                }
            }
            // TRY 2: Sử dụng service account file (cho local development)
            else {
                console.log('📁 Trying to use service account key file');
                const keyFiles = [
                    path.join(__dirname, '..', '..', 'vietanhprojects-98c888ec87d3.json'),
                    path.join(__dirname, '..', '..', 'vietanhprojects-a9f573862a83.json')
                ];
                
                let keyFile = null;
                for (const file of keyFiles) {
                    if (fs.existsSync(file)) {
                        keyFile = file;
                        console.log(`📋 Found service account key: ${path.basename(file)}`);
                        break;
                    }
                }
                
                if (!keyFile) {
                    console.warn('⚠️ Google Drive service account key not found. Skipping Drive integration.');
                    console.warn('💡 To enable Google Drive integration:');
                    console.warn('   1. Set GOOGLE_SERVICE_ACCOUNT_KEY environment variable, OR');
                    console.warn('   2. Place service account JSON file in project root');
                    return false;
                }

                auth = new google.auth.GoogleAuth({
                    keyFile: keyFile,
                    scopes: [
                        'https://www.googleapis.com/auth/drive.readonly',
                        'https://www.googleapis.com/auth/documents.readonly'
                    ]
                });
            }

            const authClient = await auth.getClient();
            
            this.drive = google.drive({ version: 'v3', auth: authClient });
            this.docs = google.docs({ version: 'v1', auth: authClient });
            
            console.log('✅ Google Drive API initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Google Drive API:', error.message);
            return false;
        }
    }

    /**
     * Lấy danh sách files từ Google Drive folder
     */
    async getFilesFromFolder() {
        if (!this.drive) {
            throw new Error('Google Drive not initialized');
        }

        try {
            const response = await this.drive.files.list({
                q: `'${this.folderId}' in parents and (mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')`,
                fields: 'files(id, name, mimeType, modifiedTime)'
            });

            const files = response.data.files || [];
            console.log(`📁 Found ${files.length} documents in Google Drive folder`);
            
            return files;
        } catch (error) {
            console.error('❌ Error fetching files from Google Drive:', error.message);
            return [];
        }
    }

    /**
     * Tải nội dung Google Docs
     */
    async downloadGoogleDoc(fileId) {
        if (!this.docs) {
            throw new Error('Google Docs not initialized');
        }

        try {
            const response = await this.docs.documents.get({
                documentId: fileId
            });

            // Extract text từ Google Docs structure
            const content = this.extractTextFromGoogleDoc(response.data);
            return content;
        } catch (error) {
            console.error(`❌ Error downloading Google Doc ${fileId}:`, error.message);
            return null;
        }
    }

    /**
     * Tải Word document dưới dạng text
     */
    async downloadWordDoc(fileId) {
        if (!this.drive) {
            throw new Error('Google Drive not initialized');
        }

        try {
            const response = await this.drive.files.export({
                fileId: fileId,
                mimeType: 'text/plain'
            });

            return response.data;
        } catch (error) {
            console.error(`❌ Error downloading Word doc ${fileId}:`, error.message);
            return null;
        }
    }

    /**
     * Extract text từ Google Docs structure với preserving headings
     */
    extractTextFromGoogleDoc(doc) {
        let text = '';
        
        if (doc.body && doc.body.content) {
            for (const element of doc.body.content) {
                if (element.paragraph) {
                    let paragraphText = '';
                    
                    // Check if paragraph has heading style
                    const paragraphStyle = element.paragraph.paragraphStyle;
                    const isHeading = paragraphStyle && paragraphStyle.namedStyleType && 
                                     paragraphStyle.namedStyleType.includes('HEADING');
                    
                    // Extract text content
                    for (const textElement of element.paragraph.elements || []) {
                        if (textElement.textRun) {
                            paragraphText += textElement.textRun.content;
                        }
                    }
                    
                    // Add appropriate formatting for headings
                    if (isHeading && paragraphText.trim()) {
                        text += '\n\n' + paragraphText.trim() + '\n';
                    } else if (paragraphText.trim()) {
                        text += paragraphText;
                    }
                }
            }
        }
        
        return text.trim();
    }

    /**
     * Sync documents từ Google Drive
     */
    async syncDocuments() {
        console.log('🔄 Syncing documents from Google Drive...');
        
        const initialized = await this.initialize();
        if (!initialized) {
            console.log('📝 Skipping Google Drive sync - using local documents only');
            return false;
        }

        try {
            const files = await this.getFilesFromFolder();
            let syncedCount = 0;

            // Ensure documents directory exists
            if (!fs.existsSync(this.documentsPath)) {
                fs.mkdirSync(this.documentsPath, { recursive: true });
            }

            for (const file of files) {
                console.log(`📄 Processing: ${file.name}`);
                
                let content = null;
                
                if (file.mimeType === 'application/vnd.google-apps.document') {
                    // Google Docs
                    content = await this.downloadGoogleDoc(file.id);
                } else if (file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    // Word documents
                    content = await this.downloadWordDoc(file.id);
                }

                if (content) {
                    // Save to local documents folder
                    const fileName = file.name.replace(/\.(docx?|gdoc)$/i, '.txt');
                    const filePath = path.join(this.documentsPath, fileName);
                    
                    fs.writeFileSync(filePath, content, 'utf8');
                    console.log(`✅ Saved: ${fileName}`);
                    syncedCount++;
                } else {
                    console.log(`⚠️ Failed to download: ${file.name}`);
                }
            }

            console.log(`🎉 Synced ${syncedCount}/${files.length} documents from Google Drive`);
            return syncedCount > 0;
        } catch (error) {
            console.error('❌ Error syncing documents from Google Drive:', error.message);
            return false;
        }
    }

    /**
     * Schedule automatic sync
     */
    scheduleSync(intervalHours = 6) {
        console.log(`⏰ Scheduling document sync every ${intervalHours} hours`);
        
        // Sync immediately
        this.syncDocuments();
        
        // Schedule periodic syncs
        setInterval(() => {
            this.syncDocuments();
        }, intervalHours * 60 * 60 * 1000);
    }

    /**
     * Kiểm tra quyền truy cập Google Drive
     */
    async testAccess() {
        const initialized = await this.initialize();
        if (!initialized) {
            return { success: false, message: 'Google Drive not initialized' };
        }

        try {
            const files = await this.getFilesFromFolder();
            return { 
                success: true, 
                message: `Found ${files.length} documents`,
                files: files.map(f => ({ name: f.name, type: f.mimeType }))
            };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}

module.exports = GoogleDriveService;
