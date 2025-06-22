// Test script for Google Drive API
const fetch = require('node-fetch');

async function testProcessAndReplace() {
  try {
    console.log('Testing process-and-replace API...');
    
    const response = await fetch('http://localhost:3000/api/drive/process-and-replace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        driveLink: 'https://drive.google.com/file/d/1Qs4Oi8OGZ-t2HKGX5PUH4-FMVcVYdI9N/view'
      })
    });
    
    const result = await response.json();
    console.log('API Response:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('Test successful!');
    } else {
      console.error('Test failed with status:', response.status);
    }
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

// Run the test
testProcessAndReplace(); 