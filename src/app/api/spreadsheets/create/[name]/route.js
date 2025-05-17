import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';

// Thư mục kết quả và xử lý
const resultsDir = path.join(process.cwd(), 'results');
const processedDir = path.join(process.cwd(), 'processed');

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}
if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

/**
 * Dọn dẹp thư mục kết quả sau khi đã xử lý thành công
 * @param {boolean} keepProcessedFiles - Có giữ lại file đã xử lý không
 * @returns {number} Số lượng file đã xóa
 */
function cleanupFolders(keepProcessedFiles = false) {
  try {
    console.log('\n===== BẮT ĐẦU DỌN DẸP THƯ MỤC =====');
    let filesDeleted = 0;
    
    // 1. Dọn dẹp thư mục kết quả tạm thời
    if (fs.existsSync(resultsDir)) {
      const files = fs.readdirSync(resultsDir);
      console.log(`Tìm thấy ${files.length} file trong thư mục kết quả tạm thời`);
      
      for (const file of files) {
        const filePath = path.join(resultsDir, file);
        
        // Kiểm tra đây có phải là file không
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          filesDeleted++;
          console.log(`Đã xóa file: ${file}`);
        }
      }
      
      console.log(`Đã xóa ${filesDeleted} file từ thư mục kết quả tạm thời`);
    }
    
    // 2. Nếu cần, dọn dẹp thư mục đã xử lý (giữ file index.json và file mới nhất)
    if (!keepProcessedFiles && fs.existsSync(processedDir)) {
      const indexPath = path.join(processedDir, 'index.json');
      let latestFile = null;
      
      // Tìm file mới nhất từ index.json
      if (fs.existsSync(indexPath)) {
        try {
          const indexContent = fs.readFileSync(indexPath, 'utf8');
          const indexData = JSON.parse(indexContent);
          latestFile = indexData.lastProcessed;
        } catch (error) {
          console.error('Lỗi khi đọc file index.json:', error.message);
        }
      }
      
      // Xóa các file cũ
      if (latestFile) {
        const files = fs.readdirSync(processedDir);
        let oldFilesDeleted = 0;
        
        for (const file of files) {
          const filePath = path.join(processedDir, file);
          
          // Không xóa file index.json và file mới nhất
          if (file !== 'index.json' && filePath !== latestFile && fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
            oldFilesDeleted++;
            console.log(`Đã xóa file đã xử lý cũ: ${file}`);
          }
        }
        
        console.log(`Đã xóa ${oldFilesDeleted} file đã xử lý cũ`);
      }
    }
    
    console.log('===== DỌN DẸP HOÀN THÀNH =====');
    return filesDeleted;
  } catch (error) {
    console.error('Lỗi khi dọn dẹp thư mục:', error);
    return 0;
  }
}

/**
 * Tạo URL tìm kiếm danh sách sheet
 * @param {string} sheetName - Tên sheet cần tìm
 * @returns {string} URL đầy đủ
 */
function createListUrl(sheetName) {
  // Loại bỏ tham số t (cache busting)
  return `https://kimvan.id.vn/api/spreadsheets/create/${encodeURIComponent(sheetName)}`;
}

/**
 * Tạo URL lấy dữ liệu chi tiết của sheet
 * @param {string} sheetId - ID của sheet
 * @returns {string} URL đầy đủ
 */
function createDetailUrl(sheetId) {
  // Loại bỏ tham số t (cache busting)
  return `https://kimvan.id.vn/api/spreadsheets/${encodeURIComponent(sheetId)}`;
}

/**
 * Xử lý dữ liệu kết quả
 */
