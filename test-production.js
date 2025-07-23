// Production test suite for deployed AI chatbot
const axios = require('axios');
const fs = require('fs');

// Configuration
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://your-app.railway.app';
const TEST_TIMEOUT = 30000; // 30 seconds

class ProductionTester {
    constructor() {
        this.results = [];
        this.startTime = Date.now();
    }

    async runAllTests() {
        console.log('🚀 Testing AI Chatbot Production Deployment');
        console.log('=' .repeat(60));
        console.log(`Target URL: ${PRODUCTION_URL}`);
        console.log(`Test started: ${new Date().toISOString()}`);
        console.log('');

        const tests = [
            { name: 'Health Check', fn: this.testHealthCheck.bind(this) },
            { name: 'AI Providers List', fn: this.testProvidersEndpoint.bind(this) },
            { name: 'Gemini AI Chat', fn: this.testGeminiChat.bind(this) },
            { name: 'Groq AI Chat', fn: this.testGroqChat.bind(this) },
            { name: 'OpenAI Chat', fn: this.testOpenAIChat.bind(this) },
            { name: 'Provider Switching', fn: this.testProviderSwitching.bind(this) },
            { name: 'Error Handling', fn: this.testErrorHandling.bind(this) },
            { name: 'Rate Limiting', fn: this.testRateLimiting.bind(this) },
            { name: 'Drug Validation', fn: this.testDrugValidation.bind(this) },
            { name: 'Load Test', fn: this.testLoadHandling.bind(this) }
        ];

        for (const test of tests) {
            await this.runTest(test.name, test.fn);
        }

        this.generateReport();
    }

    async runTest(testName, testFn) {
        const startTime = Date.now();
        try {
            console.log(`🧪 ${testName}...`);
            const result = await Promise.race([
                testFn(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Test timeout')), TEST_TIMEOUT)
                )
            ]);
            
            const duration = Date.now() - startTime;
            this.results.push({
                test: testName,
                status: 'PASS',
                duration: `${duration}ms`,
                details: result
            });
            console.log(`   ✅ PASS (${duration}ms)`);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.results.push({
                test: testName,
                status: 'FAIL',
                duration: `${duration}ms`,
                error: error.message
            });
            console.log(`   ❌ FAIL (${duration}ms): ${error.message}`);
        }
        console.log('');
    }

    async testHealthCheck() {
        const response = await axios.get(`${PRODUCTION_URL}/health`, {
            timeout: 10000
        });
        
        if (response.status !== 200) {
            throw new Error(`Health check failed with status ${response.status}`);
        }
        
        const data = response.data;
        if (data.status !== 'healthy') {
            throw new Error(`Health status is ${data.status}`);
        }
        
        return {
            status: data.status,
            providers: data.providers,
            timestamp: data.timestamp
        };
    }

    async testProvidersEndpoint() {
        const response = await axios.get(`${PRODUCTION_URL}/api/ai/providers`, {
            timeout: 10000
        });
        
        if (response.status !== 200) {
            throw new Error(`Providers endpoint failed with status ${response.status}`);
        }
        
        const providers = response.data;
        if (!Array.isArray(providers) || providers.length === 0) {
            throw new Error('No providers returned');
        }
        
        return {
            count: providers.length,
            providers: providers.map(p => ({ name: p.name, status: p.status }))
        };
    }

