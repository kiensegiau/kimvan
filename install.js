const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔧 Running custom installation for Vercel build...');

// Install ESLint
try {
  console.log('📦 Installing ESLint...');
  execSync('npm install --save-dev eslint@9 eslint-config-next eslint-plugin-react eslint-plugin-react-hooks', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Failed to install ESLint:', error.message);
}

// Create .eslintrc.json if it doesn't exist
if (!fs.existsSync('.eslintrc.json')) {
  console.log('📝 Creating ESLint configuration...');
  const eslintConfig = {
    "extends": "next/core-web-vitals",
    "rules": {
      "react/no-unescaped-entities": "off"
    }
  };
  fs.writeFileSync('.eslintrc.json', JSON.stringify(eslintConfig, null, 2));
}

// Install Sharp for Linux x64 specifically
try {
  console.log('📦 Installing Sharp for Linux x64...');
  execSync('npm uninstall sharp && npm install --platform=linux --arch=x64 sharp@0.34.1', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Failed to install Sharp:', error.message);
}

console.log('✅ Custom installation completed successfully!'); 