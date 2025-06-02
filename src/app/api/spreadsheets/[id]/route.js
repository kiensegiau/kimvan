import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';

// Thư mục kết quả
const resultsDir = path.join(process.cwd(), 'results');

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

/**
 * Dọn dẹp thư mục kết quả sau khi đã xử lý thành công
 * @param {string} keepFile - Đường dẫn file cần giữ lại
 * @returns {number} Số lượng file đã xóa
 */
function cleanupFolders(keepFile = null) {
  try {
    console.log('\n===== BẮT ĐẦU DỌN DẸP THƯ MỤC =====');
    let filesDeleted = 0;
    
    // Dọn dẹp thư mục kết quả tạm thời
    if (fs.existsSync(resultsDir)) {
      const files = fs.readdirSync(resultsDir);
      console.log(`Tìm thấy ${files.length} file trong thư mục kết quả tạm thời`);
      
      for (const file of files) {
        const filePath = path.join(resultsDir, file);
        
        // Kiểm tra đây có phải là file không và không phải file cần giữ lại
        if (fs.statSync(filePath).isFile() && (!keepFile || filePath !== keepFile)) {
          fs.unlinkSync(filePath);
          filesDeleted++;
          console.log(`Đã xóa file: ${file}`);
        }
      }
      
      console.log(`Đã xóa ${filesDeleted} file từ thư mục kết quả tạm thời`);
    }
    
    console.log('===== DỌN DẸP HOÀN THÀNH =====');
    return filesDeleted;
  } catch (error) {
    console.error('Lỗi khi dọn dẹp thư mục:', error);
    return 0;
  }
}

/**
 * Tạo URL lấy dữ liệu chi tiết của sheet
 * @param {string} sheetId - ID của sheet
 * @returns {string} URL đầy đủ
 */
function createDetailUrl(sheetId) {
  return `https://kimvan.id.vn/api/spreadsheets/${encodeURIComponent(sheetId)}`;
}

/**
 * Kiểm tra xem người dùng đã đăng nhập chưa
 * @param {Object} page - Trang Puppeteer
 * @returns {Promise<boolean>} Đã đăng nhập hay chưa
 */
async function isLoggedIn(page) {
  try {
    const loginButton = await page.$('button[type="submit"], a.login-button, .login');
    return !loginButton; // Nếu không có nút đăng nhập, coi như đã đăng nhập
  } catch (error) {
    console.error('Lỗi khi kiểm tra trạng thái đăng nhập:', error);
    return false;
  }
}

/**
 * Xử lý các link giả mạo trong dữ liệu từ Kimvan
 * @param {Object} data - Dữ liệu JSON từ Kimvan
 * @returns {Object} Dữ liệu đã được xử lý
 */
