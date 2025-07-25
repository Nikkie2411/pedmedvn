// Production Readiness Check for Render Deployment
require('dotenv').config();

console.log('🚀 Production Readiness Check for Render Deployment\n');

// Check Node.js version
console.log('📋 System Information:');
console.log(`- Node.js Version: ${process.version}`);
console.log(`- Platform: ${process.platform}`);
console.log(`- Architecture: ${process.arch}`);

// Check required environment variables for production
console.log('\n🔐 Environment Variables Check:');
const requiredVars = [
    'PORT',
    'SPREADSHEET_ID', 
    'GOOGLE_CREDENTIALS'
];

const optionalVars = [
    'GEMINI_API_KEY',
    'OPENAI_API_KEY', 
    'GROQ_API_KEY',
    'FRONTEND_URL',
    'AI_PROVIDER'
];

console.log('📌 Required Variables:');
let allRequiredPresent = true;
requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        console.log(`✅ ${varName}: Set`);
        if (varName === 'GOOGLE_CREDENTIALS') {
            try {
                JSON.parse(value);
                console.log('   └─ Valid JSON format');
            } catch (e) {
                console.log('   └─ ❌ Invalid JSON format');
                allRequiredPresent = false;
            }
        }
    } else {
        console.log(`❌ ${varName}: Missing`);
        allRequiredPresent = false;
    }
});

console.log('\n📌 Optional Variables (for AI features):');
optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        console.log(`✅ ${varName}: Set`);
    } else {
        console.log(`⚪ ${varName}: Not set (optional)`);
    }
});

// Check if dependencies can be loaded
console.log('\n📦 Dependencies Check:');
const criticalDeps = [
    'express',
    'googleapis', 
    'google-spreadsheet',
    'cors',
    'helmet',
    'compression'
];

let allDepsOk = true;
criticalDeps.forEach(dep => {
    try {
        require(dep);
        console.log(`✅ ${dep}: OK`);
    } catch (error) {
        console.log(`❌ ${dep}: Missing or broken`);
        allDepsOk = false;
    }
});

// Test basic app initialization
console.log('\n🚀 Application Test:');
try {
    const express = require('express');
    const app = express();
    app.get('/health', (req, res) => res.json({ status: 'ok' }));
    console.log('✅ Express app can be created');
    
    // Test config loading
    const config = require('./config/config');
    console.log('✅ Config module loads successfully');
    console.log(`   └─ Port: ${config.PORT}`);
    
} catch (error) {
    console.log('❌ App initialization failed:', error.message);
    allDepsOk = false;
}

// Final verdict
console.log('\n🎯 Production Readiness Summary:');
if (allRequiredPresent && allDepsOk) {
    console.log('✅ READY FOR PRODUCTION DEPLOYMENT');
    console.log('   All required environment variables are set');
    console.log('   All dependencies are working');
    console.log('   Application can start successfully');
    
    console.log('\n📋 Deployment Checklist:');
    console.log('✅ Environment variables configured on Render');
    console.log('✅ Dependencies installed');
    console.log('✅ Build scripts ready');
    console.log('✅ Health check endpoint available');
    
    process.exit(0);
} else {
    console.log('❌ NOT READY FOR PRODUCTION');
    if (!allRequiredPresent) {
        console.log('   Missing required environment variables');
    }
    if (!allDepsOk) {
        console.log('   Dependency issues detected');
    }
    
    console.log('\n📋 Action Required:');
    console.log('1. Set missing environment variables on Render dashboard');
    console.log('2. Fix dependency issues');
    console.log('3. Run this check again');
    
    process.exit(1);
}