function processResults() {
  try {
    console.log('Đang xử lý dữ liệu...');
    
    // Đọc tất cả các file trong thư mục results
    const files = fs.readdirSync(resultsDir);
    
    // Khởi tạo đối tượng chứa dữ liệu đã xử lý
    const processedData = {
      timestamp: new Date().toISOString(),
      sheetLists: {},
      sheetDetails: {}
    };
    
    // Duyệt qua từng file
    let filesProcessed = 0;
    
    files.forEach(file => {
      if (!file.endsWith('.json')) return;
      
      const filePath = path.join(resultsDir, file);
      const fileName = path.basename(filePath);
      console.log(`Đang xử lý file: ${fileName}`);
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        
        // Xác định loại dữ liệu (danh sách hoặc chi tiết)
        if (file.includes('-list.json')) {
          // File danh sách sheet
          const sheetName = file.replace('-list.json', '');
          processedData.sheetLists[sheetName] = {
            source: fileName,
            timestamp: new Date().toISOString(),
            data: data
          };
          console.log(`File ${fileName} chứa danh sách sheet cho "${sheetName}" (${Array.isArray(data) ? data.length : 0} sheets)`);
          
        } else if (file.includes('-detail.json')) {
          // File chi tiết sheet
          const sheetIdMatch = fileName.match(/[^-]+-([a-zA-Z0-9_-]{10})/);
          const sheetId = sheetIdMatch ? sheetIdMatch[1] : 'unknown';
          
          processedData.sheetDetails[sheetId] = {
            source: fileName,
            timestamp: new Date().toISOString(),
            data: data
          };
          
          console.log(`File ${fileName} chứa chi tiết sheet với ID: ${sheetId}`);
        } else {
          console.log(`File ${fileName} có định dạng không xác định.`);
        }
        
        filesProcessed++;
      } catch (error) {
        console.error(`Lỗi khi xử lý file ${file}:`, error.message);
      }
    });
    
    if (filesProcessed === 0) {
      console.log('Không tìm thấy file JSON nào để xử lý. Hãy chạy script open-browser.js trước.');
      return null;
    }
    
    // Lưu dữ liệu đã xử lý
    const processedFilePath = path.join(processedDir, `kimvan-data-${Date.now()}.json`);
    fs.writeFileSync(processedFilePath, JSON.stringify(processedData, null, 2));
    
    // Cập nhật file index
    const indexFilePath = path.join(processedDir, 'index.json');
    const indexData = {
      timestamp: new Date().toISOString(),
      lastProcessed: processedFilePath,
      sheetListCount: Object.keys(processedData.sheetLists).length,
      sheetDetailCount: Object.keys(processedData.sheetDetails).length,
      sheetNames: Object.keys(processedData.sheetLists),
      sheetIds: Object.keys(processedData.sheetDetails)
    };
    fs.writeFileSync(indexFilePath, JSON.stringify(indexData, null, 2));
    
    console.log(`\nĐã xử lý ${filesProcessed} file JSON`);
    console.log(`Tìm thấy ${Object.keys(processedData.sheetLists).length} danh sách sheet`);
    console.log(`Tìm thấy ${Object.keys(processedData.sheetDetails).length} chi tiết sheet`);
    console.log(`Dữ liệu đã xử lý được lưu tại: ${processedFilePath}`);
    console.log(`File index đã được cập nhật: ${indexFilePath}`);
    
    return processedData;
  } catch (error) {
    console.error('Lỗi khi xử lý dữ liệu:', error);
    return null;
  }
}

/**
 * Find index.json in processed directory
 * @returns {Object|null} Data from index.json or null if not found
 */