function processFakeLinks(data) {
  if (!data || !data.sheets || !Array.isArray(data.sheets)) {
    console.log('Không có dữ liệu sheets để xử lý');
    return data;
  }

  console.log(`===== XỬ LÝ LINK GIẢ MẠO TRONG ${data.sheets.length} SHEETS =====`);
  
  // Mảng chứa các mẫu URL fake
  const FAKE_URL_PATTERNS = [
    'drive.google.com/file/d/1zEQxmW1VXzwFz4gw65mwpRSV7QiArLAr',
    '/api/shared?link='
  ];
  
  let totalLinks = 0;
  let fakeLinks = 0;
  let markedLinks = 0;
  
  // Duyệt qua tất cả sheets
  data.sheets.forEach((sheet, sheetIndex) => {
    const sheetTitle = sheet?.properties?.title || `Sheet ${sheetIndex + 1}`;
    console.log(`Đang xử lý sheet "${sheetTitle}"`);
    
    if (sheet.data && Array.isArray(sheet.data)) {
      sheet.data.forEach((sheetData, dataIndex) => {
        if (sheetData.rowData && Array.isArray(sheetData.rowData)) {
          sheetData.rowData.forEach((row, rowIndex) => {
            if (row.values && Array.isArray(row.values)) {
              row.values.forEach((cell, cellIndex) => {
                const url = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
                
                if (url) {
                  totalLinks++;
                  
                  // Kiểm tra xem URL có phải là link giả không
                  const isFakeLink = FAKE_URL_PATTERNS.some(pattern => url.includes(pattern));
                  
                  if (isFakeLink) {
                    fakeLinks++;
                    
                    // Lưu lại hyperlink để sử dụng thay vì URL giả
                    const validHyperlink = cell.hyperlink;
                    
                    // Lưu lại URL gốc trước khi xử lý (cho mục đích debug)
                    cell.originalUrl = url;
                    
                    // Đánh dấu là link giả mạo, nhưng vẫn giữ hyperlink để làm dự phòng
                    cell.isFakeLink = true;
                    cell.linkRemoved = true;
                    
                    // Xóa URL giả, chỉ giữ lại hyperlink
                    if (cell.userEnteredFormat?.textFormat?.link) {
                      // Xóa URL giả từ textFormat.link.uri
                      delete cell.userEnteredFormat.textFormat.link.uri;
                      markedLinks++;
                    }
                    
                    // Giữ lại CHỈ hyperlink - chứa ID đã mã hóa từ KimVan
                    // Chỉ dùng làm dự phòng khi không có link cũ đã xử lý
                    // KHÔNG xóa cell.hyperlink
                    
                    markedLinks++;
                    
                    // Lưu vị trí để dễ khớp sau này
                    if (!cell.position) {
                      cell.position = {
                        sheet: sheetTitle,
                        row: rowIndex,
                        col: cellIndex
                      };
                    }
                    
                    // Thêm thông báo vào formatted value nếu cần
                    if (cell.formattedValue) {
                      cell.originalFormattedValue = cell.formattedValue;
                      // Không thay đổi formattedValue để giữ nguyên hiển thị
                    }
                  }
                }
              });
            }
          });
        }
      });
    }
  });
  
  console.log(`===== KẾT QUẢ XỬ LÝ LINK GIẢ =====`);
  console.log(`Tổng số link: ${totalLinks}`);
  console.log(`Số link giả mạo phát hiện: ${fakeLinks}`);
  console.log(`Số link giả mạo đã đánh dấu: ${markedLinks}`);
  console.log(`Tỷ lệ giả mạo: ${totalLinks > 0 ? ((fakeLinks / totalLinks) * 100).toFixed(2) : 0}%`);
  
  return data;
}

/**
 * Tự động lấy chi tiết sheet từ API KimVan
 * @param {string} sheetId - ID của sheet cần lấy
 * @returns {Promise<Object>} Dữ liệu sheet hoặc null nếu có lỗi
 */
