import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import os from 'os';
import { getUserRole, ADMIN_ROLE } from '../../../auth/admin/check-permission/auth';
import { revalidatePath } from 'next/cache';
import { extractFileNameFromHeader } from '../../drive/remove-watermark/lib/utils';

// Đường dẫn file lưu cookie
const COOKIE_FILE_PATH = path.join(process.cwd(), 'kimvan-cookie.txt');
const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * Lưu cookie vào file
 * @param {string} cookie - Cookie string cần lưu
 * @returns {boolean} - Kết quả lưu cookie
 */
async function saveCookie(cookie) {
  try {
    // Đảm bảo thư mục data tồn tại
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Lưu cookie vào file chính
    fs.writeFileSync(COOKIE_FILE_PATH, cookie);
    
    // Lưu cookie vào thư mục data dự phòng
    const backupPath = path.join(DATA_DIR, 'kimvan-cookie.txt');
    fs.writeFileSync(backupPath, cookie);
    
    return true;
  } catch (error) {
    console.error('Lỗi khi lưu cookie:', error);
    return false;
  }
}

/**
 * Đọc cookie từ file
 * @returns {string|null} - Cookie string hoặc null nếu không tồn tại
 */
function readCookie() {
  try {
    // Thử đọc từ file chính
    if (fs.existsSync(COOKIE_FILE_PATH)) {
      return fs.readFileSync(COOKIE_FILE_PATH, 'utf8');
    }
    
    // Nếu không có, thử đọc từ file dự phòng
    const backupPath = path.join(DATA_DIR, 'kimvan-cookie.txt');
    if (fs.existsSync(backupPath)) {
      return fs.readFileSync(backupPath, 'utf8');
    }
    
    return null;
  } catch (error) {
    console.error('Lỗi khi đọc cookie:', error);
    return null;
  }
}

/**
 * Test tải file bằng cookie
 * @param {string} cookie - Cookie string cần test
 * @param {string} fileId - ID file Google Drive để test
 * @returns {Promise<Object>} - Kết quả test
 */
async function testCookieDownload(cookie, fileId) {
  // Tạo thư mục tạm để lưu file test
  const tempDir = path.join(os.tmpdir(), uuidv4());
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const tempFilePath = path.join(tempDir, `test_${fileId}.pdf`);
  const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
  
  const startTime = Date.now();
  
  try {
    // Tạo request với cookie
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: 30000, // 30 giây timeout
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // Xử lý tên file từ header
    let fileName = 'unknown_file.pdf';
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      fileName = extractFileNameFromHeader(contentDisposition);
    }
    
    // Tạo write stream
    const writer = fs.createWriteStream(tempFilePath);
    response.data.pipe(writer);
    
    // Đợi write stream hoàn tất
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Kiểm tra kích thước file
    const stats = fs.statSync(tempFilePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    // Kiểm tra nếu file quá nhỏ (dưới 10KB), có thể là trang HTML lỗi
    if (stats.size < 10 * 1024) {
      // Đọc nội dung file để kiểm tra
      const content = fs.readFileSync(tempFilePath, 'utf8');
      if (content.includes('<html') || content.includes('Error') || content.includes('Access denied')) {
        throw new Error('File tải về không hợp lệ (có thể là trang HTML lỗi)');
      }
    }
    
    // Tính thời gian tải
    const endTime = Date.now();
    const downloadTime = endTime - startTime;
    
    // Dọn dẹp file tạm
    try {
      fs.unlinkSync(tempFilePath);
      fs.rmdirSync(tempDir);
    } catch (cleanupError) {
      console.warn('Lỗi khi dọn dẹp file tạm:', cleanupError);
    }
    
    return {
      success: true,
      fileName,
      fileSizeMB: fileSizeMB.toFixed(2),
      time: downloadTime
    };
  } catch (error) {
    console.error('Lỗi khi test cookie:', error);
    
    // Dọn dẹp file tạm nếu có lỗi
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir);
      }
    } catch (cleanupError) {
      console.warn('Lỗi khi dọn dẹp file tạm:', cleanupError);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Xử lý GET request để lấy cookie
 */
export async function GET(req) {
  try {
    // Kiểm tra quyền
    const role = await getUserRole(req);
    if (role !== ADMIN_ROLE) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    // Đọc cookie từ file
    const cookie = readCookie();
    
    if (!cookie) {
      return NextResponse.json({ 
        success: false, 
        message: 'Chưa có cookie được lưu' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, cookie });
  } catch (error) {
    console.error('Lỗi khi lấy cookie:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * Xử lý POST request để lưu cookie
 */
export async function POST(req) {
  try {
    // Kiểm tra quyền
    const role = await getUserRole(req);
    if (role !== ADMIN_ROLE) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    // Lấy cookie từ request body
    const body = await req.json();
    const { cookie } = body;
    
    if (!cookie || typeof cookie !== 'string' || cookie.trim() === '') {
      return NextResponse.json({ 
        success: false, 
        message: 'Cookie không hợp lệ' 
      }, { status: 400 });
    }
    
    // Lưu cookie vào file
    const saveResult = await saveCookie(cookie);
    
    if (!saveResult) {
      return NextResponse.json({ 
        success: false, 
        message: 'Không thể lưu cookie' 
      }, { status: 500 });
    }
    
    // Revalidate paths
    revalidatePath('/admin/kimvan-cookie');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Đã lưu cookie thành công' 
    });
  } catch (error) {
    console.error('Lỗi khi lưu cookie:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
} 