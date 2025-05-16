// Script auto-browser.js - Tự động hoá toàn bộ quá trình
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const util = require('util');

// Chuyển đổi exec thành promise
const execAsync = util.promisify(exec);

// Thư mục kết quả và xử lý
const resultsDir = path.join(__dirname, '../../results');
const processedDir = path.join(__dirname, '../../processed');

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(resultsDir)) {
  console.log(`Tạo thư mục results: ${resultsDir}`);
  fs.mkdirSync(resultsDir, { recursive: true });
}
if (!fs.existsSync(processedDir)) {
  console.log(`Tạo thư mục processed: ${processedDir}`);
  fs.mkdirSync(processedDir, { recursive: true });
}

/**
 * Tạo URL tìm kiếm danh sách sheet
 * @param {string} sheetName - Tên sheet cần tìm
 * @param {number} timestamp - Timestamp để tránh cache
 * @returns {string} URL đầy đủ
 */
function createListUrl(sheetName, timestamp) {
  const baseUrl = `https://kimvan.id.vn/api/spreadsheets/create/${encodeURIComponent(sheetName)}`;
  // Thêm timestamp vào URL để tránh cache và luôn lấy dữ liệu mới
  return `${baseUrl}?t=${timestamp}`;
}

/**
 * Tạo URL lấy dữ liệu chi tiết của sheet
 * @param {string} sheetId - ID của sheet
 * @param {number} timestamp - Timestamp để tránh cache
 * @returns {string} URL đầy đủ
 */
function createDetailUrl(sheetId, timestamp) {
  const baseUrl = `https://kimvan.id.vn/api/spreadsheets/${encodeURIComponent(sheetId)}`;
  // Thêm timestamp vào URL để tránh cache và luôn lấy dữ liệu mới
  return `${baseUrl}?t=${timestamp}`;
}

/**
 * Xử lý dữ liệu đã lấy
 */
async function processResults() {
  try {
    // Chạy script process-results.js
    console.log('Đang xử lý dữ liệu...');
    const scriptPath = path.join(__dirname, 'process-results.js');
    const { stdout, stderr } = await execAsync(`node "${scriptPath}"`);
    
    if (stderr) {
      console.error('Lỗi khi xử lý dữ liệu:', stderr);
    }
    
    console.log('Kết quả xử lý dữ liệu:', stdout);
    return true;
  } catch (error) {
    console.error('Lỗi khi xử lý dữ liệu:', error);
    return false;
  }
}

/**
 * Tự động lấy và lưu dữ liệu từ API KimVan
 * @param {string} sheetName - Tên sheet cần lấy
 * @param {Array<string>} sheetIds - Danh sách ID sheet (nếu đã biết)
 * @param {Object} options - Tuỳ chọn
 */
