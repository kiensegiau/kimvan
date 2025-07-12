/**
 * API xóa watermark PDF sử dụng techhk.aoscdn.com API
 * 
 * API này sẽ:
 * 1. Tải xuống file PDF từ Google Drive (nếu cung cấp link Google Drive)
 * 2. Gửi file đến API techhk.aoscdn.com để xóa watermark
 * 3. Tải xuống file đã xử lý
 * 4. Tải lên lại file đã xử lý lên Google Drive (nếu yêu cầu)
 * 5. Trả về đường dẫn đến file đã xử lý
 * 
 * Tham số:
 * - fileUrl: URL hoặc đường dẫn đến file PDF (có thể là Google Drive link)
 * - apiKey: API key của techhk.aoscdn.com (nếu không cung cấp sẽ sử dụng API_KEY mặc định)
 * - uploadToDrive: Boolean, có tải lên Google Drive sau khi xử lý không (mặc định: true)
 * - courseId (tùy chọn): ID của khóa học để cập nhật trong MongoDB
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { google } from 'googleapis';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import FormData from 'form-data';
import { getMongoClient } from '@/lib/mongodb';
import { createReadStream } from 'fs';

// Import các module service từ remove-watermark API
import { downloadFromGoogleDrive } from '../remove-watermark/lib/drive-service.js';
import { uploadToDrive } from '../remove-watermark/lib/drive-service.js';
import { getTokenByType, extractGoogleDriveFileId } from '../remove-watermark/lib/utils.js';

// Cấu hình API
const API_ENDPOINT = {
  CREATE_TASK: 'https://techhk.aoscdn.com/api/tasks/document/conversion',
  CHECK_STATUS: 'https://techhk.aoscdn.com/api/tasks/document/conversion/',
  CHECK_CREDITS: 'https://techhk.aoscdn.com/api/customers/coins'
};

// API Key mặc định (ưu tiên sử dụng từ biến môi trường, nếu không có dùng API key cố định)
const DEFAULT_API_KEY = process.env.TECHHK_API_KEY || 'wxu5s7wu6c4hfc0di';

// Thời gian tối đa chờ xử lý từ API (30 giây)
const MAX_POLLING_TIME = 30000;
// Khoảng thời gian giữa các lần kiểm tra trạng thái (1 giây)
const POLLING_INTERVAL = 1000;

/**
 * Tạo nhiệm vụ xóa watermark trên API bên ngoài
 * @param {string} filePath - Đường dẫn đến file PDF cần xử lý
 * @param {string} apiKey - API key cho dịch vụ
 * @returns {Promise<string>} - Task ID
 */
async function createWatermarkRemovalTask(filePath, apiKey) {
  const form = new FormData();
  form.append('format', 'doc-repair');
  form.append('file', createReadStream(filePath));
  
  try {
    const response = await axios.post(API_ENDPOINT.CREATE_TASK, form, {
      headers: {
        ...form.getHeaders(),
        'X-API-KEY': apiKey
      }
    });
    
    if (response.data?.status === 200 && response.data?.data?.task_id) {
      return response.data.data.task_id;
    } else {
      throw new Error(`Lỗi khi tạo nhiệm vụ: ${response.data?.message || 'Không xác định'}`);
    }
  } catch (error) {
    throw new Error(`Lỗi API: ${error.message}`);
  }
}

/**
 * Kiểm tra trạng thái của nhiệm vụ
 * @param {string} taskId - ID của nhiệm vụ 
 * @param {string} apiKey - API key
 */
async function checkTaskStatus(taskId, apiKey) {
  try {
    const response = await axios.get(`${API_ENDPOINT.CHECK_STATUS}${taskId}`, {
      headers: {
        'X-API-KEY': apiKey
      }
    });
    
    if (response.data?.status === 200) {
      return response.data.data;
    } else {
      throw new Error(`Lỗi khi kiểm tra trạng thái: ${response.data?.message || 'Không xác định'}`);
    }
  } catch (error) {
    throw new Error(`Lỗi API: ${error.message}`);
  }
}

