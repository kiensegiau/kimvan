import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

// Chuyển đổi exec thành promise
const execAsync = util.promisify(exec);

// Biến để theo dõi lần cuối cùng chạy Puppeteer
let lastPuppeteerRun = 0;
const PUPPETEER_COOLDOWN = 2 * 60 * 1000; // 2 phút

/**
 * Hàm chạy script Puppeteer để lấy dữ liệu mới
 */
async function runPuppeteerScript(sheetName) {
  try {
    const now = Date.now();
    // Chỉ chạy Puppeteer nếu đã quá thời gian cooldown
    if (now - lastPuppeteerRun < PUPPETEER_COOLDOWN) {
      console.log('Đã chạy Puppeteer gần đây, đợi cooldown trước khi chạy lại');
      return false;
    }
    
    console.log('Đang chạy script Puppeteer để lấy dữ liệu mới...');
    const scriptPath = path.join(process.cwd(), 'src/scripts/kimvan-direct-request.js');
    
    const { stdout, stderr } = await execAsync(`node ${scriptPath} ${sheetName}`);
    console.log('Puppeteer đã chạy xong:', stdout);
    if (stderr) {
      console.error('Lỗi từ Puppeteer:', stderr);
    }
    
    lastPuppeteerRun = now;
    return true;
  } catch (error) {
    console.error('Lỗi khi chạy script Puppeteer:', error);
    return false;
  }
}

/**
 * Tìm file kết quả mới nhất cho sheet name cụ thể
 */
function findLatestSheetListFile(sheetName) {
  try {
    const resultsDir = path.join(process.cwd(), 'results');
    if (!fs.existsSync(resultsDir)) {
      return null;
    }
    
    // Tìm tất cả các file liên quan đến sheet name
    const files = fs.readdirSync(resultsDir)
      .filter(file => file.startsWith(`${sheetName}-list-`))
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

export async function GET(request, { params }) {
  try {
    // Đảm bảo await params trước khi sử dụng
    const paramsData = await params;
    const name = paramsData.name;
    
    if (!name) {
      return NextResponse.json({ error: 'Tên không được cung cấp' }, { status: 400 });
    }
    
    console.log('==============================================');
    console.log(`🔍 Đang truy cập dữ liệu cache cho: ${name}`);
    console.log('==============================================');
    
    // Tìm file kết quả mới nhất
    let sheetListFile = findLatestSheetListFile(name);
    
    // Nếu không tìm thấy hoặc file quá cũ (>24h), chạy lại Puppeteer
    let needRefresh = false;
    if (!sheetListFile) {
      console.log(`Không tìm thấy dữ liệu cache cho "${name}". Sẽ chạy Puppeteer để lấy dữ liệu mới.`);
      needRefresh = true;
    } else {
      // Kiểm tra thời gian file
      const fileStats = fs.statSync(sheetListFile);
      const fileTime = fileStats.mtime.getTime();
      const now = Date.now();
      const fileAgeHours = (now - fileTime) / (1000 * 60 * 60);
      
      console.log(`File cache "${path.basename(sheetListFile)}" có tuổi: ${fileAgeHours.toFixed(2)} giờ`);
      
      if (fileAgeHours > 24) {
        console.log(`Dữ liệu cache quá cũ (>24h). Sẽ chạy Puppeteer để lấy dữ liệu mới.`);
        needRefresh = true;
      }
    }
    
    // Chạy Puppeteer nếu cần thiết
    if (needRefresh) {
      await runPuppeteerScript(name);
      // Tìm lại file sau khi chạy Puppeteer
      sheetListFile = findLatestSheetListFile(name);
    }
    
    // Nếu vẫn không tìm thấy file
    if (!sheetListFile) {
      return NextResponse.json(
        { error: 'Không thể tìm thấy hoặc tạo dữ liệu cho sheet này' },
        { status: 404 }
      );
    }
    
    // Đọc nội dung file
    const fileContent = fs.readFileSync(sheetListFile, 'utf8');
    const sheetList = JSON.parse(fileContent);
    
    // Trả về kết quả
    return NextResponse.json(sheetList);
    
  } catch (error) {
    console.error('Lỗi khi đọc dữ liệu cache:', error);
    return NextResponse.json(
      { error: `Lỗi khi đọc dữ liệu cache: ${error.message}` },
      { status: 500 }
    );
  }
} 