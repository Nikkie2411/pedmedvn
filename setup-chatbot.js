// Script to setup knowledge base for chatbot
const documentProcessor = require('./utils/documentProcessor');
const path = require('path');

async function setupKnowledgeBase() {
    console.log('🚀 Setting up chatbot knowledge base...');
    
    const knowledgeBasePath = path.join(__dirname, 'data', 'knowledge_base.json');
    
    // For demo purposes, create sample knowledge base
    // In production, you would process your actual Word documents
    const success = await documentProcessor.createSampleKnowledgeBase(knowledgeBasePath);
    
    if (success) {
        console.log('✅ Knowledge base setup completed!');
        console.log('🤖 Chatbot is ready to use');
        console.log('');
        console.log('📚 To add your own documents:');
        console.log('1. Convert Word files to .txt format');
        console.log('2. Place them in a directory');
        console.log('3. Use documentProcessor.buildKnowledgeBase(directory, outputPath)');
    } else {
        console.log('❌ Failed to setup knowledge base');
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    setupKnowledgeBase().catch(console.error);
}

module.exports = { setupKnowledgeBase };
