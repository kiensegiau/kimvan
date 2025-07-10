/**
 * watermark-service.js
 * Module xử lý watermark cho file PDF
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { 
  createWatermarkRemovalTask, 
  checkTaskStatus 
} from './pdf-service';
import { 
  removeHeaderFooterWatermark, 
  addLogoToPDF 
} from './pdf-service';
import { getNextApiKey, removeApiKey } from '../../../../../utils/watermark-api-keys';

// Thời gian tối đa chờ xử lý từ API (3600 giây = 60 phút)
const MAX_POLLING_TIME = 3600000;
// Khoảng thời gian giữa các lần kiểm tra trạng thái (15 giây)
const POLLING_INTERVAL = 15000;

/**
 * Kiểm tra trạng thái và chờ cho đến khi hoàn thành
 * @param {string} taskId - ID của nhiệm vụ
 * @param {string} apiKey - API key 
 * @param {number} startTime - Thời gian bắt đầu kiểm tra
 * @param {number} retryCount - Số lần đã thử lại (mặc định là 0)
 * @param {number} fileSizeMB - Kích thước file tính bằng MB (để điều chỉnh thời gian chờ)
 * @param {number} lastProgressUpdate - Thời gian của lần cập nhật tiến độ gần nhất
 * @param {number} lastProgress - Giá trị tiến độ gần nhất
 * @param {number} stuckCounter - Số lần tiến độ không thay đổi (mặc định là 0)
 */
