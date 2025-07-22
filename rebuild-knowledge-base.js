const DocumentProcessor = require('./utils/documentProcessor');
const path = require('path');

/**
 * Script để rebuild knowledge base từ documents
 */
async function main() {
    console.log('🔄 Rebuilding PedMed Chatbot Knowledge Base...');
    
    const processor = new DocumentProcessor();
    const documentsDir = path.join(__dirname, 'documents');
    const outputPath = path.join(__dirname, 'data', 'knowledge_base.json');
    
    try {
        const knowledgeBase = await processor.buildKnowledgeBase(documentsDir, outputPath);
        
        console.log('\n📊 Knowledge Base Statistics:');
        console.log(`- Total documents: ${knowledgeBase.length}`);
        console.log(`- Sources: ${[...new Set(knowledgeBase.map(doc => doc.source))].length}`);
        console.log(`- Average keywords per doc: ${Math.round(knowledgeBase.reduce((sum, doc) => sum + doc.keywords.length, 0) / knowledgeBase.length)}`);
        
        // Show top keywords
        const allKeywords = {};
        knowledgeBase.forEach(doc => {
            doc.keywords.forEach(keyword => {
                allKeywords[keyword] = (allKeywords[keyword] || 0) + 1;
            });
        });
        
        const topKeywords = Object.entries(allKeywords)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([keyword, count]) => `${keyword} (${count})`);
            
        console.log(`- Top keywords: ${topKeywords.join(', ')}`);
        
        console.log('\n✅ Knowledge base rebuilt successfully!');
        console.log('\n🚀 Next steps:');
        console.log('1. Restart your server');
        console.log('2. Test chatbot with relevant questions');
        console.log('3. Monitor response accuracy');
        console.log('4. Add more documents if needed');
        
    } catch (error) {
        console.error('❌ Error rebuilding knowledge base:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
