// Script sử dụng Puppeteer để mở trình duyệt và truy cập trực tiếp vào các link KimVan
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

// Đường dẫn để lưu kết quả
const resultsDir = path.join(__dirname, '../../results');
if (!fs.existsSync(resultsDir)) {
  console.log(`Tạo thư mục results: ${resultsDir}`);
  fs.mkdirSync(resultsDir, { recursive: true });
}

/**
 * Hàm mở trình duyệt và truy cập trực tiếp vào các link
 * @param {string} sheetName - Tên sheet để tìm kiếm (ví dụ: fullcombokhoa2k8)
 */
async function directRequest(sheetName) {
  console.log('Bắt đầu khởi động trình duyệt với Puppeteer...');
  
  // Kết nối đến Chrome đang chạy thay vì khởi động một trình duyệt mới
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',  // Chrome DevTools protocol URL 
    defaultViewport: null                 // Sử dụng kích thước mặc định của cửa sổ
  });

  try {
    // Mở tab mới
    const page = await browser.newPage();
    
    // Lưu tất cả responses để xử lý sau
    const responses = {};
    const sheetIds = [];
    
    // Lắng nghe tất cả network responses
    page.on('response', async response => {
      const url = response.url();
      
      // Chỉ quan tâm đến các API calls
      if (url.includes('kimvan.id.vn/api/spreadsheets/')) {
        try {
          // Lấy status code và nội dung
          const status = response.status();
          console.log(`📥 Response: ${status} ${url}`);
          
          // Chỉ xử lý responses thành công
          if (status === 200) {
            try {
              const responseData = await response.json();
              
              // Lưu response theo URL
              responses[url] = {
                url,
                status,
                data: responseData,
                timestamp: new Date().toISOString()
              };
              
              // Nếu là response danh sách sheet, lưu các ID
              if (url.includes('/create/') && Array.isArray(responseData)) {
                console.log(`Tìm thấy ${responseData.length} sheets cho "${sheetName}"`);
                responseData.forEach(sheet => {
                  if (sheet.id && sheet.name) {
                    console.log(`- ${sheet.name} (ID: ${sheet.id.substring(0, 10)}...)`);
                    sheetIds.push(sheet.id);
                  }
                });
              }
            } catch (error) {
              console.error(`Lỗi khi parse JSON từ response: ${url}`, error);
            }
          }
        } catch (error) {
          console.error(`Lỗi khi xử lý response từ: ${url}`, error);
        }
      }
    });

    // Kiểm tra trang KimVan - nếu đã đăng nhập, tiếp tục; nếu chưa, hiển thị thông báo
    console.log('Kiểm tra đăng nhập KimVan...');
    await page.goto('https://kimvan.id.vn', { waitUntil: 'networkidle2' });
    
    // Kiểm tra nếu đã đăng nhập (kiểm tra phần tử chỉ xuất hiện sau khi đăng nhập)
    const isLoggedIn = await page.evaluate(() => {
      // Kiểm tra đăng nhập bằng cách tìm phần tử có thể chỉ xuất hiện khi đã đăng nhập
      // (ví dụ: nút logout, tên người dùng, vv...)
      return !document.querySelector('.login-form') && !window.location.href.includes('/login');
    });

    if (!isLoggedIn) {
      console.error('CẢNH BÁO: Bạn chưa đăng nhập vào KimVan! Vui lòng đăng nhập trước khi chạy script.');
      return null;
    }
    
    console.log('Đã xác nhận đăng nhập thành công!');
    
    // Lưu cookies để sử dụng sau này nếu cần
    const cookies = await page.cookies();
    
    // 1. Truy cập trang danh sách sheet theo tên
    console.log(`Đang truy cập danh sách sheet cho "${sheetName}"...`);
    const listUrl = `https://kimvan.id.vn/api/spreadsheets/create/${sheetName}`;
    
    // Đến trang danh sách sheet 
    await page.goto(listUrl, { waitUntil: 'networkidle2' });
    console.log('Đã tải danh sách sheet');
    
    // Đợi một chút để đảm bảo response đã được xử lý
    await page.waitForTimeout(2000);
    
    // 2. Truy cập từng sheet ID để lấy nội dung chi tiết
    console.log(`Tìm thấy ${sheetIds.length} sheet ID để truy cập`);
    
    for (let i = 0; i < sheetIds.length; i++) {
      const sheetId = sheetIds[i];
      console.log(`Đang truy cập sheet ${i + 1}/${sheetIds.length}: ${sheetId.substring(0, 15)}...`);
      
      const detailUrl = `https://kimvan.id.vn/api/spreadsheets/${sheetId}`;
      await page.goto(detailUrl, { waitUntil: 'networkidle2' });
      
      // Đợi một chút để đảm bảo response đã được xử lý
      await page.waitForTimeout(1000);
    }
    
    // Lưu tất cả responses vào file
    console.log('Đang lưu kết quả...');
    
    // 1. Lưu file logs chứa thông tin tổng quan và cookies
    const logFile = path.join(logsDir, `kimvan-browser-log-${Date.now()}.json`);
    fs.writeFileSync(logFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      sheetName,
      cookies,
      responseUrls: Object.keys(responses)
    }, null, 2));
    
    // 2. Lưu mỗi response riêng biệt trong thư mục results
    for (const url in responses) {
      try {
        // Tạo tên file từ URL
        const urlParts = url.split('/');
        let fileName;
        
        if (url.includes('/create/')) {
          fileName = `${sheetName}-list-${Date.now()}.json`;
        } else {
          // Lấy phần ID của sheet từ URL
          const sheetId = urlParts[urlParts.length - 1];
          fileName = `${sheetName}-${sheetId.substring(0, 10)}-${Date.now()}.json`;
        }
        
        const resultFile = path.join(resultsDir, fileName);
        fs.writeFileSync(resultFile, JSON.stringify(responses[url].data, null, 2));
        console.log(`Đã lưu kết quả từ ${url} vào file: ${fileName}`);
      } catch (error) {
        console.error(`Lỗi khi lưu kết quả cho URL: ${url}`, error);
      }
    }
    
    console.log(`Đã lưu tổng cộng ${Object.keys(responses).length} responses`);
    console.log(`Log file: ${logFile}`);
    console.log(`Kết quả được lưu trong thư mục: ${resultsDir}`);
    
    return {
      cookies,
      responses: Object.values(responses)
    };
    
  } catch (error) {
    console.error('Lỗi:', error);
  } finally {
    console.log('Đóng tab trình duyệt. Trình duyệt chính vẫn giữ nguyên.');
    // Chỉ đóng các trang đã mở, không đóng trình duyệt
    if (browser && browser.disconnect) {
      browser.disconnect();
    }
  }
}

