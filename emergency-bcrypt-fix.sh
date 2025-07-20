#!/bin/bash
# Emergency fix script nếu bcrypt vẫn lỗi trên Render

echo "🔧 Emergency bcrypt fix for Render..."

# Backup current package.json
cp package.json package.json.backup

# Replace bcrypt with bcryptjs
npm uninstall bcrypt
npm install bcryptjs@^2.4.3

# Update import statements in auth.js
sed -i 's/const bcrypt = require('\''bcrypt'\'')/const bcrypt = require('\''bcryptjs'\'')/g' routes/auth.js

echo "✅ Replaced bcrypt with bcryptjs"
echo "📝 Remember to:"
echo "1. Test the auth functionality"
echo "2. Commit and push changes"
echo "3. Monitor Render deployment"

# Show the change
echo "📄 Updated package.json:"
grep bcrypt package.json || echo "bcrypt removed successfully"