async function fetchSheetDetail(sheetId) {
  try {
    console.log(`===== BẮT ĐẦU LẤY CHI TIẾT SHEET VỚI ID "${sheetId}" =====`);
    
    // Đường dẫn đến thư mục dữ liệu người dùng Chrome
    const userDataDir = path.join(process.cwd(), 'chrome-user-data');
    
    // Đảm bảo thư mục tồn tại
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    
    // Khởi động trình duyệt với cấu hình an toàn
    console.log('Khởi động trình duyệt Chrome để lấy chi tiết sheet...');
    
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      userDataDir: userDataDir,
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080'
      ]
    });
    
    try {
      const shortId = sheetId.substring(0, 10);
      console.log(`\nLấy chi tiết sheet: ${shortId}...`);
      const detailUrl = createDetailUrl(sheetId);
      console.log(`URL: ${detailUrl}`);
      
      const detailPage = await browser.newPage();
      
      // Cài đặt để tránh phát hiện là trình duyệt tự động
      await detailPage.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        delete navigator.__proto__.webdriver;
        
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        
        Object.defineProperty(navigator, 'userAgent', {
          get: () => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        });
      });
      
      await detailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      await detailPage.setViewport({ width: 1280, height: 800 });
      
      await detailPage.evaluateOnNewDocument(() => {
        console.log('%cAPI KimVan - Chi tiết Sheet', 'font-size: 20px; color: blue; font-weight: bold');
        console.log('Đang lấy chi tiết sheet, vui lòng đợi...');
        console.log('Nếu cần đăng nhập, vui lòng đăng nhập Gmail trong cửa sổ này');
      });
      
      await detailPage.goto(detailUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      
      // Kiểm tra đăng nhập
      let isUserLoggedIn = await isLoggedIn(detailPage);
      
      if (!isUserLoggedIn) {
        console.log('\n===== CẦN ĐĂNG NHẬP GMAIL =====');
        console.log('Vui lòng đăng nhập Gmail trong trình duyệt vừa hiện ra');
        console.log('Hệ thống sẽ đợi tối đa 2 phút để bạn đăng nhập');
        
        // Đợi người dùng đăng nhập (tối đa 2 phút)
        const loginTimeout = 120000;
        const loginStartTime = Date.now();
        
        while (!isUserLoggedIn && (Date.now() - loginStartTime) < loginTimeout) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          console.log('Đang đợi đăng nhập...');
          isUserLoggedIn = await isLoggedIn(detailPage);
          
          if (isUserLoggedIn) {
            console.log('Đã phát hiện đăng nhập thành công!');
            await detailPage.reload({ waitUntil: 'networkidle0', timeout: 30000 });
            break;
          }
        }
        
        if (!isUserLoggedIn) {
          console.log('Hết thời gian đợi đăng nhập. Tiếp tục quá trình (có thể bị giới hạn quyền truy cập)');
        }
      }
      
      // Lấy nội dung JSON
      const detailContent = await detailPage.evaluate(() => document.body.innerText);
      let detailData;
      
      try {
        detailData = JSON.parse(detailContent);
        
        // Xử lý các link giả mạo trong dữ liệu
        detailData = processFakeLinks(detailData);
        
        // Lưu file JSON
        const detailFileName = `sheet-${shortId}-detail.json`;
        const detailFilePath = path.join(resultsDir, detailFileName);
        fs.writeFileSync(detailFilePath, JSON.stringify(detailData, null, 2));
        console.log(`Đã lưu chi tiết sheet vào: ${detailFilePath}`);
        
        // Hiển thị thông báo trong console
        console.log('\n===== LẤY JSON THÀNH CÔNG =====');
        console.log(`Đã lấy xong chi tiết sheet với ID: ${shortId}`);
        console.log(`Kết quả được lưu tại: ${detailFilePath}`);
        
        // Đóng trang chi tiết
        await detailPage.close();
        
        return {
          success: true,
          data: detailData,
          sheetId: sheetId,
          timestamp: Date.now()
        };
      } catch (error) {
        console.error('Lỗi khi xử lý dữ liệu chi tiết:', error);
        
        // Lưu nội dung thô để kiểm tra
        const rawFileName = `sheet-${shortId}-detail-raw.txt`;
        const rawFilePath = path.join(resultsDir, rawFileName);
        fs.writeFileSync(rawFilePath, detailContent);
        
        return {
          success: false,
          error: error.message,
          errorCode: detailContent.includes('429') ? 429 : 400,
          sheetId: sheetId,
          timestamp: Date.now()
        };
      }
    } finally {
      // Đóng trình duyệt ngay lập tức
      await browser.close();
      console.log('Đã đóng trình duyệt Chrome');
    }
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết sheet:', error);
    
    return {
      success: false,
      error: error.message,
      sheetId: sheetId,
      timestamp: Date.now()
    };
  }
}

export async function GET(request, { params }) {
  try {
    // Await params trước khi sử dụng
    const paramsData = await params;
    const id = paramsData.id;
    
    if (!id) {
      return NextResponse.json({ error: 'ID không được cung cấp' }, { status: 400 });
    }
    
    // Timestamp cho header
    const timestamp = Date.now();
    const responseHeaders = {
      'X-Timestamp': `${timestamp}`,
      'X-Cache-Control': 'no-cache',
      'X-Data-Source': 'fetch-detail-only'
    };
    
    console.log('==============================================');
    console.log(`Lấy chi tiết sheet với ID: ${id}`);
    console.log(`Timestamp: ${timestamp}`);
    console.log('==============================================');
    
    // Gọi hàm lấy chi tiết
    const result = await fetchSheetDetail(id);
    
    if (result.success) {
      // Dọn dẹp thư mục kết quả, giữ lại file vừa lấy được
      const detailFileName = `sheet-${id.substring(0, 10)}-detail.json`;
      const detailFilePath = path.join(resultsDir, detailFileName);
      const filesDeleted = cleanupFolders(detailFilePath);
      console.log(`Đã dọn dẹp ${filesDeleted} file tạm thời sau khi lấy chi tiết thành công`);
      
      return NextResponse.json(result.data, {
        headers: responseHeaders
      });
    } else {
      return NextResponse.json(
        {
          error: 'Không thể lấy chi tiết sheet',
          detail: result.error,
          errorCode: result.errorCode,
          timestamp: timestamp
        },
        {
          status: result.errorCode || 500,
          headers: responseHeaders
        }
      );
    }
  } catch (error) {
    console.error('Lỗi không xác định:', error);
    
    return NextResponse.json(
      { 
        error: `Lỗi: ${error.message}`,
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
} 