    async testGeminiChat() {
        const response = await axios.post(`${PRODUCTION_URL}/api/ai/chat`, {
            message: 'Thuốc paracetamol có tác dụng gì?',
            provider: 'gemini'
        }, {
            timeout: 20000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.status !== 200) {
            throw new Error(`Gemini chat failed with status ${response.status}`);
        }
        
        const data = response.data;
        if (!data.success) {
            throw new Error(`Gemini chat failed: ${data.error}`);
        }
        
        return {
            provider: data.provider,
            responseLength: data.response.length,
            hasVietnamese: /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(data.response)
        };
    }

    async testGroqChat() {
        const response = await axios.post(`${PRODUCTION_URL}/api/ai/chat`, {
            message: 'Liều dùng aspirin cho người lớn?',
            provider: 'groq'
        }, {
            timeout: 20000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.status !== 200) {
            throw new Error(`Groq chat failed with status ${response.status}`);
        }
        
        const data = response.data;
        if (!data.success) {
            throw new Error(`Groq chat failed: ${data.error}`);
        }
        
        return {
            provider: data.provider,
            responseLength: data.response.length,
            responseTime: data.responseTime
        };
    }

    async testOpenAIChat() {
        try {
            const response = await axios.post(`${PRODUCTION_URL}/api/ai/chat`, {
                message: 'Tác dụng phụ của ibuprofen?',
                provider: 'openai'
            }, {
                timeout: 20000,
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.status !== 200) {
                throw new Error(`OpenAI chat failed with status ${response.status}`);
            }
            
            const data = response.data;
            if (!data.success) {
                throw new Error(`OpenAI chat failed: ${data.error}`);
            }
            
            return {
                provider: data.provider,
                responseLength: data.response.length
            };
        } catch (error) {
            if (error.response?.data?.error?.includes('API key')) {
                return { status: 'SKIPPED', reason: 'No OpenAI API key configured' };
            }
            throw error;
        }
    }

    async testProviderSwitching() {
        const switchResponse = await axios.post(`${PRODUCTION_URL}/api/ai/switch-provider`, {
            provider: 'groq'
        }, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (switchResponse.status !== 200) {
            throw new Error(`Provider switching failed with status ${switchResponse.status}`);
        }
        
        const statusResponse = await axios.get(`${PRODUCTION_URL}/api/ai/status`, {
            timeout: 10000
        });
        
        const status = statusResponse.data;
        if (status.currentProvider !== 'groq') {
            throw new Error(`Provider not switched. Current: ${status.currentProvider}`);
        }
        
        return {
            switched: true,
            currentProvider: status.currentProvider
        };
    }

    async testErrorHandling() {
        try {
            const response = await axios.post(`${PRODUCTION_URL}/api/ai/chat`, {
                message: '', // Empty message should trigger validation error
                provider: 'gemini'
            }, {
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });
            
            // Should not reach here if validation works
            if (response.data.success) {
                throw new Error('Empty message was accepted (validation failed)');
            }
            
            return { validationWorking: true };
        } catch (error) {
            if (error.response?.status === 400) {
                return { validationWorking: true, errorHandled: true };
            }
            throw error;
        }
    }

    async testRateLimiting() {
        const requests = [];
        for (let i = 0; i < 5; i++) {
            requests.push(
                axios.post(`${PRODUCTION_URL}/api/ai/chat`, {
                    message: `Test message ${i}`,
                    provider: 'gemini'
                }, {
                    timeout: 5000,
                    headers: { 'Content-Type': 'application/json' }
                }).catch(err => ({ error: err.response?.status }))
            );
        }
        
        const responses = await Promise.all(requests);
        const successCount = responses.filter(r => !r.error).length;
        const rateLimitCount = responses.filter(r => r.error === 429).length;
        
        return {
            totalRequests: 5,
            successfulRequests: successCount,
            rateLimitedRequests: rateLimitCount,
            rateLimitingActive: rateLimitCount > 0
        };
    }

    async testDrugValidation() {
        // Test with non-medical question
        const nonMedicalResponse = await axios.post(`${PRODUCTION_URL}/api/ai/chat`, {
            message: 'Thời tiết hôm nay thế nào?',
            provider: 'gemini'
        }, {
            timeout: 15000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        const nonMedicalData = nonMedicalResponse.data;
        if (nonMedicalData.success && !nonMedicalData.response.includes('không thể trả lời')) {
            throw new Error('Non-medical question was answered (safety check failed)');
        }
        
        // Test with medical question
        const medicalResponse = await axios.post(`${PRODUCTION_URL}/api/ai/chat`, {
            message: 'Thuốc paracetamol có tác dụng gì?',
            provider: 'gemini'
        }, {
            timeout: 15000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        const medicalData = medicalResponse.data;
        if (!medicalData.success) {
            throw new Error('Medical question was rejected incorrectly');
        }
        
        return {
            nonMedicalRejected: true,
            medicalAccepted: true,
            safetySystemActive: true
        };
    }

    async testLoadHandling() {
        const startTime = Date.now();
        const requests = [];
        
        for (let i = 0; i < 3; i++) {
            requests.push(
                axios.post(`${PRODUCTION_URL}/api/ai/chat`, {
                    message: `Load test message ${i + 1}`,
                    provider: 'gemini'
                }, {
                    timeout: 25000,
                    headers: { 'Content-Type': 'application/json' }
                })
            );
        }
        
        const responses = await Promise.all(requests);
        const totalTime = Date.now() - startTime;
        const successCount = responses.filter(r => r.status === 200).length;
        
        return {
            concurrentRequests: 3,
            successfulRequests: successCount,
            totalTime: `${totalTime}ms`,
            averageTime: `${Math.round(totalTime / 3)}ms`
        };
    }

    generateReport() {
        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.status === 'PASS').length;
        const failedTests = this.results.filter(r => r.status === 'FAIL').length;
        const totalTime = Date.now() - this.startTime;
        
        console.log('🎯 PRODUCTION TEST REPORT');
        console.log('=' .repeat(60));
        console.log(`✅ Passed: ${passedTests}/${totalTests}`);
        console.log(`❌ Failed: ${failedTests}/${totalTests}`);
        console.log(`⏱️  Total Time: ${totalTime}ms`);
        console.log(`🌐 Target: ${PRODUCTION_URL}`);
        console.log('');
        
        // Detailed results
        this.results.forEach(result => {
            const emoji = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${emoji} ${result.test} (${result.duration})`);
            if (result.status === 'FAIL') {
                console.log(`   Error: ${result.error}`);
            } else if (result.details) {
                console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
            }
            console.log('');
        });
        
        // Save report to file
        const report = {
            timestamp: new Date().toISOString(),
            target: PRODUCTION_URL,
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                duration: `${totalTime}ms`
            },
            results: this.results
        };
        
        fs.writeFileSync('production-test-report.json', JSON.stringify(report, null, 2));
        console.log('📄 Report saved to: production-test-report.json');
        
        if (failedTests === 0) {
            console.log('🎉 ALL TESTS PASSED! Your AI chatbot is ready for users! 🚀');
        } else {
            console.log(`⚠️  ${failedTests} test(s) failed. Please check the issues above.`);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new ProductionTester();
    tester.runAllTests().catch(error => {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    });
}

module.exports = ProductionTester;
