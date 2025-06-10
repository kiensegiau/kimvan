import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function POST(request) {
  try {
    // Lấy dữ liệu từ request
    const data = await request.json();
    const { url } = data;

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL không được cung cấp' }, { status: 400 });
    }

    // Kiểm tra xem URL có phải là Google Sheets không
    if (!url.includes('docs.google.com/spreadsheets')) {
      return NextResponse.json({ 
        success: false, 
        error: 'URL không phải là Google Sheets' 
      }, { status: 400 });
    }

    // Chuyển URL sang chế độ preview nếu là chế độ edit
    const previewUrl = url.replace('/edit', '/preview');
    
    console.log(`Bắt đầu xử lý URL: ${previewUrl}`);

    // Khởi động trình duyệt
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      // Mở trang mới
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      
      // Thiết lập User-Agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      // Đi đến URL
      await page.goto(previewUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      
      // Đợi để trang tải hoàn tất
      await page.waitForTimeout(3000);
      
      // Chụp ảnh màn hình
      const screenshot = await page.screenshot({ fullPage: true });
      
      // Lấy HTML
      const html = await page.evaluate(() => {
        // Tìm grid container
        const gridContainer = document.querySelector('[id$="-grid-container"]') || 
                             document.querySelector('[class*="grid-container"]') ||
                             document.querySelector('[role="grid"]');
        
        if (!gridContainer) {
          return null;
        }
        
        return gridContainer.outerHTML;
      });
      
      // Lấy HTML trang đầy đủ để debug
      const fullHtml = await page.content();
      
      if (!html) {
        return NextResponse.json({ 
          success: false, 
          error: 'Không thể trích xuất HTML từ trang',
          fullHtml: fullHtml.substring(0, 10000) // Giới hạn kích thước để tránh quá lớn
        }, { status: 404 });
      }
      
      // Đóng trình duyệt
      await browser.close();
      
      // Trả về kết quả
      return NextResponse.json({
        success: true,
        url: previewUrl,
        html,
        screenshotBase64: screenshot.toString('base64')
      });
    } catch (error) {
      // Đóng trình duyệt nếu có lỗi
      if (browser) {
        await browser.close();
      }
      
      console.error('Lỗi khi xử lý trang:', error);
      return NextResponse.json({ 
        success: false, 
        error: `Lỗi khi xử lý trang: ${error.message}`
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Lỗi API:', error);
    return NextResponse.json({ 
      success: false, 
      error: `Lỗi API: ${error.message}`
    }, { status: 500 });
  }
} 