function findIndexFile() {
  try {
    const indexPath = path.join(processedDir, 'index.json');
    
    if (!fs.existsSync(indexPath)) {
      console.log('Index file not found.');
      return null;
    }
    
    const content = fs.readFileSync(indexPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading index file:', error.message);
    return null;
  }
}

/**
 * Find latest processed data
 * @returns {Object|null} Processed data or null if not found
 */
function findLatestProcessedData() {
  try {
    const indexData = findIndexFile();
    if (!indexData || !indexData.lastProcessed) return null;
    
    const dataPath = indexData.lastProcessed;
    if (!fs.existsSync(dataPath)) {
      console.log(`Data file not found: ${dataPath}`);
      return null;
    }
    
    const content = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading processed data:', error.message);
    return null;
  }
}

/**
 * Find sheet list by name from offline data
 * @param {string} name - Sheet name
 * @returns {Array|null} Sheet list or null if not found
 */
function findSheetListByName(name) {
  const processedData = findLatestProcessedData();
  if (!processedData || !processedData.sheetLists) return null;
  
  // Exact match
  if (processedData.sheetLists[name]) {
    return processedData.sheetLists[name].data;
  }
  
  // Partial match
  const keys = Object.keys(processedData.sheetLists);
  for (const key of keys) {
    if (key.includes(name) || name.includes(key)) {
      return processedData.sheetLists[key].data;
    }
  }
  
  return null;
}

/**
 * Kiểm tra xem người dùng đã đăng nhập chưa
 * @param {Object} page - Trang Puppeteer
 * @returns {Promise<boolean>} Đã đăng nhập hay chưa
 */
async function isLoggedIn(page) {
  try {
    // Kiểm tra xem có phần tử nào chỉ hiện khi đã đăng nhập không
    // Hoặc kiểm tra xem có phần tử login không
    const loginButton = await page.$('button[type="submit"], a.login-button, .login');
    return !loginButton; // Nếu không có nút đăng nhập, coi như đã đăng nhập
  } catch (error) {
    console.error('Lỗi khi kiểm tra trạng thái đăng nhập:', error);
    return false;
  }
}

/**
 * Tự động lấy và lưu dữ liệu từ API KimVan
 * @param {string} sheetName - Tên sheet cần lấy
 * @param {Object} options - Tuỳ chọn
 */
async function autoFetchData(sheetName, options = {}) {
  const waitTime = options.waitTime || 5000; // 5 giây mặc định
  const keepBrowserOpen = options.keepBrowserOpen || true; // Giữ trình duyệt mở sau khi hoàn thành
  const loginTimeout = options.loginTimeout || 120000; // Thời gian tối đa đợi đăng nhập (2 phút)
  
  try {
    console.log(`===== BẮT ĐẦU TỰ ĐỘNG LẤY DANH SÁCH CHO "${sheetName}" =====`);
    
    // Đường dẫn đến thư mục dữ liệu người dùng Chrome
    const userDataDir = path.join(process.cwd(), 'chrome-user-data');
    
    // Đảm bảo thư mục tồn tại
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    
    // 1. Khởi động trình duyệt với giao diện visible và cấu hình an toàn
    console.log('Khởi động trình duyệt Chrome để bạn có thể quan sát và đăng nhập nếu cần...');
    console.log('Sử dụng cấu hình mới để tránh lỗi "This browser or app may not be secure"');
    
    const browser = await puppeteer.launch({
      headless: false,                // Hiển thị trình duyệt
      defaultViewport: null,          // Tự động điều chỉnh kích thước viewport
      userDataDir: userDataDir,       // Thư mục lưu dữ liệu người dùng
      args: [
        '--start-maximized',          // Mở cửa sổ to hơn
        '--no-sandbox',               // Cần thiết trong một số môi trường
        '--disable-setuid-sandbox',   // Cần thiết trong một số môi trường
        '--disable-blink-features=AutomationControlled', // Quan trọng: ẩn đặc điểm tự động hóa
        '--window-size=1920,1080'     // Kích thước cửa sổ lớn
      ]
    });
    
    try {
      // 2. Lấy danh sách sheet
      console.log(`\n[1] Lấy danh sách sheet cho "${sheetName}"...`);
      const listUrl = createListUrl(sheetName);
      console.log(`URL: ${listUrl}`);
      
      const listPage = await browser.newPage();
      
      // Cài đặt để tránh phát hiện là trình duyệt tự động
      await listPage.evaluateOnNewDocument(() => {
        // Ghi đè navigator.webdriver để tránh bị phát hiện
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // Xóa thuộc tính cài đặt tự động
        delete navigator.__proto__.webdriver;
        
        // Thêm plugins giả để trông giống trình duyệt thật
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        
        // Thêm chuỗi userAgent giả
        Object.defineProperty(navigator, 'userAgent', {
          get: () => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        });
      });
      
      // Cấu hình trình duyệt giống Chrome thật
      await listPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      // Thiết lập kích thước trang đủ lớn
      await listPage.setViewport({ width: 1280, height: 800 });
      
      // Hiển thị thông báo trên console của trình duyệt
      await listPage.evaluateOnNewDocument(() => {
        console.log('%cAPI KimVan Access', 'font-size: 20px; color: green; font-weight: bold');
        console.log('Đang lấy dữ liệu, vui lòng đợi...');
        console.log('Nếu cần đăng nhập, vui lòng đăng nhập Gmail trong cửa sổ này');
      });
      
      await listPage.goto(listUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      
      // Kiểm tra đăng nhập và đợi nếu cần
      const loginStartTime = Date.now();
      let isUserLoggedIn = await isLoggedIn(listPage);
      
      if (!isUserLoggedIn) {
        console.log('\n===== ĐĂNG NHẬP GMAIL =====');
        console.log('Vui lòng đăng nhập Gmail trong trình duyệt vừa hiện ra');
        console.log(`Hệ thống sẽ đợi tối đa ${loginTimeout/1000} giây để bạn đăng nhập`);
        console.log('Nhấn ESC hoặc đóng trình duyệt nếu muốn hủy quá trình');
        
        // Đợi người dùng đăng nhập
        while (!isUserLoggedIn && (Date.now() - loginStartTime) < loginTimeout) {
          // Đợi một lúc rồi kiểm tra lại
          await new Promise(resolve => setTimeout(resolve, 5000));
          console.log('Đang đợi đăng nhập...');
          isUserLoggedIn = await isLoggedIn(listPage);
          
          // Nếu đã đăng nhập thì thông báo và tải lại trang
          if (isUserLoggedIn) {
            console.log('Đã phát hiện đăng nhập thành công!');
            // Tải lại trang để áp dụng phiên đăng nhập
            await listPage.reload({ waitUntil: 'networkidle0', timeout: 30000 });
            break;
          }
        }
        
        // Nếu vẫn chưa đăng nhập sau khi hết thời gian
        if (!isUserLoggedIn) {
          console.log('Hết thời gian đợi đăng nhập. Tiếp tục quá trình (có thể bị giới hạn quyền truy cập)');
        }
      }
      
      // Tạm dừng để người dùng có thể xem
      console.log('Đợi 3 giây để bạn có thể quan sát...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Lấy nội dung JSON
      const listContent = await listPage.evaluate(() => document.body.innerText);
      let listData;
      let sheetIds = [];
      
      try {
        listData = JSON.parse(listContent);
        // Lưu file JSON
        const listFileName = `${sheetName}-list.json`;
        const listFilePath = path.join(resultsDir, listFileName);
        fs.writeFileSync(listFilePath, JSON.stringify(listData, null, 2));
        console.log(`Đã lưu danh sách sheet vào: ${listFilePath}`);
        
        // Lấy ID từ danh sách
        if (Array.isArray(listData) && listData.length > 0) {
          sheetIds = listData.map(item => item.id);
          console.log(`Đã lấy ${sheetIds.length} ID sheet từ danh sách`);
          console.log(`Để lấy chi tiết từng sheet, sử dụng API: /api/spreadsheets/[id]`);
        } else {
          console.warn('Dữ liệu danh sách không hợp lệ hoặc rỗng');
        }
      } catch (parseError) {
        console.error('Lỗi khi xử lý dữ liệu danh sách:', parseError);
        console.log('Nội dung nhận được:', listContent.slice(0, 500) + '...');
        
        // Lưu nội dung thô để kiểm tra
        const rawFileName = `${sheetName}-list-raw.txt`;
        const rawFilePath = path.join(resultsDir, rawFileName);
        fs.writeFileSync(rawFilePath, listContent);
        console.log(`Đã lưu nội dung thô vào: ${rawFilePath}`);
        
        // Kiểm tra các lỗi phổ biến
        if (listContent.includes('429') || listContent.includes('rate limit')) {
          console.error('LỖI 429 - RATE LIMIT: Yêu cầu quá nhiều trong thời gian ngắn');
        } else if (listContent.includes('login') || listContent.includes('sign in')) {
          console.error('LỖI ĐĂNG NHẬP: Bạn cần đăng nhập để truy cập API');
        }
        
        console.log('\n===== GIẢI PHÁP =====');
        console.log('1. Sử dụng script thay thế để mở trình duyệt thực tế:');
        console.log('   node src/scripts/open-browser.js ' + sheetName);
        console.log('2. Lưu kết quả từ trình duyệt vào thư mục results');
        console.log('3. Xử lý kết quả với script:');
        console.log('   node src/scripts/process-results.js');
        console.log('4. Sử dụng API offline:');
        console.log('   /api/spreadsheets/from-offline/' + sheetName);
      }
      
      await listPage.close();
      console.log('Đã đóng tab danh sách sheet');
    } finally {
      // Hiển thị thông báo trong console
      console.log('\n===== LẤY DANH SÁCH SHEET THÀNH CÔNG =====');
      console.log(`Đã lấy xong danh sách sheet cho "${sheetName}"`);
      console.log(`Kết quả được lưu tại: ${resultsDir}`);
      
      // Đóng trình duyệt ngay lập tức
      await browser.close();
      console.log('Đã đóng trình duyệt Chrome');
    }
    
    // 4. Xử lý dữ liệu đã lấy
    console.log('\n===== XỬ LÝ DỮ LIỆU =====');
    const processedData = processResults();
    
    console.log('\n===== HOÀN THÀNH =====');
    console.log(`Đã tự động lấy và xử lý dữ liệu cho sheet "${sheetName}"`);
    console.log('Kết quả được lưu trong thư mục:');
    console.log(`- Dữ liệu thô: ${resultsDir}`);
    console.log(`- Dữ liệu đã xử lý: ${processedDir}`);
    console.log('\n===== HƯỚNG DẪN SỬ DỤNG DỮ LIỆU =====');
    console.log('- API offline: /api/spreadsheets/from-offline/' + sheetName);
    console.log('- API chi tiết: /api/spreadsheets/[id] (để lấy chi tiết từng sheet)');
    
    return processedData;
  } catch (error) {
    console.error('Lỗi khi tự động lấy dữ liệu:', error);
    
    // Hiển thị hướng dẫn cho người dùng
    console.log('\n===== GIẢI PHÁP THAY THẾ =====');
    console.log('1. Sử dụng script thay thế để mở trình duyệt thực tế:');
    console.log('   node src/scripts/open-browser.js ' + sheetName);
    console.log('2. Lưu kết quả từ trình duyệt vào thư mục results');
    console.log('3. Xử lý kết quả với script:');
    console.log('   node src/scripts/process-results.js');
    console.log('4. Sử dụng API offline:');
    console.log('   /api/spreadsheets/from-offline/' + sheetName);
    
    return null;
  }
}

/**
 * API handler - Automatically fetch and process data
 */
export async function GET(request, { params }) {
  try {
    // Ensure params are awaited
    const paramsData = await params;
    const name = paramsData.name;
    
    if (!name) {
      return NextResponse.json({ error: 'Name not provided' }, { status: 400 });
    }
    
    // Create timestamp
    const timestamp = Date.now();
    const responseHeaders = {
      'X-Timestamp': `${timestamp}`,
      'X-Cache-Control': 'no-cache',
      'X-Data-Source': 'fresh-fetch' // Luôn lấy dữ liệu mới
    };
    
    console.log('==============================================');
    console.log(`Processing data for: ${name}`);
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Always fetching fresh data (cache bypass disabled)`);
    console.log('==============================================');
    
    // Bỏ phần kiểm tra dữ liệu hiện có, luôn lấy dữ liệu mới
    console.log(`Fetching fresh data for "${name}"...`);
    
    try {
      // Gọi trực tiếp hàm autoFetchData 
      const options = {
        waitTime: 5000,          // Thời gian chờ giữa các request
        keepBrowserOpen: false,  // Đóng trình duyệt Chrome sau khi hoàn thành
        loginTimeout: 120000     // Cho phép 2 phút để đăng nhập nếu cần
      };
      
      console.log('Đang mở Chrome để bạn quan sát quá trình...');
      console.log('Nếu chưa đăng nhập, hệ thống sẽ đợi bạn đăng nhập Gmail');
      console.log('Trình duyệt sẽ tự động đóng sau khi hoàn thành');
      
      await autoFetchData(name, options);
      
      // Check if data is now available
      const newData = findSheetListByName(name);
      if (newData) {
        console.log(`Successfully fetched and processed data for "${name}"`);
        console.log('Chrome đã được đóng tự động');
        
        // Dọn dẹp thư mục sau khi xử lý thành công
        const filesDeleted = cleanupFolders(true); // true = giữ lại các file đã xử lý
        console.log(`Đã dọn dẹp ${filesDeleted} file tạm thời sau khi xử lý thành công`);
        
        return NextResponse.json(newData, {
          headers: responseHeaders
        });
      } else {
        // If still no data, return error with helpful instructions
        console.error(`Failed to fetch data for "${name}"`);
        
        // Tạo hướng dẫn giải pháp thay thế
        const alternativeSolution = {
          message: 'Không thể tự động lấy dữ liệu. Vui lòng sử dụng phương pháp thay thế.',
          steps: [
            'Sử dụng script thay thế để mở trình duyệt thực tế: node src/scripts/open-browser.js ' + name,
            'Lưu kết quả từ trình duyệt vào thư mục results',
            'Xử lý kết quả: node src/scripts/process-results.js',
            'Sử dụng API offline: /api/spreadsheets/from-offline/' + name
          ],
          note: 'Chrome browser đã được đóng tự động',
          possibleReason: 'API KimVan có thể yêu cầu đăng nhập hoặc áp dụng giới hạn tốc độ (rate limit)',
          offlineApiUrl: `/api/spreadsheets/from-offline/${name}`,
          timestamp: timestamp
        };
        
        return NextResponse.json(
          {
            error: 'Data fetching failed',
            detail: 'Automatic data fetching completed but no data was found',
            alternativeSolution: alternativeSolution,
            timestamp: timestamp
          },
          {
            status: 500,
            headers: responseHeaders
          }
        );
      }
    } catch (fetchError) {
      console.error('Error during automatic data fetch:', fetchError);
      
      // Tạo hướng dẫn khắc phục
      const troubleshooting = {
        message: 'Gặp lỗi khi tự động lấy dữ liệu. Vui lòng thử phương pháp thay thế.',
        steps: [
          'Sử dụng script thay thế để mở trình duyệt thực tế: node src/scripts/open-browser.js ' + name,
          'Lưu kết quả từ trình duyệt vào thư mục results',
          'Xử lý kết quả: node src/scripts/process-results.js',
          'Sử dụng API offline: /api/spreadsheets/from-offline/' + name
        ],
        note: 'Chrome browser đã được đóng tự động',
        error: fetchError.message,
        offlineApiUrl: `/api/spreadsheets/from-offline/${name}`,
        timestamp: timestamp
      };
      
      // Return error response
      return NextResponse.json(
        {
          error: 'Automatic data fetching failed',
          detail: fetchError.message,
          troubleshooting: troubleshooting,
          timestamp: timestamp
        },
        {
          status: 500,
          headers: responseHeaders
        }
      );
    }
  } catch (error) {
    console.error('Unknown error:', error);
    
    // Basic error response
    return NextResponse.json(
      { 
        error: `Error: ${error.message}`,
        timestamp: Date.now(),
        suggestion: 'Vui lòng thử sử dụng script manual: node src/scripts/open-browser.js'
      },
      { status: 500 }
    );
  }
} 