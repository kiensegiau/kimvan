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
    return saveApiKeys(newKeys);
  }
  
  return false;
}

// Function to check credits for an API key
async function checkApiKeyCredits(apiKey) {
  try {
    const axios = require('axios');
    
    // Thiết lập timeout cho request
    const response = await axios.get(CHECK_CREDITS_ENDPOINT, {
      headers: {
        'X-API-KEY': apiKey
      },
      timeout: 10000 // 10 giây timeout
    });
    
    // Luôn trả về 50 credit bất kể phản hồi API như thế nào
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
  return key;
}

module.exports = {
  loadApiKeys,
  saveApiKeys,
  removeApiKey,
  checkApiKeyCredits,
  getNextApiKey
}; 