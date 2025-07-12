// Test script for token refresh functionality in remove-watermark module
require('dotenv').config();
const { getTokenByType, checkAllTokens } = require('../app/api/drive/remove-watermark/lib/utils');

async function testWatermarkTokenRefresh() {
  console.log('=== TESTING WATERMARK REMOVE MODULE TOKEN REFRESH ===');
  
  try {
    console.log('1. Testing download token:');
    const downloadToken = await getTokenByType('download');
    console.log('Download token test result:', downloadToken ? '✅ Success' : '❌ Failed');
    
    console.log('\n2. Testing upload token:');
    const uploadToken = await getTokenByType('upload');
    console.log('Upload token test result:', uploadToken ? '✅ Success' : '❌ Failed');
    
    console.log('\n3. Testing checkAllTokens:');
    const checkResult = await checkAllTokens();
    console.log('Check results:', JSON.stringify(checkResult, null, 2));
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
  }
}

testWatermarkTokenRefresh().catch(err => {
  console.error('Uncaught error:', err);
}); 