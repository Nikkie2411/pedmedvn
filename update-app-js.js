// Utility script to update existing app.js with AI integration
const fs = require('fs');
const path = require('path');

class AppJsUpdater {
    constructor() {
        this.appJsPath = path.join(__dirname, 'app.js');
        this.backupPath = path.join(__dirname, 'app.js.backup');
    }

    async updateAppJs() {
        console.log('🔧 Updating app.js with AI integration...');
        
        try {
            // Read current app.js
            if (!fs.existsSync(this.appJsPath)) {
                throw new Error('app.js not found in backend directory');
            }
            
            let appContent = fs.readFileSync(this.appJsPath, 'utf8');
            
            // Create backup
            fs.writeFileSync(this.backupPath, appContent);
            console.log('✅ Backup created: app.js.backup');
            
            // Check if AI routes already exist
            if (appContent.includes('aiChatbot') || appContent.includes('/api/ai')) {
                console.log('⚠️  AI routes already exist in app.js');
                return;
            }
            
            // Add AI routes import
            const aiImport = "const aiChatbotRoutes = require('./routes/aiChatbot');";
            
            // Find a good place to add the import (after other route imports)
            const routeImportRegex = /const\s+\w+Routes\s*=\s*require\(['"][^'"]+['"];\s*$/gm;
            const matches = appContent.match(routeImportRegex);
            
            if (matches) {
                const lastImport = matches[matches.length - 1];
                const importIndex = appContent.lastIndexOf(lastImport) + lastImport.length;
                appContent = appContent.slice(0, importIndex) + '\n' + aiImport + appContent.slice(importIndex);
            } else {
                // Add after express require
                const expressIndex = appContent.indexOf("require('express')");
                if (expressIndex !== -1) {
                    const lineEnd = appContent.indexOf('\n', expressIndex) + 1;
                    appContent = appContent.slice(0, lineEnd) + aiImport + '\n' + appContent.slice(lineEnd);
                }
            }
            
            // Add AI route usage
            const aiRouteUsage = "\n// AI Chatbot Routes\napp.use('/api/ai', aiChatbotRoutes);\n";
            
            // Find where to add route usage (before app.listen or error handlers)
            const listenIndex = appContent.lastIndexOf('app.listen');
            const errorHandlerIndex = appContent.lastIndexOf('app.use((err');
            
            let insertIndex = listenIndex;
            if (errorHandlerIndex !== -1 && errorHandlerIndex < listenIndex) {
                insertIndex = errorHandlerIndex;
            }
            
            if (insertIndex !== -1) {
                // Find the start of the line
                while (insertIndex > 0 && appContent[insertIndex - 1] !== '\n') {
                    insertIndex--;
                }
                appContent = appContent.slice(0, insertIndex) + aiRouteUsage + appContent.slice(insertIndex);
            } else {
                // Append before the end
                appContent += aiRouteUsage;
            }
            
            // Add health check endpoint if not exists
            if (!appContent.includes('/health')) {
                const healthEndpoint = `
// Health Check for AI
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    aiProviders: {
      gemini: process.env.GEMINI_API_KEY ? 'available' : 'disabled',
      groq: process.env.GROQ_API_KEY ? 'available' : 'disabled',
      openai: process.env.OPENAI_API_KEY ? 'available' : 'disabled'
    }
  });
});
`;
                
                // Add before AI routes
                const aiRouteIndex = appContent.lastIndexOf("app.use('/api/ai'");
                if (aiRouteIndex !== -1) {
                    appContent = appContent.slice(0, aiRouteIndex) + healthEndpoint + '\n' + appContent.slice(aiRouteIndex);
                }
            }
            
            // Update CORS if it exists
            if (appContent.includes('cors(')) {
                console.log('⚠️  CORS configuration found. Please manually update with Firebase domains.');
                console.log('   Add your Firebase domains to allowedOrigins array.');
            }
            
            // Write updated content
            fs.writeFileSync(this.appJsPath, appContent);
            console.log('✅ app.js updated successfully');
            
            // Show what was added
            console.log('\n📝 Added to app.js:');
            console.log('• AI chatbot routes import');
            console.log('• /api/ai endpoint mapping');
            console.log('• /health endpoint for monitoring');
            
            console.log('\n⚠️  Manual steps needed:');
            console.log('1. Copy AI service files to backend/services/');
            console.log('2. Copy AI routes file to backend/routes/');
            console.log('3. Update CORS configuration with Firebase domains');
            console.log('4. Set environment variables on Render dashboard');
            
        } catch (error) {
            console.error('❌ Error updating app.js:', error.message);
            
            // Restore from backup if exists
            if (fs.existsSync(this.backupPath)) {
                fs.copyFileSync(this.backupPath, this.appJsPath);
                console.log('🔄 Restored from backup');
            }
        }
    }
    
    showCurrentConfig() {
        console.log('\n📊 Current app.js analysis:');
        
        if (!fs.existsSync(this.appJsPath)) {
            console.log('❌ app.js not found');
            return;
        }
        
        const content = fs.readFileSync(this.appJsPath, 'utf8');
        
        console.log('Route imports found:');
        const routeImports = content.match(/const\s+\w+Routes\s*=\s*require\(['"][^'"]+['"];/g) || [];
        routeImports.forEach(imp => console.log(`  • ${imp}`));
        
        console.log('\nRoute usages found:');
        const routeUsages = content.match(/app\.use\(['"][^'"]*['"],\s*\w+Routes\);/g) || [];
        routeUsages.forEach(usage => console.log(`  • ${usage}`));
        
        console.log('\nEndpoints found:');
        const endpoints = content.match(/app\.(get|post|put|delete)\(['"][^'"]*['"],/g) || [];
        endpoints.forEach(ep => console.log(`  • ${ep.replace(/,$/, '')}`));
        
        const hasAI = content.includes('aiChatbot') || content.includes('/api/ai');
        const hasHealth = content.includes('/health');
        const hasCors = content.includes('cors(');
        
        console.log('\nAI Integration Status:');
        console.log(`  • AI Routes: ${hasAI ? '✅' : '❌'}`);
        console.log(`  • Health Check: ${hasHealth ? '✅' : '❌'}`);
        console.log(`  • CORS Config: ${hasCors ? '✅' : '❌'}`);
    }
}

// Run if called directly
if (require.main === module) {
    const updater = new AppJsUpdater();
    
    const command = process.argv[2];
    
    if (command === 'analyze') {
        updater.showCurrentConfig();
    } else if (command === 'update') {
        updater.updateAppJs();
    } else {
        console.log('🔧 App.js AI Integration Helper');
        console.log('');
        console.log('Usage:');
        console.log('  node update-app-js.js analyze  - Show current app.js configuration');
        console.log('  node update-app-js.js update   - Update app.js with AI integration');
        console.log('');
        
        // Show analysis by default
        updater.showCurrentConfig();
    }
}

module.exports = AppJsUpdater;