async function autoFetchData(sheetName, sheetIds = [], options = {}) {
  const timestamp = options.timestamp || Date.now();
  const waitTime = options.waitTime || 5000; // 5 giây mặc định
  
  try {
    console.log(`===== BẮT ĐẦU TỰ ĐỘNG LẤY DỮ LIỆU CHO "${sheetName}" =====`);
    console.log(`Timestamp: ${timestamp}`);
    
    // 1. Khởi động trình duyệt headless
    console.log('Khởi động trình duyệt...');
    const browser = await puppeteer.launch({
      headless: true, // Chạy ẩn
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      // 2. Lấy danh sách sheet
      console.log(`\n[1] Lấy danh sách sheet cho "${sheetName}"...`);
      const listUrl = createListUrl(sheetName, timestamp);
      console.log(`URL: ${listUrl}`);
      
      const listPage = await browser.newPage();
      await listPage.goto(listUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Lấy nội dung JSON
      const listContent = await listPage.evaluate(() => document.body.innerText);
      let listData;
      
      try {
        listData = JSON.parse(listContent);
        // Lưu file JSON
        const listFileName = `${sheetName}-list.json`;
        const listFilePath = path.join(resultsDir, listFileName);
        fs.writeFileSync(listFilePath, JSON.stringify(listData, null, 2));
        console.log(`Đã lưu danh sách sheet vào: ${listFilePath}`);
        
        // Nếu không có ID được cung cấp, lấy từ danh sách
        if (sheetIds.length === 0 && Array.isArray(listData) && listData.length > 0) {
          sheetIds = listData.map(item => item.id);
          console.log(`Đã lấy ${sheetIds.length} ID sheet từ danh sách`);
        }
      } catch (parseError) {
        console.error('Lỗi khi xử lý dữ liệu danh sách:', parseError);
        console.log('Nội dung nhận được:', listContent.slice(0, 500) + '...');
        
        // Lưu nội dung thô để kiểm tra
        const rawFileName = `${sheetName}-list-raw.txt`;
        const rawFilePath = path.join(resultsDir, rawFileName);
        fs.writeFileSync(rawFilePath, listContent);
        console.log(`Đã lưu nội dung thô vào: ${rawFilePath}`);
      }
      
      await listPage.close();
      console.log('Đã đóng tab danh sách sheet');
      
      // Đợi để tránh rate limit
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // 3. Lấy chi tiết sheet (nếu có ID)
      if (sheetIds && sheetIds.length > 0) {
        console.log(`\nĐã tìm thấy ${sheetIds.length} ID sheet để lấy chi tiết`);
        
        for (let i = 0; i < sheetIds.length; i++) {
          const sheetId = sheetIds[i];
          const shortId = sheetId.substring(0, 10);
          
          console.log(`\n[${i + 2}] Lấy chi tiết sheet ${i + 1}/${sheetIds.length}: ${shortId}...`);
          const detailUrl = createDetailUrl(sheetId, timestamp);
          console.log(`URL: ${detailUrl}`);
          
          const detailPage = await browser.newPage();
          await detailPage.goto(detailUrl, { waitUntil: 'networkidle0', timeout: 30000 });
          
          // Lấy nội dung JSON
          const detailContent = await detailPage.evaluate(() => document.body.innerText);
          let detailData;
          
          try {
            detailData = JSON.parse(detailContent);
            // Lưu file JSON
            const detailFileName = `${sheetName}-${shortId}-detail.json`;
            const detailFilePath = path.join(resultsDir, detailFileName);
            fs.writeFileSync(detailFilePath, JSON.stringify(detailData, null, 2));
            console.log(`Đã lưu chi tiết sheet vào: ${detailFilePath}`);
          } catch (parseError) {
            console.error('Lỗi khi xử lý dữ liệu chi tiết:', parseError);
            console.log('Nội dung nhận được:', detailContent.slice(0, 500) + '...');
            
            // Lưu nội dung thô để kiểm tra
            const rawFileName = `${sheetName}-${shortId}-detail-raw.txt`;
            const rawFilePath = path.join(resultsDir, rawFileName);
            fs.writeFileSync(rawFilePath, detailContent);
            console.log(`Đã lưu nội dung thô vào: ${rawFilePath}`);
          }
          
          await detailPage.close();
          console.log(`Đã đóng tab chi tiết sheet ${shortId}`);
          
          // Đợi để tránh rate limit (nếu còn sheet tiếp theo)
          if (i < sheetIds.length - 1) {
            console.log(`Đợi ${waitTime/1000} giây trước khi lấy sheet tiếp theo...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
    } finally {
      // Đóng trình duyệt
      await browser.close();
      console.log('Đã đóng trình duyệt');
    }
    
    // 4. Xử lý dữ liệu đã lấy
    console.log('\n===== XỬ LÝ DỮ LIỆU =====');
    await processResults();
    
    console.log('\n===== HOÀN THÀNH =====');
    console.log(`Đã tự động lấy và xử lý dữ liệu cho sheet "${sheetName}"`);
    console.log('Kết quả được lưu trong thư mục:');
    console.log(`- Dữ liệu thô: ${resultsDir}`);
    console.log(`- Dữ liệu đã xử lý: ${processedDir}`);
    
    return true;
  } catch (error) {
    console.error('Lỗi khi tự động lấy dữ liệu:', error);
    return false;
  }
}

// Lấy tham số từ dòng lệnh
const sheetName = process.argv[2] || 'fullcombokhoa2k8';
let sheetIds = [];
const options = {
  waitTime: 5000, // 5 giây mặc định
  timestamp: Date.now()
};

// Kiểm tra ID sheet
if (process.argv.length > 3) {
  const arg3 = process.argv[3];
  if (!arg3.startsWith('--')) {
    sheetIds = arg3.split(',').map(id => id.trim());
    console.log(`Đã cung cấp ${sheetIds.length} ID sheet`);
  }
}

// Xử lý tham số
for (let i = 3; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--wait=')) {
    const waitSec = parseInt(arg.split('=')[1]);
    if (!isNaN(waitSec) && waitSec > 0) {
      options.waitTime = waitSec * 1000;
      console.log(`Đã thiết lập thời gian chờ: ${waitSec} giây`);
    }
  }
}

// Chạy hàm chính
autoFetchData(sheetName, sheetIds, options)
  .then(() => {
    console.log('Script tự động hoá hoàn tất.');
  })
  .catch(err => {
    console.error('Lỗi khi chạy script tự động hoá:', err);
  }); 