// Hàm để khởi động Chrome với remote debugging
async function startChromeWithRemoteDebugging() {
  const { execSync } = require('child_process');
  try {
    console.log('Khởi động Chrome với remote debugging...');
    
    // Command cho Windows
    const chromeCommand = 'start chrome --remote-debugging-port=9222';
    
    // Thực thi lệnh
    execSync(chromeCommand);
    console.log('Đã khởi động Chrome. Hãy đăng nhập vào KimVan và chạy lại script.');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi khởi động Chrome:', error);
    process.exit(1);
  }
}

// Chạy script với tên spreadsheet là tham số dòng lệnh
const sheetName = process.argv[2] || 'fullcombokhoa2k8';

// Kiểm tra nếu đối số chỉ định khởi động Chrome với remote debugging
if (process.argv.includes('--start-chrome')) {
  startChromeWithRemoteDebugging();
} else {
  // Thử kết nối với Chrome
  directRequest(sheetName)
    .then((result) => {
      if (result) {
        console.log('Hoàn thành!');
      } else {
        console.log('Có lỗi xảy ra. Vui lòng khởi động Chrome trước với lệnh:');
        console.log('node src/scripts/kimvan-direct-request.js --start-chrome');
      }
      process.exit(0);
    })
    .catch(err => {
      console.error('Lỗi khi kết nối với Chrome:', err);
      console.log('Vui lòng khởi động Chrome với remote debugging trước bằng lệnh:');
      console.log('node src/scripts/kimvan-direct-request.js --start-chrome');
      process.exit(1);
    });
} 