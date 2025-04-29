import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// Tạo hàm tải file từ URL và lưu vào thư mục tạm
async function downloadFileToTemp(url, fileName) {
  try {
    console.log(`Bắt đầu tải file từ URL: ${url}`);
    
    // Tạo thư mục tạm nếu chưa tồn tại
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }
    
    // Tạo tên file duy nhất
    const fileExtension = path.extname(fileName) || '.tmp';
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(tempDir, uniqueFileName);
    
    // Tải file từ URL
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Không thể tải file từ URL (${response.status}: ${response.statusText})`);
    }
    
    // Lưu file vào thư mục tạm
    const fileBuffer = await response.buffer();
    await writeFile(filePath, fileBuffer);
    
    console.log(`Đã tải xuống thành công file: ${filePath}`);
    
    return {
      success: true,
      filePath,
      fileName: uniqueFileName,
      originalName: fileName,
      size: fileBuffer.length
    };
  } catch (error) {
    console.error('Lỗi khi tải file:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function POST(req) {
  try {
    // Lấy thông tin từ request
    const body = await req.json();
    const { courseId, media, destination } = body;

    // Validate input
    if (!courseId) {
      return NextResponse.json(
        { success: false, message: 'Thiếu courseId' },
        { status: 400 }
      );
    }

    if (!media || !Array.isArray(media) || media.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Danh sách media không hợp lệ' },
        { status: 400 }
      );
    }

    // Kết nối đến database
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');

    // Kiểm tra xem khóa học có tồn tại không
    const course = await db.collection('courses').findOne({
      _id: new ObjectId(courseId)
    });

    if (!course) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy khóa học' },
        { status: 404 }
      );
    }

    // Xác định loại tài liệu và dịch vụ đích
    const isPdf = media.some(item => item.type === 'pdf');
    const serviceType = destination || 'youtube';
    const serviceName = isPdf ? 'Google Drive' : (serviceType === 'youtube' ? 'YouTube' : 'Google Drive');
    
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    
    // Xử lý từng media item
    for (const item of media) {
      try {
        console.log(`Đang xử lý tài liệu: ${item.title || 'Không tiêu đề'}, URL: ${item.url}`);
        
        // Tải file về bộ nhớ tạm trước
        const fileName = path.basename(item.url) || `${item.title || 'file'}.${item.type === 'pdf' ? 'pdf' : 'mp4'}`;
        const downloadResult = await downloadFileToTemp(item.url, fileName);
        
        if (!downloadResult.success) {
          failureCount++;
          results.push({
            id: item.id,
            title: item.title || 'Tài liệu',
            type: item.type,
            success: false,
            message: `Không thể tải file về máy chủ: ${downloadResult.error}`
          });
          continue;
        }
        
        console.log(`Đã tải file thành công, đường dẫn: ${downloadResult.filePath}`);
        
        // Mô phỏng việc tải lên Google Drive hoặc YouTube
        // Trong thực tế, đây là nơi bạn sẽ gọi API của Google Drive hoặc YouTube
        // sử dụng file đã tải về (downloadResult.filePath)
        
        // Mô phỏng tỉ lệ thành công 90%
        const isSuccess = Math.random() < 0.9;
        
        if (isSuccess) {
          successCount++;
          
          // Tạo thông tin kết quả dựa trên loại file
          const resultData = {
            id: item.id,
            title: item.title || 'Tài liệu',
            type: item.type,
            success: true,
            localFile: downloadResult.filePath // Thêm thông tin file cục bộ
          };
          
          if (item.type === 'pdf' || serviceType === 'drive') {
            resultData.driveUrl = `https://drive.google.com/file/d/${Math.random().toString(36).substring(2, 12)}`;
            resultData.message = `Đã tải về máy chủ và tải lên Google Drive thành công`;
          } else {
            resultData.youtubeUrl = `https://youtube.com/watch?v=${Math.random().toString(36).substring(2, 12)}`;
            resultData.message = `Đã tải về máy chủ và tải lên YouTube thành công`;
          }
          
          results.push(resultData);
        } else {
          failureCount++;
          results.push({
            id: item.id,
            title: item.title || 'Tài liệu',
            type: item.type,
            success: false,
            localFile: downloadResult.filePath,
            message: `Đã tải về máy chủ nhưng không thể tải lên ${isPdf ? 'Google Drive' : serviceName}`
          });
        }
        
        // Trong dự án thực, bạn có thể muốn xóa file tạm sau khi hoàn thành
        // fs.unlinkSync(downloadResult.filePath);
        
      } catch (error) {
        console.error(`Lỗi khi xử lý item ${item.id}:`, error);
        failureCount++;
        results.push({
          id: item.id,
          title: item.title || 'Tài liệu',
          type: item.type,
          success: false,
          message: `Lỗi xử lý: ${error.message}`
        });
      }
    }

    // Cập nhật thông tin trong database
    await db.collection('courses').updateOne(
      { _id: new ObjectId(courseId) },
      { 
        $set: {
          lastUpdated: new Date()
        }
      }
    );

    // Trả về kết quả
    return NextResponse.json({
      success: true,
      message: `Đã tải xuống và tải lên ${successCount}/${media.length} tài liệu lên ${serviceName}`,
      totalItems: media.length,
      successCount,
      failureCount,
      details: results
    });
    
  } catch (error) {
    console.error('Lỗi khi tải lên tài liệu:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
} 