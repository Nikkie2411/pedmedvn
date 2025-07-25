// Test drug search in Google Sheets
require('dotenv').config();
const { loadDrugData } = require('./services/drugSheets');

async function testDrugSearch() {
    try {
        console.log('🔍 Testing drug search in Google Sheets...\n');
        
        // Load all drug data
        console.log('📊 Loading drug data from Google Sheets...');
        const drugData = await loadDrugData('pedmedvnch');
        
        console.log(`✅ Loaded ${drugData.length} drugs from Google Sheets\n`);
        
        if (drugData.length === 0) {
            console.log('❌ No drug data found!');
            return;
        }
        
        // Search for tigecyclin
        console.log('🔍 Searching for "tigecyclin"...');
        const tigecyclinDrugs = drugData.filter(drug => {
            const name = drug.name.toLowerCase();
            const content = drug.searchableContent.toLowerCase();
            return name.includes('tigecyclin') || content.includes('tigecyclin');
        });
        
        console.log(`Found ${tigecyclinDrugs.length} drugs matching "tigecyclin":\n`);
        
        tigecyclinDrugs.forEach((drug, index) => {
            console.log(`${index + 1}. ${drug.name}`);
            console.log(`   ID: ${drug.id}`);
            console.log(`   Source: ${drug.source}`);
            
            // Check for contraindication info
            const content = drug.structuredContent;
            if (content.toLowerCase().includes('chống chỉ định') || 
                content.toLowerCase().includes('contraindication') ||
                content.toLowerCase().includes('kiêng kỵ')) {
                console.log('   ✅ Contains contraindication information');
                
                // Extract contraindication section
                const lines = content.split('\n');
                const contraindicationLines = lines.filter(line => 
                    line.toLowerCase().includes('chống chỉ định') ||
                    line.toLowerCase().includes('contraindication') ||
                    line.toLowerCase().includes('kiêng kỵ') ||
                    line.includes('3. CHỐNG CHỈ ĐỊNH')
                );
                
                if (contraindicationLines.length > 0) {
                    console.log('   📋 Contraindication info found:');
                    contraindicationLines.forEach(line => {
                        console.log(`      ${line.substring(0, 100)}...`);
                    });
                }
            } else {
                console.log('   ❌ No contraindication information found');
            }
            
            console.log(`   Content preview: ${drug.structuredContent.substring(0, 200)}...\n`);
        });
        
        // Also search more broadly for any drug containing tigecyclin
        console.log('🔍 Broader search for any mention of tigecyclin...');
        const broadSearch = drugData.filter(drug => {
            return drug.structuredContent.toLowerCase().includes('tigecyclin') ||
                   drug.searchableContent.toLowerCase().includes('tigecyclin');
        });
        
        console.log(`Found ${broadSearch.length} drugs mentioning "tigecyclin" in content\n`);
        
        if (broadSearch.length === 0) {
            console.log('❌ No drugs found containing "tigecyclin"');
            console.log('\n📋 First 10 drugs in database:');
            drugData.slice(0, 10).forEach((drug, index) => {
                console.log(`${index + 1}. ${drug.name}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error testing drug search:', error);
    }
}

testDrugSearch();
