import { NextResponse } from 'next/server';
import { initUploadCronJob, manualProcessUploads } from '../upload/cron';
import fs from 'fs';
import path from 'path';

// Biến toàn cục để lưu trữ cron job
let uploadCronJob = null;

/**
 * Khởi động hoặc dừng cron job
 */
export async function POST(request) {
  try {
    const data = await request.json();
    const { action } = data;
    
    // Kiểm tra dữ liệu
    if (!action || !['start', 'stop', 'status', 'process'].includes(action)) {
      return NextResponse.json({
        success: false,
        message: 'Hành động không hợp lệ. Vui lòng sử dụng start, stop, status hoặc process.'
      }, { status: 400 });
    }
    
    switch (action) {
      case 'start':
        // Nếu đã có cron job đang chạy thì dừng lại
        if (uploadCronJob) {
          uploadCronJob.stop();
        }
        
        // Khởi động cron job mới
        uploadCronJob = initUploadCronJob();
        
        return NextResponse.json({
          success: true,
          message: 'Đã khởi động cron job xử lý video YouTube',
          status: 'running'
        });
        
      case 'stop':
        // Dừng cron job nếu đang chạy
        if (uploadCronJob) {
          uploadCronJob.stop();
          uploadCronJob = null;
          
          return NextResponse.json({
            success: true,
            message: 'Đã dừng cron job xử lý video YouTube',
            status: 'stopped'
          });
        } else {
          return NextResponse.json({
            success: false,
            message: 'Không có cron job nào đang chạy',
            status: 'not_running'
          });
        }
        
      case 'status':
        // Kiểm tra trạng thái cron job
        return NextResponse.json({
          success: true,
          status: uploadCronJob ? 'running' : 'stopped',
          message: uploadCronJob 
            ? 'Cron job xử lý video YouTube đang chạy' 
            : 'Cron job xử lý video YouTube không hoạt động'
        });
        
      case 'process':
        // Xử lý thủ công các video đã lên lịch
        const result = await manualProcessUploads();
        
        return NextResponse.json({
          success: true,
          message: 'Đã kích hoạt xử lý thủ công tất cả video đã lên lịch',
          result
        });
        
      default:
        return NextResponse.json({
          success: false,
          message: 'Hành động không hợp lệ'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Lỗi quản lý cron job:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Lỗi khi quản lý cron job xử lý video YouTube',
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Lấy thông tin về cron job và logs
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const showLogs = searchParams.get('logs') === 'true';
    
    // Thông tin cơ bản
    const response = {
      success: true,
      status: uploadCronJob ? 'running' : 'stopped',
      message: uploadCronJob 
        ? 'Cron job xử lý video YouTube đang chạy' 
        : 'Cron job xử lý video YouTube không hoạt động'
    };
    
    // Thêm nội dung logs nếu được yêu cầu
    if (showLogs) {
      const LOG_FILE = path.join(process.cwd(), 'logs', 'youtube-upload-cron.log');
      
      if (fs.existsSync(LOG_FILE)) {
        // Đọc 100 dòng cuối cùng của file log
        const logContent = fs.readFileSync(LOG_FILE, 'utf8');
        const logLines = logContent.split('\n').filter(line => line.trim() !== '');
        const lastLogs = logLines.slice(-100);
        
        response.logs = lastLogs;
      } else {
        response.logs = [];
      }
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Lỗi lấy thông tin cron job:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Lỗi khi lấy thông tin cron job xử lý video YouTube',
      error: error.message
    }, { status: 500 });
  }
}

// Tự động khởi động cron job khi server khởi động
// Lưu ý: Điều này chỉ hoạt động cho các môi trường không serverless
if (process.env.NODE_ENV === 'production' && process.env.AUTO_START_YOUTUBE_CRON === 'true') {
  try {
    console.log('Tự động khởi động cron job xử lý video YouTube...');
    uploadCronJob = initUploadCronJob();
  } catch (error) {
    console.error('Lỗi tự động khởi động cron job:', error);
  }
} 