/**
 * Kiểm tra trạng thái và chờ cho đến khi hoàn thành
 * @param {string} taskId - ID của nhiệm vụ
 * @param {string} apiKey - API key 
 * @param {number} startTime - Thời gian bắt đầu kiểm tra
 */
async function pollTaskStatus(taskId, apiKey, startTime = Date.now()) {
  // Kiểm tra nếu đã quá thời gian chờ
  if (Date.now() - startTime > MAX_POLLING_TIME) {
    throw new Error('Quá thời gian chờ xử lý từ API');
  }
  
  // Kiểm tra trạng thái
  const status = await checkTaskStatus(taskId, apiKey);
  
  // Các mã trạng thái:
  // state < 0: Lỗi
  // state = 0: Đang xếp hàng
  // state = 1: Hoàn thành
  // state = 2-5: Đang xử lý
  if (status.state === 1) {
    // Hoàn thành
    return status;
  } else if (status.state < 0) {
    // Xử lý lỗi
    const errorMessages = {
      '-8': 'Xử lý vượt quá thời gian cho phép',
      '-7': 'File không hợp lệ',
      '-6': 'Mật khẩu không đúng',
      '-5': 'File vượt quá kích thước cho phép',
      '-4': 'Không thể gửi nhiệm vụ',
      '-3': 'Không thể tải xuống file',
      '-2': 'Không thể tải file lên',
      '-1': 'Xử lý thất bại'
    };
    
    throw new Error(`Xử lý thất bại: ${errorMessages[status.state] || 'Lỗi không xác định'}`);
  }
  
  // Chờ một khoảng thời gian trước khi kiểm tra lại
  await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
  return pollTaskStatus(taskId, apiKey, startTime);
}

/**
 * Tải xuống file đã xử lý
 * @param {string} fileUrl - URL của file cần tải xuống
 * @param {string} outputPath - Đường dẫn lưu file
 */
