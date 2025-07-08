import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import os from 'os';
import { getUserRole, ADMIN_ROLE } from '../../../../auth/admin/check-permission/auth';
import { extractFileNameFromHeader } from '../../../drive/remove-watermark/lib/utils';

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
    console.log(`🍪 Bắt đầu test cookie với file ID: ${fileId}`);
    console.log(`🔗 URL tải xuống: ${downloadUrl}`);
    
    // Tạo request với cookie
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: 30000, // 30 giây timeout
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      maxContentLength: 100 * 1024 * 1024, // 100MB
      maxBodyLength: 100 * 1024 * 1024 // 100MB
    });
    
    // Xử lý tên file từ header
    let fileName = 'unknown_file.pdf';
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      fileName = extractFileNameFromHeader(contentDisposition);
    }
    
    console.log(`📝 Tên file: ${fileName}`);
    
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
    
    console.log(`📊 Kích thước file: ${fileSizeMB.toFixed(2)} MB`);
    
    // Kiểm tra nếu file quá nhỏ (dưới 10KB), có thể là trang HTML lỗi
    if (stats.size < 10 * 1024) {
      // Đọc nội dung file để kiểm tra
      const content = fs.readFileSync(tempFilePath, 'utf8');
      if (content.includes('<html') || content.includes('Error') || content.includes('Access denied')) {
        console.log(`❌ File tải về có vẻ là trang HTML lỗi, không phải file thực`);
        throw new Error('File tải về không hợp lệ (có thể là trang HTML lỗi)');
      }
    }
    
    // Tính thời gian tải
    const endTime = Date.now();
    const downloadTime = endTime - startTime;
    
    console.log(`⏱️ Thời gian tải: ${downloadTime} ms`);
    
    // Dọn dẹp file tạm
    try {
      fs.unlinkSync(tempFilePath);
      fs.rmdirSync(tempDir);
      console.log(`🧹 Đã dọn dẹp file tạm`);
    } catch (cleanupError) {
      console.warn(`⚠️ Lỗi khi dọn dẹp file tạm: ${cleanupError.message}`);
    }
    
    return {
      success: true,
      fileName,
      fileSizeMB: fileSizeMB.toFixed(2),
      time: downloadTime
    };
  } catch (error) {
    console.error(`❌ Lỗi khi test cookie: ${error.message}`);
    
    // Dọn dẹp file tạm nếu có lỗi
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir);
      }
      console.log(`🧹 Đã dọn dẹp file tạm sau lỗi`);
    } catch (cleanupError) {
      console.warn(`⚠️ Lỗi khi dọn dẹp file tạm sau lỗi: ${cleanupError.message}`);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Xử lý POST request để test cookie
 */
export async function POST(req) {
  try {
    // Kiểm tra quyền
    const role = await getUserRole(req);
    if (role !== ADMIN_ROLE) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    // Lấy cookie và fileId từ request body
    const body = await req.json();
    const { cookie, fileId } = body;
    
    if (!cookie || typeof cookie !== 'string' || cookie.trim() === '') {
      return NextResponse.json({ 
        success: false, 
        message: 'Cookie không hợp lệ' 
      }, { status: 400 });
    }
    
    if (!fileId) {
      return NextResponse.json({ 
        success: false, 
        message: 'FileId không được để trống' 
      }, { status: 400 });
    }
    
    // Test cookie
    const testResult = await testCookieDownload(cookie, fileId);
    
    if (testResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Cookie hoạt động tốt!',
        fileName: testResult.fileName,
        fileSizeMB: testResult.fileSizeMB,
        time: testResult.time
      });
    } else {
      return NextResponse.json({
        success: false,
        message: testResult.error || 'Không thể tải file'
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Lỗi khi test cookie:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
} 