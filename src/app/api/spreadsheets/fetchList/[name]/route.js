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
 * Tạo URL tìm kiếm danh sách sheet
 * @param {string} sheetName - Tên sheet cần tìm
 * @returns {string} URL đầy đủ
 */
function createListUrl(sheetName) {
  return `https://kimvan.id.vn/api/spreadsheets/create/${encodeURIComponent(sheetName)}`;
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
 * Tự động lấy danh sách sheet từ API KimVan (không lấy chi tiết)
 * @param {string} sheetName - Tên sheet cần lấy
 * @returns {Promise<Object>} Dữ liệu danh sách hoặc null nếu có lỗi
 */
async function fetchSheetList(sheetName) {
  try {
    console.log(`===== BẮT ĐẦU LẤY DANH SÁCH SHEET CHO "${sheetName}" =====`);
    
    // Đường dẫn đến thư mục dữ liệu người dùng Chrome
    const userDataDir = path.join(process.cwd(), 'chrome-user-data');
    
    // Đảm bảo thư mục tồn tại
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    
    // Khởi động trình duyệt với cấu hình an toàn
    console.log('Khởi động trình duyệt Chrome để lấy danh sách sheet...');
    
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
      console.log(`\nLấy danh sách sheet cho "${sheetName}"...`);
      const listUrl = createListUrl(sheetName);
      console.log(`URL: ${listUrl}`);
      
      const listPage = await browser.newPage();
      
      // Cài đặt để tránh phát hiện là trình duyệt tự động
      await listPage.evaluateOnNewDocument(() => {
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
      
      await listPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      await listPage.setViewport({ width: 1280, height: 800 });
      
      await listPage.evaluateOnNewDocument(() => {
        console.log('%cAPI KimVan - Danh sách Sheet', 'font-size: 20px; color: green; font-weight: bold');
        console.log('Đang lấy danh sách sheet, vui lòng đợi...');
        console.log('Nếu cần đăng nhập, vui lòng đăng nhập Gmail trong cửa sổ này');
      });
      
      await listPage.goto(listUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      
      // Kiểm tra đăng nhập
      let isUserLoggedIn = await isLoggedIn(listPage);
      
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
          isUserLoggedIn = await isLoggedIn(listPage);
          
          if (isUserLoggedIn) {
            console.log('Đã phát hiện đăng nhập thành công!');
            await listPage.reload({ waitUntil: 'networkidle0', timeout: 30000 });
            break;
          }
        }
        
        if (!isUserLoggedIn) {
          console.log('Hết thời gian đợi đăng nhập. Tiếp tục quá trình (có thể bị giới hạn quyền truy cập)');
        }
      }
      
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
        
        // Đóng trang sau khi hoàn thành
        await listPage.close();
        
        // Hiển thị thông báo hoàn thành
        const finalPage = await browser.newPage();
        await finalPage.setViewport({ width: 1280, height: 800 });
        await finalPage.goto('https://kimvan.id.vn/', { waitUntil: 'networkidle0' });
        
        await finalPage.evaluate(() => {
          document.body.style.backgroundColor = '#f0f8ff';
          const div = document.createElement('div');
          div.style.padding = '20px';
          div.style.margin = '20px auto';
          div.style.maxWidth = '600px';
          div.style.backgroundColor = '#e6f7ff';
          div.style.border = '1px solid #91d5ff';
          div.style.borderRadius = '5px';
          div.style.fontFamily = 'Arial, sans-serif';
          
          div.innerHTML = `
            <h2 style="color: #096dd9; text-align: center;">Hoàn thành lấy danh sách sheet</h2>
            <p style="font-size: 16px; line-height: 1.5;">Đã lấy xong danh sách sheet từ API KimVan.</p>
            <p style="font-size: 16px; line-height: 1.5;">Để lấy chi tiết từng sheet, sử dụng API /api/spreadsheets/fetchDetail/[id]</p>
            <p style="font-size: 16px; line-height: 1.5;"><strong>Lưu ý:</strong> Bạn có thể đóng trình duyệt này bất cứ lúc nào, phiên đăng nhập vẫn được lưu.</p>
          `;
          
          document.body.prepend(div);
        });
        
        console.log('\n===== HOÀN THÀNH =====');
        console.log(`Đã lấy danh sách sheet cho "${sheetName}"`);
        console.log(`Tìm thấy ${Array.isArray(listData) ? listData.length : 0} sheets`);
        console.log(`Kết quả được lưu tại: ${resultsDir}/${sheetName}-list.json`);
        
        return {
          success: true,
          data: listData,
          count: Array.isArray(listData) ? listData.length : 0,
          sheetName: sheetName,
          timestamp: Date.now()
        };
      } catch (error) {
        console.error('Lỗi khi xử lý dữ liệu danh sách:', error);
        
        // Lưu nội dung thô để kiểm tra
        const rawFileName = `${sheetName}-list-raw.txt`;
        const rawFilePath = path.join(resultsDir, rawFileName);
        fs.writeFileSync(rawFilePath, listContent);
        
        return {
          success: false,
          error: error.message,
          errorCode: listContent.includes('429') ? 429 : 400,
          sheetName: sheetName,
          timestamp: Date.now()
        };
      }
    } finally {
      // Không đóng trình duyệt để giữ phiên đăng nhập
      console.log('Đã giữ trình duyệt mở để sử dụng lần sau');
    }
  } catch (error) {
    console.error('Lỗi khi lấy danh sách sheet:', error);
    
    return {
      success: false,
      error: error.message,
      sheetName: sheetName,
      timestamp: Date.now()
    };
  }
}

/**
 * API handler - Lấy danh sách sheet theo tên
 */
export async function GET(request, { params }) {
  try {
    const paramsData = await params;
    const name = paramsData.name;
    
    if (!name) {
      return NextResponse.json({ error: 'Tên sheet không được cung cấp' }, { status: 400 });
    }
    
    // Timestamp cho header
    const timestamp = Date.now();
    const responseHeaders = {
      'X-Timestamp': `${timestamp}`,
      'X-Cache-Control': 'no-cache',
      'X-Data-Source': 'fetch-list-only'
    };
    
    console.log('==============================================');
    console.log(`Lấy danh sách sheet cho: ${name}`);
    console.log(`Timestamp: ${timestamp}`);
    console.log('==============================================');
    
    // Gọi hàm lấy danh sách
    const result = await fetchSheetList(name);
    
    if (result.success) {
      return NextResponse.json(result.data, {
        headers: {
          ...responseHeaders,
          'X-Total-Count': `${result.count}`
        }
      });
    } else {
      return NextResponse.json(
        {
          error: 'Không thể lấy danh sách sheet',
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