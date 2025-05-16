import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

// Chuyển đổi exec thành promise
const execAsync = util.promisify(exec);

/**
 * Tìm file kết quả mới nhất cho sheet ID cụ thể
 */
function findSheetDetailFile(sheetId) {
  try {
    const resultsDir = path.join(process.cwd(), 'results');
    if (!fs.existsSync(resultsDir)) {
      return null;
    }
    
    // Tìm tất cả các file liên quan đến sheet ID
    const shortId = sheetId.substring(0, 10);
    const files = fs.readdirSync(resultsDir)
      .filter(file => file.includes(`-${shortId}-`))
      .sort()
      .reverse(); // Sắp xếp theo thời gian mới nhất
    
    if (files.length === 0) {
      return null;
    }
    
    return path.join(resultsDir, files[0]);
  } catch (error) {
    console.error('Lỗi khi tìm file kết quả:', error);
    return null;
  }
}

/**
 * Hàm chạy script Puppeteer để lấy dữ liệu mới cho sheet ID cụ thể
 */
async function runPuppeteerScriptForId(sheetId) {
  try {
    console.log('Đang chạy script Puppeteer để lấy dữ liệu chi tiết...');
    
    // Tạo URL cho sheet ID
    const detailUrl = `https://kimvan.id.vn/spreadsheets/${sheetId}`;
    
    // Mở trình duyệt đến URL cụ thể để bắt response
    const command = `start msedge ${detailUrl}`;
    
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      console.error('Lỗi khi mở trình duyệt:', stderr);
    }
    
    // Đợi một lúc để trang tải và bắt response
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Đã mở trình duyệt để truy cập sheet chi tiết.');
    return true;
  } catch (error) {
    console.error('Lỗi khi chạy Puppeteer cho sheet ID:', error);
    return false;
  }
}

export async function GET(request, { params }) {
  try {
    // Đảm bảo await params trước khi sử dụng
    const paramsData = await params;
    const id = paramsData.id;
    
    if (!id) {
      return NextResponse.json({ error: 'ID không được cung cấp' }, { status: 400 });
    }
    
    console.log('==============================================');
    console.log(`🔍 Đang truy cập dữ liệu chi tiết cho sheet ID: ${id}`);
    console.log('==============================================');
    
    // Tìm file kết quả mới nhất
    let detailFile = findSheetDetailFile(id);
    
    // Nếu không tìm thấy, thử mở trình duyệt để truy cập
    if (!detailFile) {
      console.log(`Không tìm thấy dữ liệu chi tiết cho sheet ID: ${id}`);
      console.log('Vui lòng chạy script kimvan-direct-request.js trước.');
      
      // Tạo response gợi ý cách lấy dữ liệu
      return NextResponse.json(
        { 
          error: 'Không tìm thấy dữ liệu chi tiết cho sheet này',
          solution: 'Vui lòng chạy script sau để lấy dữ liệu:',
          command: 'node src/scripts/kimvan-direct-request.js <sheet_name>' 
        },
        { status: 404 }
      );
    }
    
    // Kiểm tra thời gian file
    const fileStats = fs.statSync(detailFile);
    const fileTime = fileStats.mtime.getTime();
    const now = Date.now();
    const fileAgeHours = (now - fileTime) / (1000 * 60 * 60);
    
    console.log(`File cache "${path.basename(detailFile)}" có tuổi: ${fileAgeHours.toFixed(2)} giờ`);
    
    // Đọc nội dung file
    const fileContent = fs.readFileSync(detailFile, 'utf8');
    const sheetDetail = JSON.parse(fileContent);
    
    // Trả về kết quả
    return NextResponse.json(sheetDetail);
    
  } catch (error) {
    console.error('Lỗi khi đọc dữ liệu chi tiết:', error);
    return NextResponse.json(
      { error: `Lỗi khi đọc dữ liệu chi tiết: ${error.message}` },
      { status: 500 }
    );
  }
} 