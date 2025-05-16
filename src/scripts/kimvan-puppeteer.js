// Script sử dụng Puppeteer để tự động đăng nhập và bắt request từ KimVan
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Đọc biến môi trường từ file kimvan.env
const envPath = path.join(__dirname, '../../kimvan.env');
if (fs.existsSync(envPath)) {
  console.log(`Đọc file biến môi trường: ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.warn(`Không tìm thấy file ${envPath}. Vui lòng tạo file này với thông tin đăng nhập KimVan.`);
}

// Đảm bảo thư mục logs tồn tại
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  console.log(`Tạo thư mục logs: ${logsDir}`);
  fs.mkdirSync(logsDir, { recursive: true });
}

// Thông tin đăng nhập KimVan
const KIMVAN_USERNAME = process.env.KIMVAN_USERNAME || 'your_username';
const KIMVAN_PASSWORD = process.env.KIMVAN_PASSWORD || 'your_password';

async function captureKimVanRequests(sheetName) {
  console.log('Bắt đầu khởi động trình duyệt với Puppeteer...');
  
  const browser = await puppeteer.launch({
    headless: false, // Hiển thị trình duyệt để dễ theo dõi
    defaultViewport: null, // Sử dụng kích thước mặc định của cửa sổ
    args: ['--start-maximized'] // Mở toàn màn hình
  });

  try {
    const page = await browser.newPage();
    
    // Lưu tất cả requests và responses
    const requests = [];
    
    // Lắng nghe tất cả network requests
    page.on('request', request => {
      // Chỉ quan tâm đến các API calls
      if (request.url().includes('kimvan.id.vn/api')) {
        console.log(`🚀 Request: ${request.method()} ${request.url()}`);
        
        const headers = request.headers();
        console.log('Headers:', JSON.stringify(headers, null, 2));
        
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: headers,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Lắng nghe responses
    page.on('response', async response => {
      if (response.url().includes('kimvan.id.vn/api')) {
        console.log(`📥 Response: ${response.status()} ${response.url()}`);
        try {
          const responseData = await response.json();
          console.log('Response data:', JSON.stringify(responseData, null, 2));
          
          // Thêm response vào request tương ứng
          const matchingRequest = requests.find(req => req.url === response.url());
          if (matchingRequest) {
            matchingRequest.response = {
              status: response.status(),
              data: responseData,
              headers: response.headers()
            };
          }
        } catch (e) {
          console.log('Không thể parse response JSON:', e.message);
        }
      }
    });

    // Điều hướng đến trang đăng nhập KimVan
    console.log('Đang truy cập trang đăng nhập KimVan...');
    await page.goto('https://kimvan.id.vn/login', { waitUntil: 'networkidle2' });
    
    // Đăng nhập vào KimVan
    console.log('Đang đăng nhập...');
    await page.type('input[name="username"]', KIMVAN_USERNAME);
    await page.type('input[name="password"]', KIMVAN_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Đợi điều hướng sau đăng nhập
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('Đăng nhập thành công!');
    
    // Lưu cookies sau khi đăng nhập
    const cookies = await page.cookies();
    console.log('Đã lưu cookies sau đăng nhập');
    
    // Thực hiện hành động tạo spreadsheet hoặc hành động đang gây lỗi 429
    console.log(`Đang thực hiện tạo spreadsheet: ${sheetName}...`);
    await page.goto(`https://kimvan.id.vn/spreadsheets/create/${sheetName}`, { waitUntil: 'networkidle2' });
    
    // Đợi một khoảng thời gian để đảm bảo tất cả requests được hoàn thành
    await page.waitForTimeout(5000);
    
    // Lưu kết quả vào file để phân tích sau
    const outputDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, `kimvan-requests-${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      cookies: cookies,
      requests: requests
    }, null, 2));
    
    console.log(`Đã lưu thông tin requests và responses vào file: ${outputFile}`);
    
    // Trích xuất thông tin xác thực để sử dụng cho API
    const authInfo = extractAuthInfo(cookies, requests);
    console.log('Thông tin xác thực để sử dụng trong API:');
    console.log(JSON.stringify(authInfo, null, 2));
    
    return authInfo;
    
  } catch (error) {
    console.error('Lỗi:', error);
  } finally {
    // Đóng trình duyệt
    await browser.close();
    console.log('Đã đóng trình duyệt.');
  }
}

// Hàm trích xuất thông tin xác thực từ cookies và requests
function extractAuthInfo(cookies, requests) {
  // Tìm session cookie hoặc JWT token
  const authCookie = cookies.find(c => c.name === 'connect.sid' || c.name.toLowerCase().includes('token'));
  
  // Tìm headers Authorization trong các requests
  const authRequest = requests.find(r => r.headers && r.headers.Authorization);
  
  return {
    cookieAuth: authCookie ? {
      name: authCookie.name,
      value: authCookie.value,
      cookieString: `${authCookie.name}=${authCookie.value}`
    } : null,
    bearerToken: authRequest?.headers?.Authorization
  };
}

// Chạy script với tên spreadsheet là tham số
const sheetName = process.argv[2] || 'test-sheet-' + Date.now();
captureKimVanRequests(sheetName)
  .then(authInfo => {
    console.log('Hoàn thành!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Lỗi:', err);
    process.exit(1);
  }); 