export async function pollTaskStatus(taskId, apiKey, startTime = Date.now(), retryCount = 0, fileSizeMB = 0, lastProgressUpdate = 0, lastProgress = 0, stuckCounter = 0) {
  // Tính toán thời gian chờ tối đa dựa trên kích thước file
  let maxPollingTime;
  if (fileSizeMB > 50) {
    // File rất lớn (>50MB): 30 giây cho mỗi MB
    maxPollingTime = Math.max(MAX_POLLING_TIME, fileSizeMB * 30000);
  } else if (fileSizeMB > 10) {
    // File lớn (>10MB): 25 giây cho mỗi MB
    maxPollingTime = Math.max(MAX_POLLING_TIME, fileSizeMB * 25000);
  } else {
    // File nhỏ: Sử dụng thời gian mặc định
    maxPollingTime = MAX_POLLING_TIME;
  }
  
  // Hiển thị thông tin về thời gian đã chờ
  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
  const maxWaitSeconds = Math.round(maxPollingTime / 1000);
  
  // Kiểm tra nếu đã quá thời gian chờ
  if (Date.now() - startTime > maxPollingTime) {
    // Nếu chưa thử lại quá nhiều lần và chưa quá thời gian chờ quá nhiều
    if (retryCount < 5 && Date.now() - startTime < maxPollingTime * 1.5) {
      console.log(`Đã quá thời gian chờ xử lý từ API (${elapsedSeconds} giây / tối đa ${maxWaitSeconds} giây), thử lại lần ${retryCount + 1}...`);
      // Thử lại một lần nữa với thời gian bắt đầu mới
      return pollTaskStatus(taskId, apiKey, Date.now(), retryCount + 1, fileSizeMB, 0, lastProgress, 0);
    }
    throw new Error(`Quá thời gian chờ xử lý từ API (${elapsedSeconds} giây / tối đa ${maxWaitSeconds} giây)`);
  }
  
  let status;
  try {
    // Kiểm tra trạng thái
    status = await checkTaskStatus(taskId, apiKey);
    
    // Các mã trạng thái:
    // state < 0: Lỗi
    // state = 0: Đang xếp hàng
    // state = 1: Hoàn thành
    // state = 2-5: Đang xử lý
    if (status.state === 1) {
      // Hoàn thành
      console.log(`✅ Xử lý hoàn tất sau ${elapsedSeconds} giây`);
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
    } else {
      // Đang xử lý hoặc đang xếp hàng
      const now = Date.now();
      const progressChanged = status.progress !== lastProgress;
      const timeSinceLastUpdate = now - lastProgressUpdate;
      
      // Kiểm tra xem tiến độ có bị kẹt không
      let newStuckCounter = stuckCounter;
      if (status.progress === lastProgress && lastProgress > 0) {
        newStuckCounter++;
        
        // Bỏ phát hiện kẹt ở 21% vì đây là hành vi bình thường của server
        // Chỉ phát hiện kẹt nếu không phải ở 21%
        if (status.progress !== 21 && newStuckCounter >= 40) {
          console.log(`⚠️ Phát hiện tiến độ bị kẹt ở ${status.progress}% trong ${Math.round(newStuckCounter * POLLING_INTERVAL / 1000)} giây. Thử khởi động lại quá trình...`);
          throw new Error('PROGRESS_STUCK');
        }
      } else if (progressChanged) {
        // Nếu tiến độ thay đổi, đặt lại bộ đếm
        newStuckCounter = 0;
      }
      
      // Hiển thị tiến độ nếu có và chỉ khi có thay đổi hoặc đã qua 10 giây
      if (status.progress && (progressChanged || timeSinceLastUpdate > 10000)) {
        // Tính toán thời gian dự kiến còn lại dựa trên tiến độ
        if (status.progress > 0 && status.progress < 100) {
          const percentComplete = status.progress;
          const timeElapsed = now - startTime;
          const estimatedTotalTime = timeElapsed / (percentComplete / 100);
          const estimatedTimeRemaining = estimatedTotalTime - timeElapsed;
          
          // Thêm thông báo đặc biệt khi tiến độ là 21% để thông báo người dùng
          if (status.progress === 21) {
            console.log(`Tiến độ xử lý: ${status.progress}% - Đã chạy: ${Math.round(timeElapsed/1000)} giây - Còn lại ước tính: ${Math.round(estimatedTimeRemaining/1000)} giây (Tiến độ 21% có thể kéo dài, đây là bình thường)`);
          } else {
            console.log(`Tiến độ xử lý: ${status.progress}% - Đã chạy: ${Math.round(timeElapsed/1000)} giây - Còn lại ước tính: ${Math.round(estimatedTimeRemaining/1000)} giây`);
          }
        } else {
          console.log(`Tiến độ xử lý: ${status.progress}% - Đã chạy: ${elapsedSeconds} giây`);
        }
        
        // Cập nhật thời gian và giá trị tiến độ gần nhất
        return pollTaskStatus(taskId, apiKey, startTime, retryCount, fileSizeMB, now, status.progress, newStuckCounter);
      } else if (status.state === 0) {
        // Đang xếp hàng
        if (timeSinceLastUpdate > 15000) { // Hiển thị thông báo mỗi 15 giây
          console.log(`⏳ Đang xếp hàng... (đã chờ ${elapsedSeconds} giây)`);
          return pollTaskStatus(taskId, apiKey, startTime, retryCount, fileSizeMB, now, lastProgress, newStuckCounter);
        }
      } else if (status.state >= 2 && status.state <= 5) {
        // Đang xử lý, không có thông tin tiến độ
        if (timeSinceLastUpdate > 15000) { // Hiển thị thông báo mỗi 15 giây
          console.log(`⚙️ Đang xử lý... (trạng thái: ${status.state}, đã chờ ${elapsedSeconds} giây)`);
          return pollTaskStatus(taskId, apiKey, startTime, retryCount, fileSizeMB, now, lastProgress, newStuckCounter);
        }
      }
    }
  } catch (error) {
    // Kiểm tra lỗi tiến độ bị kẹt
    if (error.message === 'PROGRESS_STUCK') {
      if (retryCount < 5) {
        console.log(`⚠️ Tiến độ bị kẹt, thử lại lần ${retryCount + 1}... (đã chờ ${elapsedSeconds} giây)`);
        // Chờ một khoảng thời gian dài hơn trước khi thử lại
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL * 3));
        return pollTaskStatus(taskId, apiKey, Date.now(), retryCount + 1, fileSizeMB, 0, 0, 0);
      } else {
        throw new Error(`Tiến độ bị kẹt quá nhiều lần sau ${elapsedSeconds} giây, không thể tiếp tục xử lý`);
      }
    }
    
    // Nếu lỗi là timeout và chưa thử lại quá nhiều lần
    if ((error.message.includes('timeout') || error.code === 'ETIMEDOUT') && retryCount < 5) {
      console.log(`⏱️ Lỗi timeout khi kiểm tra trạng thái, thử lại lần ${retryCount + 1}...`);
      // Chờ một khoảng thời gian trước khi thử lại (tăng theo số lần thử)
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL * (retryCount + 2)));
      return pollTaskStatus(taskId, apiKey, startTime, retryCount + 1, fileSizeMB, lastProgressUpdate, lastProgress, stuckCounter);
    }
    throw error;
  }
  
  // Chờ một khoảng thời gian trước khi kiểm tra lại
  await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
  // Gọi đệ quy với các tham số đã cập nhật
  return pollTaskStatus(taskId, apiKey, startTime, retryCount, fileSizeMB, lastProgressUpdate, lastProgress, stuckCounter);
}

