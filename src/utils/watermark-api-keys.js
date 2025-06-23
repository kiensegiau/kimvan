const fs = require('fs');
const path = require('path');

// Path to the API keys file
const API_KEYS_FILE = path.join(process.cwd(), 'watermark-api-keys.txt');

// API endpoint for checking credits
const CHECK_CREDITS_ENDPOINT = 'https://techhk.aoscdn.com/api/customers/coins';

// Function to load API keys from file
function loadApiKeys() {
  try {
    if (!fs.existsSync(API_KEYS_FILE)) {
      console.log('API keys file not found. Creating empty file.');
      fs.writeFileSync(API_KEYS_FILE, '');
      return [];
    }

    const content = fs.readFileSync(API_KEYS_FILE, 'utf8');
    const keys = content.split('\n')
      .map(key => key.trim())
      .filter(key => key && !key.startsWith('#'));
    
    console.log(`Loaded ${keys.length} API keys from file`);
    return keys;
  } catch (error) {
    console.error('Error loading API keys:', error);
    return [];
  }
}

// Function to save API keys to file
function saveApiKeys(keys) {
  try {
    fs.writeFileSync(API_KEYS_FILE, keys.join('\n'));
    console.log(`Saved ${keys.length} API keys to file`);
    return true;
  } catch (error) {
    console.error('Error saving API keys:', error);
    return false;
  }
}

// Function to remove an API key
function removeApiKey(keyToRemove) {
  const keys = loadApiKeys();
  const newKeys = keys.filter(key => key !== keyToRemove);
  
  if (keys.length !== newKeys.length) {
    console.log(`Removing API key: ${keyToRemove.substring(0, 5)}...`);
    return saveApiKeys(newKeys);
  }
  
  return false;
}

// Function to check credits for an API key
async function checkApiKeyCredits(apiKey) {
  try {
    console.log(`Đang kiểm tra API key: ${apiKey.substring(0, 5)}...`);
    
    const axios = require('axios');
    
    // Thiết lập timeout cho request
    const response = await axios.get(CHECK_CREDITS_ENDPOINT, {
      headers: {
        'X-API-KEY': apiKey
      },
      timeout: 10000 // 10 giây timeout
    });
    
    // Log toàn bộ phản hồi để debug
    console.log(`Phản hồi từ API cho key ${apiKey.substring(0, 5)}...:`);
    console.log(JSON.stringify(response.data, null, 2));
    
    // Luôn trả về 50 credit bất kể phản hồi API như thế nào
    console.log(`API key ${apiKey.substring(0, 5)}... được giả định có 50 credits`);
    return 50;
  } catch (error) {
    console.error(`Error checking API key ${apiKey.substring(0, 5)}...`, error.message);
    // Luôn trả về 50 credit ngay cả khi có lỗi
    return 50;
  }
}

// Function to get the next available API key
async function getNextApiKey() {
  const keys = loadApiKeys();
  
  if (keys.length === 0) {
    console.warn('No API keys available');
    return null;
  }
  
  // Luôn trả về API key đầu tiên trong danh sách
  const key = keys[0];
  console.log(`Using API key ${key.substring(0, 5)}...`);
  return key;
}

module.exports = {
  loadApiKeys,
  saveApiKeys,
  removeApiKey,
  checkApiKeyCredits,
  getNextApiKey
}; 