async function downloadProcessedFile(fileUrl, outputPath) {
  try {
    const response = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream'
    });
    
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Lỗi khi tải file: ${error.message}`);
  }
}

/**
 * Kiểm tra số dư credits
 * @param {string} apiKey - API key
 */
async function checkCredits(apiKey) {
  try {
    const response = await axios.get(API_ENDPOINT.CHECK_CREDITS, {
      headers: {
        'X-API-KEY': apiKey
      }
    });
    
    if (response.data?.status === 200) {
      return response.data.data;
    } else {
      throw new Error(`Lỗi khi kiểm tra số dư: ${response.data?.message || 'Không xác định'}`);
    }
  } catch (error) {
    throw new Error(`Lỗi API: ${error.message}`);
  }
}

/**
 * Xử lý file PDF để xóa watermark
 * @param {string} filePath - Đường dẫn đến file cần xử lý
 * @param {string} outputPath - Đường dẫn lưu file đã xử lý
 * @param {string} apiKey - API key
 */
async function processPDFWatermark(filePath, outputPath, apiKey) {
  try {
    // Tạo nhiệm vụ xử lý
    const taskId = await createWatermarkRemovalTask(filePath, apiKey);
    console.log(`Đã tạo nhiệm vụ xử lý với ID: ${taskId}`);
    
    // Chờ và kiểm tra kết quả
    const result = await pollTaskStatus(taskId, apiKey);
    console.log(`Xử lý hoàn tất. Kích thước file đầu vào: ${result.input_size} bytes, đầu ra: ${result.output_size} bytes`);
    
    // Tải xuống file đã xử lý
    await downloadProcessedFile(result.file, outputPath);
    console.log(`Đã tải file đã xử lý về ${outputPath}`);
    
    return {
      inputSize: result.input_size,
      outputSize: result.output_size,
      pages: result.file_pages || 0
    };
  } catch (error) {
    throw new Error(`Lỗi khi xử lý PDF: ${error.message}`);
  }
}

// Next.js API route handler
export async function POST(request) {
  // Thư mục tạm để lưu file tạm thời
  const tempDir = path.join(os.tmpdir(), `watermark-remover-${uuidv4()}`);
  let tempInputFile = null;
  let tempOutputFile = null;
  let mongoClient = null;
  
  try {
    // Tạo thư mục tạm nếu chưa tồn tại
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Phân tích request
    const requestBody = await request.json();
    const { 
      fileUrl, 
      apiKey = DEFAULT_API_KEY, 
      uploadToDrive = true, 
      courseId,
      driveLink, // Hỗ trợ cả fileUrl và driveLink
      folderId   // Hỗ trợ thêm folderId để chỉ định thư mục tải lên
    } = requestBody;
    
    // Hỗ trợ cả fileUrl và driveLink
    const fileUrlToUse = fileUrl || driveLink;
    
    // Kiểm tra API key
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Thiếu API key.' },
        { status: 400 }
      );
    }
    
    // Kiểm tra URL file
    if (!fileUrlToUse) {
      return NextResponse.json(
        { error: 'Thiếu URL file.' },
        { status: 400 }
      );
    }
    
    // Tạo đường dẫn cho file tạm
    tempInputFile = path.join(tempDir, `input-${uuidv4()}.pdf`);
    tempOutputFile = path.join(tempDir, `output-${uuidv4()}.pdf`);
    
    // Biến để lưu metadata của file
    let fileMetadata = {
      name: `watermark-removed-${Date.now()}.pdf`
    };
    
    // Kiểm tra nếu là Google Drive link
    const isDriveLink = fileUrlToUse.includes('drive.google.com');
    
    // Tải file xuống - từ Google Drive hoặc URL thông thường
    if (isDriveLink) {
      // Trích xuất ID và tải xuống từ Google Drive
      const fileId = extractGoogleDriveFileId(fileUrlToUse);
      
      if (!fileId) {
        return NextResponse.json(
          { error: 'Không thể trích xuất ID file từ Google Drive link.' },
          { status: 400 }
        );
      }
      
      // Lấy metadata và tải file xuống
      const downloadResult = await downloadFromGoogleDrive(fileId, tempInputFile);
      fileMetadata = {
        name: `${downloadResult.fileName.replace(/\.pdf$/, '')}-no-watermark.pdf`,
        mimeType: downloadResult.mimeType || 'application/pdf',
        originalId: fileId
      };
      
      console.log(`Đã tải file từ Google Drive: ${fileMetadata.name}`);
    } else {
      // Tải file từ URL thông thường
      try {
        const response = await axios({
          method: 'GET',
          url: fileUrlToUse,
          responseType: 'stream'
        });
        
        // Lấy tên file từ URL hoặc header
        let fileName = path.basename(fileUrlToUse).split('?')[0] || 'downloaded-file.pdf';
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
          const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
          if (matches && matches[1]) {
            fileName = matches[1].replace(/['"]/g, '');
          }
        }
        
        fileMetadata.name = `${fileName.replace(/\.pdf$/, '')}-no-watermark.pdf`;
        
        // Lưu file
        const writer = fs.createWriteStream(tempInputFile);
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        
        console.log(`Đã tải file từ URL: ${fileMetadata.name}`);
      } catch (error) {
        return NextResponse.json(
          { error: `Không thể tải file từ URL: ${error.message}` },
          { status: 400 }
        );
      }
    }
    
    // Kiểm tra kích thước file
    const fileStats = fs.statSync(tempInputFile);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    console.log(`Kích thước file: ${fileSizeMB.toFixed(2)} MB`);
    
    // Kiểm tra nếu file vượt quá 100MB (giới hạn của API)
    if (fileSizeMB > 100) {
      return NextResponse.json(
        { error: `File quá lớn (${fileSizeMB.toFixed(2)} MB). API chỉ hỗ trợ file dưới 100MB.` },
        { status: 400 }
      );
    }
    
    // Xử lý file để xóa watermark
    const processResult = await processPDFWatermark(tempInputFile, tempOutputFile, apiKey);
    
    // Kết quả trả về
    const result = {
      success: true,
      message: 'Đã xử lý thành công',
      metadata: {
        originalName: fileMetadata.name,
        pages: processResult.pages,
        inputSize: processResult.inputSize,
        outputSize: processResult.outputSize
      }
    };
    
    // Tải lên Google Drive nếu yêu cầu
    if (uploadToDrive) {
      // Lấy token upload
      const uploadToken = await getTokenByType('upload');
      if (uploadToken) {
        // Tạo OAuth2 client
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );
        
        oauth2Client.setCredentials(uploadToken);
        
        // Tải file lên (sử dụng folderId nếu có)
        const uploadResult = await uploadToDrive(
          oauth2Client,
          tempOutputFile,
          fileMetadata.name,
          fileMetadata.mimeType || 'application/pdf',
          folderId
        );
        
        result.driveFile = {
          id: uploadResult.id,
          name: uploadResult.name,
          webViewLink: uploadResult.webViewLink,
          webContentLink: uploadResult.webContentLink
        };
        
        console.log(`Đã tải file lên Google Drive: ${uploadResult.name} (${uploadResult.id})`);
        
        // Cập nhật trong MongoDB nếu có courseId
        if (courseId) {
          try {
            // Kết nối MongoDB
            mongoClient = await getMongoClient();
            const db = mongoClient.db();
            
            // Tạo bản ghi mới trong collection processedFiles
            await db.collection('processedFiles').insertOne({
              courseId: new ObjectId(courseId),
              originalFileId: fileMetadata.originalId,
              processedFileId: uploadResult.id,
              processedFileName: uploadResult.name,
              processedFileUrl: uploadResult.webViewLink,
              processedAt: new Date(),
              size: processResult.outputSize,
              pages: processResult.pages
            });
            
            console.log(`Đã cập nhật thông tin file đã xử lý cho khóa học ${courseId}`);
          } catch (dbError) {
            console.error(`Lỗi khi cập nhật MongoDB: ${dbError.message}`);
            // Không trả về lỗi, vẫn tiếp tục xử lý
          }
        }
      } else {
        result.warning = 'Không tìm thấy token upload. File đã xử lý nhưng không thể tải lên Google Drive.';
      }
    }
    
    // Trả về kết quả
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Lỗi: ${error.message}`);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  } finally {
    // Đóng kết nối MongoDB nếu đã mở
    if (mongoClient) {
      await mongoClient.close();
    }
    
    // Dọn dẹp file tạm
    try {
      if (tempInputFile && fs.existsSync(tempInputFile)) {
        fs.unlinkSync(tempInputFile);
      }
      if (tempOutputFile && fs.existsSync(tempOutputFile)) {
        fs.unlinkSync(tempOutputFile);
      }
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir, { recursive: true });
      }
    } catch (cleanupError) {
      console.error(`Lỗi khi dọn dẹp file tạm: ${cleanupError.message}`);
    }
  }
}

// API endpoint để kiểm tra số dư credits
export async function GET(request) {
  try {
    // Lấy API key từ query parameter
    const { searchParams } = new URL(request.url);
    let apiKey = searchParams.get('apiKey') || DEFAULT_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Thiếu API key.' },
        { status: 400 }
      );
    }
    
    // Kiểm tra số dư
    const credits = await checkCredits(apiKey);
    
    return NextResponse.json({
      success: true,
      data: credits
    });
  } catch (error) {
    console.error(`Lỗi khi kiểm tra số dư: ${error.message}`);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}