/**
 * Tải xuống file đã xử lý
 * @param {string} fileUrl - URL của file cần tải xuống
 * @param {string} outputPath - Đường dẫn lưu file
 * @param {number} retryCount - Số lần đã thử lại (mặc định là 0)
 */
export async function downloadProcessedFile(fileUrl, outputPath, retryCount = 0) {
  try {
    const response = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream',
      timeout: 1200000 // 1200 giây (20 phút) timeout cho tải xuống
    });
    
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    if ((error.message.includes('timeout') || error.code === 'ETIMEDOUT') && retryCount < 5) {
      console.log(`⏱️ Lỗi timeout khi tải file, thử lại lần ${retryCount + 1}...`);
      // Chờ một khoảng thời gian trước khi thử lại (tăng theo số lần thử)
      await new Promise(resolve => setTimeout(resolve, 20000 * (retryCount + 1)));
      return downloadProcessedFile(fileUrl, outputPath, retryCount + 1);
    }
    
    if (error.message.includes('network') && retryCount < 5) {
      console.log(`🌐 Lỗi mạng khi tải file, thử lại lần ${retryCount + 1}...`);
      // Chờ một khoảng thời gian trước khi thử lại
      await new Promise(resolve => setTimeout(resolve, 15000 * (retryCount + 1)));
      return downloadProcessedFile(fileUrl, outputPath, retryCount + 1);
    }
    
    throw new Error(`Lỗi khi tải file: ${error.message}`);
  }
}

/**
 * Xử lý file PDF để xóa watermark
 * @param {string} filePath - Đường dẫn đến file cần xử lý
 * @param {string} outputPath - Đường dẫn lưu file đã xử lý
 * @param {string} apiKey - API key
 * @param {number} retryCount - Số lần đã thử lại (mặc định là 0)
 * @param {boolean} useSimpleMethod - Sử dụng phương pháp đơn giản nếu phương pháp API không hoạt động
 */
