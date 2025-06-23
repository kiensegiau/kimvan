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
    console.log(`Removing depleted API key: ${keyToRemove}`);
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
    
    if (response.data?.status === 200) {
      // Phân tích dữ liệu theo định dạng chính xác từ tài liệu API
      const services = response.data.data;
      
      // Kiểm tra nếu data là mảng các dịch vụ (định dạng theo tài liệu)
      if (Array.isArray(services)) {
        // Tìm dịch vụ "cov" (watermark remover)
        const covService = services.find(service => service.service_name === 'cov');
        if (covService) {
          // Tính tổng credits = lifetime_limit - lifetime_used + period_limit - period_used
          const lifetimeRemaining = Math.max(0, covService.lifetime_limit - covService.lifetime_used);
          const periodRemaining = Math.max(0, covService.period_limit - covService.period_used);
          const totalCredits = lifetimeRemaining + periodRemaining;
          console.log(`API key ${apiKey.substring(0, 5)}... có ${totalCredits} credits (lifetime: ${lifetimeRemaining}, period: ${periodRemaining})`);
          return totalCredits;
        }
        
        // Nếu không tìm thấy dịch vụ "cov", kiểm tra tất cả các dịch vụ
        let totalCredits = 0;
        for (const service of services) {
          const lifetimeRemaining = Math.max(0, service.lifetime_limit - service.lifetime_used);
          const periodRemaining = Math.max(0, service.period_limit - service.period_used);
          const serviceCredits = lifetimeRemaining + periodRemaining;
          totalCredits += serviceCredits;
          console.log(`Dịch vụ ${service.service_name}: ${serviceCredits} credits (lifetime: ${lifetimeRemaining}, period: ${periodRemaining})`);
        }
        
        console.log(`API key ${apiKey.substring(0, 5)}... có tổng ${totalCredits} credits từ tất cả dịch vụ`);
        return totalCredits;
      } 
      
      // Nếu không có dữ liệu dịch vụ hợp lệ, nhưng API trả về thành công, giả định có 50 credits
      console.log(`API key ${apiKey.substring(0, 5)}... không có dữ liệu dịch vụ hợp lệ, nhưng API trả về thành công. Giả định có 50 credits.`);
      return 50;
    }
    
    console.log(`API key ${apiKey.substring(0, 5)}... trả về status không hợp lệ: ${response.data?.status}`);
    return 0;
  } catch (error) {
    console.error(`Error checking API key ${apiKey.substring(0, 5)}...`, error.message);
    
    // Nếu lỗi là do không thể kết nối đến API, ném lỗi để xử lý ở cấp cao hơn
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      throw new Error(`Cannot connect to API: ${error.message}`);
    }
    
    // Nếu lỗi là do API key không hợp lệ, trả về 0 credits
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log(`API key ${apiKey.substring(0, 5)}... không hợp lệ (401/403)`);
      return 0;
    }
    
    // Các lỗi khác, trả về 0 credits
    return 0;
  }
}

// Function to get the next available API key
async function getNextApiKey() {
  const keys = loadApiKeys();
  
  if (keys.length === 0) {
    console.warn('No API keys available');
    return null;
  }
  
  // Try each key until we find one with credits
  for (const key of keys) {
    try {
      const credits = await checkApiKeyCredits(key);
      
      if (credits > 0) {
        console.log(`Using API key ${key.substring(0, 5)}... with ${credits} credits`);
        return key;
      } else {
        console.log(`API key ${key.substring(0, 5)}... has no credits. Removing...`);
        removeApiKey(key);
      }
    } catch (error) {
      console.error(`Error checking API key ${key.substring(0, 5)}...`, error.message);
      // Nếu không thể kiểm tra credits, vẫn thử sử dụng key này
      console.log(`Cannot verify credits for API key ${key.substring(0, 5)}..., but will try to use it anyway`);
      return key;
    }
  }
  
  console.warn('All API keys depleted');
  return null;
}

module.exports = {
  loadApiKeys,
  saveApiKeys,
  removeApiKey,
  checkApiKeyCredits,
  getNextApiKey
}; 