export async function processPDFWatermark(filePath, outputPath, apiKey, retryCount = 0, useSimpleMethod = false) {
  try {
    // Nếu được yêu cầu sử dụng phương pháp đơn giản hoặc đã thử lại quá nhiều lần
    if (useSimpleMethod || retryCount >= 5) {
      console.log(`⚠️ Sử dụng phương pháp đơn giản để xử lý file PDF (bỏ qua API xóa watermark)`);
      
      // Sao chép file và chỉ thêm logo
      fs.copyFileSync(filePath, outputPath);
      
      // Thêm logo vào file PDF
      await removeHeaderFooterWatermark(outputPath, outputPath);
      console.log(`✅ Đã xử lý file bằng phương pháp đơn giản (chỉ thêm logo)`);
      
      return {
        inputSize: fs.statSync(filePath).size,
        outputSize: fs.statSync(outputPath).size,
        pages: 0,
        simpleMethod: true,
        processedPath: outputPath,
        success: true
      };
    }
    
    // Kiểm tra kích thước file
    const fileStats = fs.statSync(filePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    console.log(`Xử lý file PDF có kích thước: ${fileSizeMB.toFixed(2)} MB`);
    
    // Hiển thị thông tin về thời gian xử lý dự kiến
    console.log(`ℹ️ Ước tính thời gian xử lý: ${Math.ceil(fileSizeMB * 15 / 60)} phút hoặc lâu hơn cho file ${fileSizeMB.toFixed(2)} MB`);
    // Không còn giới hạn kích thước file
    
    // Tạo nhiệm vụ xử lý
    let taskId;
    try {
      taskId = await createWatermarkRemovalTask(filePath, apiKey);
      console.log(`✅ Đã tạo nhiệm vụ xử lý với ID: ${taskId}`);
    } catch (createTaskError) {
      // Kiểm tra lỗi 429 (Too Many Requests)
      if (createTaskError.message.includes('429') && retryCount < 5) {
        const waitTime = 10000 * (retryCount + 1); // Tăng thời gian chờ theo số lần thử
        console.log(`⏱️ Lỗi 429 (Too Many Requests), chờ ${waitTime/1000} giây trước khi thử lại lần ${retryCount + 1}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return processPDFWatermark(filePath, outputPath, apiKey, retryCount + 1, useSimpleMethod);
      }
      
      // Kiểm tra lỗi API_KEY_NO_CREDIT đặc biệt
      if (createTaskError.message === 'API_KEY_NO_CREDIT' || 
          createTaskError.message.includes('401') || 
          createTaskError.message.includes('credit') || 
          createTaskError.message.includes('quota')) {
        
        console.log(`❌ API key ${apiKey.substring(0, 5)}... đã hết credit. Xóa và thử key khác...`);
        
        // Xóa API key hiện tại
        removeApiKey(apiKey);
        
        // Lấy API key mới
        const newApiKey = await getNextApiKey();
        if (newApiKey) {
          console.log(`🔄 Thử lại với API key mới: ${newApiKey.substring(0, 5)}...`);
          return processPDFWatermark(filePath, outputPath, newApiKey, 0, useSimpleMethod);
        } else {
          throw new Error('Không còn API key nào khả dụng sau khi xóa key hết credit');
        }
      }
      
      // Nếu lỗi là timeout và chưa thử lại quá nhiều lần
      if ((createTaskError.message.includes('timeout') || createTaskError.code === 'ETIMEDOUT') && retryCount < 5) {
        console.log(`⏱️ Lỗi timeout khi tạo nhiệm vụ, thử lại lần ${retryCount + 1}...`);
        // Chờ một khoảng thời gian trước khi thử lại (tăng theo số lần thử)
        await new Promise(resolve => setTimeout(resolve, 10000 * (retryCount + 1)));
        return processPDFWatermark(filePath, outputPath, apiKey, retryCount + 1, useSimpleMethod);
      }
      
      throw createTaskError;
    }
    
    // Chờ và kiểm tra kết quả
    let result;
    try {
      result = await pollTaskStatus(taskId, apiKey, Date.now(), 0, fileSizeMB);
      console.log(`✅ Xử lý hoàn tất. Kích thước file đầu vào: ${result.input_size} bytes, đầu ra: ${result.output_size} bytes`);
    } catch (pollError) {
      // Kiểm tra lỗi tiến độ bị kẹt ở 21%
      if (pollError.message === 'PROGRESS_STUCK_AT_21') {
        console.log(`⚠️ Phát hiện tiến độ bị kẹt ở 21%. Chuyển sang phương pháp đơn giản...`);
        return processPDFWatermark(filePath, outputPath, apiKey, retryCount, true);
      }
      
      // Kiểm tra lỗi tiến độ bị kẹt
      if (pollError.message === 'PROGRESS_STUCK' || 
          pollError.message.includes('Tiến độ bị kẹt')) {
        
        console.log(`⚠️ Phát hiện tiến độ bị kẹt. Thử lại với API key khác...`);
        
        // Nếu chưa thử lại quá nhiều lần
        if (retryCount < 3) {
          // Lấy API key mới
          const newApiKey = await getNextApiKey();
          if (newApiKey && newApiKey !== apiKey) {
            console.log(`🔄 Thử lại với API key mới: ${newApiKey.substring(0, 5)}...`);
            return processPDFWatermark(filePath, outputPath, newApiKey, retryCount + 1, useSimpleMethod);
          }
        }
        
        // Nếu không có key mới hoặc đã thử lại quá nhiều lần, thử lại với cùng key
        console.log(`🔄 Thử lại với cùng API key: ${apiKey.substring(0, 5)}...`);
        return processPDFWatermark(filePath, outputPath, apiKey, retryCount + 1, useSimpleMethod);
      }
      
      // Kiểm tra lỗi API_KEY_NO_CREDIT đặc biệt
      if (pollError.message === 'API_KEY_NO_CREDIT' || 
          pollError.message.includes('401') || 
          pollError.message.includes('credit') || 
          pollError.message.includes('quota')) {
        
        console.log(`❌ API key ${apiKey.substring(0, 5)}... đã hết credit trong quá trình kiểm tra. Xóa và thử key khác...`);
        
        // Xóa API key hiện tại
        removeApiKey(apiKey);
        
        // Lấy API key mới
        const newApiKey = await getNextApiKey();
        if (newApiKey) {
          console.log(`🔄 Thử lại với API key mới: ${newApiKey.substring(0, 5)}...`);
          return processPDFWatermark(filePath, outputPath, newApiKey, 0, useSimpleMethod);
        } else {
          throw new Error('Không còn API key nào khả dụng sau khi xóa key hết credit');
        }
      }
      
      // Kiểm tra lỗi timeout
      if ((pollError.message.includes('timeout') || 
           pollError.message.includes('Quá thời gian chờ') || 
           pollError.code === 'ETIMEDOUT') && 
          retryCount < 5) {
        console.log(`⏱️ Lỗi timeout khi kiểm tra trạng thái, thử lại lần ${retryCount + 1}...`);
        // Chờ một khoảng thời gian trước khi thử lại (tăng theo số lần thử)
        await new Promise(resolve => setTimeout(resolve, 10000 * (retryCount + 1)));
        return processPDFWatermark(filePath, outputPath, apiKey, retryCount + 1, useSimpleMethod);
      }
      
      throw pollError;
    }
    
    // Tải xuống file đã xử lý
    try {
      await downloadProcessedFile(result.file, outputPath, 0);
      console.log(`📥 Đã tải file đã xử lý về ${outputPath}`);
    } catch (downloadError) {
      // Kiểm tra lỗi timeout
      if ((downloadError.message.includes('timeout') || downloadError.code === 'ETIMEDOUT') && retryCount < 5) {
        console.log(`⏱️ Lỗi timeout khi tải xuống file, thử lại lần ${retryCount + 1}...`);
        // Chờ một khoảng thời gian trước khi thử lại (tăng theo số lần thử)
        await new Promise(resolve => setTimeout(resolve, 10000 * (retryCount + 1)));
        
        // Thử tải lại file
        await downloadProcessedFile(result.file, outputPath, 0);
        console.log(`📥 Đã tải file đã xử lý về ${outputPath} sau khi thử lại`);
      } else {
        throw downloadError;
      }
    }
    
    return {
      inputSize: result.input_size,
      outputSize: result.output_size,
      pages: result.file_pages || 0,
      processedPath: outputPath,
      success: true
    };
  } catch (error) {
    // Nếu đã thử nhiều lần mà vẫn thất bại, sử dụng phương pháp đơn giản
    if (retryCount >= 4 && !useSimpleMethod) {
      console.log(`⚠️ Đã thử lại ${retryCount} lần không thành công. Chuyển sang phương pháp đơn giản...`);
      return processPDFWatermark(filePath, outputPath, apiKey, 0, true);
    }
    
    // Kiểm tra lỗi API_KEY_NO_CREDIT đặc biệt
    if (error.message === 'API_KEY_NO_CREDIT') {
      console.log(`❌ API key ${apiKey.substring(0, 5)}... đã hết credit. Xóa và thử key khác...`);
      
      // Xóa API key hiện tại
      removeApiKey(apiKey);
      
      // Lấy API key mới
      const newApiKey = await getNextApiKey();
      if (newApiKey) {
        console.log(`🔄 Thử lại với API key mới: ${newApiKey.substring(0, 5)}...`);
        return processPDFWatermark(filePath, outputPath, newApiKey, 0, useSimpleMethod);
      } else {
        throw new Error('Không còn API key nào khả dụng sau khi xóa key hết credit');
      }
    }
    
    // Kiểm tra lỗi timeout
    if ((error.message.includes('timeout') || 
         error.message.includes('Quá thời gian chờ') || 
         error.code === 'ETIMEDOUT') && 
        retryCount < 5) {
      console.log(`⏱️ Lỗi timeout khi xử lý PDF, thử lại lần ${retryCount + 1}...`);
      // Chờ một khoảng thời gian trước khi thử lại (tăng thời gian chờ theo số lần thử)
      await new Promise(resolve => setTimeout(resolve, 10000 * (retryCount + 1)));
      return processPDFWatermark(filePath, outputPath, apiKey, retryCount + 1, useSimpleMethod);
    }
    
    // Kiểm tra lỗi 401 (hết credit) từ các lỗi khác
    if (error.message.includes('401') || error.message.includes('quota') || 
        error.message.includes('credit') || error.message.includes('coins')) {
      console.log(`❌ API key ${apiKey.substring(0, 5)}... có thể đã hết credit. Xóa và thử key khác...`);
      
      // Xóa API key hiện tại
      removeApiKey(apiKey);
      
      // Lấy API key mới
      const newApiKey = await getNextApiKey();
      if (newApiKey) {
        console.log(`🔄 Thử lại với API key mới: ${newApiKey.substring(0, 5)}...`);
        return processPDFWatermark(filePath, outputPath, newApiKey, 0, useSimpleMethod);
      } else {
        throw new Error('Không còn API key nào khả dụng sau khi xóa key hết credit');
      }
    }
    
    // Kiểm tra lỗi "Xử lý thất bại"
    if (error.message.includes('Xử lý thất bại')) {
      console.log(`⚠️ Phát hiện lỗi "Xử lý thất bại", phân tích sâu hơn...`);
      
      // Kiểm tra kích thước file
      let fileStat;
      try {
        fileStat = fs.statSync(filePath);
        const fileSizeMB = fileStat.size / (1024 * 1024);
        console.log(`📊 Kích thước file: ${fileSizeMB.toFixed(2)} MB`);
        
        // Nếu file quá lớn, có thể là lý do khiến xử lý thất bại
        if (fileSizeMB > 30) {
          console.log(`⚠️ File có kích thước lớn (${fileSizeMB.toFixed(2)} MB), có thể là nguyên nhân gây lỗi`);
          
          // Nếu đã thử lại ít nhất 2 lần hoặc file rất lớn, thử phương pháp khác
          if (retryCount >= 2 || fileSizeMB > 50) {
            console.log(`🔄 Thử sử dụng phương pháp xử lý thay thế cho file lớn...`);
            
            // Chuẩn bị file output
            if (outputPath) {
              // Sao chép file gốc nếu không thể xử lý được
              fs.copyFileSync(filePath, outputPath);
              console.log(`⚠️ Không thể xử lý watermark cho file lớn, đã sao chép file gốc`);
              
              return {
                skippedDueToSize: true,
                inputSize: fileStat.size,
                outputSize: fileStat.size,
                processedPath: outputPath,
                message: `Không thể xử lý watermark cho file lớn ${fileSizeMB.toFixed(2)} MB`
              };
            }
          }
        }
      } catch (statError) {
        console.error(`Không thể đọc thông tin file: ${statError.message}`);
      }
      
      // Thử với API key mới nếu chưa thử quá nhiều lần
      if (retryCount < 3) {
        console.log(`🔄 Thử lại lần ${retryCount + 1} với API key khác do lỗi xử lý thất bại...`);
        
        // Lấy API key mới
        const newApiKey = await getNextApiKey();
        if (newApiKey && newApiKey !== apiKey) {
          console.log(`🔄 Thử lại với API key mới: ${newApiKey.substring(0, 5)}...`);
          return processPDFWatermark(filePath, outputPath, newApiKey, retryCount + 1, useSimpleMethod);
        }
      }
      
      // Nếu đã thử nhiều lần hoặc không có API key mới, thử phương pháp đơn giản nếu chưa thử
      if (!useSimpleMethod) {
        console.log(`🔄 Chuyển sang phương pháp đơn giản do lỗi xử lý thất bại...`);
        return processPDFWatermark(filePath, outputPath, apiKey, retryCount + 1, true);
      }
      
      // Nếu đã thử phương pháp đơn giản mà vẫn thất bại, log thêm thông tin và trả về lỗi chi tiết
      console.error(`❌ Đã thử tất cả các phương pháp nhưng không thành công xử lý watermark`);
      throw new Error(`Không thể xử lý PDF sau nhiều lần thử: ${error.message}. Vui lòng kiểm tra lại file hoặc thử lại sau.`);
    }
    
    // Ghi log chi tiết và ném lỗi
    console.error(`❌ Chi tiết lỗi xử lý PDF:`, error);
    
    if (error.response) {
      throw new Error(`Lỗi API xử lý PDF (${error.response.status}): ${error.message}`);
    } else if (error.request) {
      throw new Error(`Lỗi kết nối API xử lý PDF: ${error.message}`);
    } else {
      throw new Error(`Lỗi khi xử lý PDF: ${error.message}`);
    }
  }
} 