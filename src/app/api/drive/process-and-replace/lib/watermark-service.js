import fs from 'fs';
import axios from 'axios';
import { 
  createWatermarkRemovalTask, 
  checkTaskStatus 
} from './pdf-service';
import { 
  removeHeaderFooterWatermark, 
  addLogoToPDF 
} from './pdf-service';
import { getNextApiKey, removeApiKey } from '@/utils/watermark-api-keys';

// Thời gian tối đa chờ xử lý từ API (1800 giây = 30 phút)
const MAX_POLLING_TIME = 1800000;
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
 */
export async function downloadProcessedFile(fileUrl, outputPath) {
  try {
    const response = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream',
      timeout: 600000 // 600 giây (10 phút) timeout cho tải xuống
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
        simpleMethod: true
      };
    }
    
    // Kiểm tra kích thước file
    const fileStats = fs.statSync(filePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    console.log(`Xử lý file PDF có kích thước: ${fileSizeMB.toFixed(2)} MB`);
    
    // Nếu file quá lớn, hiển thị cảnh báo
    if (fileSizeMB > 100) {
      console.log(`⚠️ Cảnh báo: File rất lớn (${fileSizeMB.toFixed(2)} MB), quá trình xử lý có thể mất rất nhiều thời gian`);
      console.log(`Thời gian xử lý ước tính: ${Math.ceil(fileSizeMB * 15 / 60)} phút hoặc lâu hơn`);
    }
    
    // Tạo nhiệm vụ xử lý
    let taskId;
    try {
      taskId = await createWatermarkRemovalTask(filePath, apiKey);
      console.log(`✅ Đã tạo nhiệm vụ xử lý với ID: ${taskId}`);
    } catch (createTaskError) {
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
      await downloadProcessedFile(result.file, outputPath);
      console.log(`📥 Đã tải file đã xử lý về ${outputPath}`);
    } catch (downloadError) {
      // Kiểm tra lỗi timeout
      if ((downloadError.message.includes('timeout') || downloadError.code === 'ETIMEDOUT') && retryCount < 5) {
        console.log(`⏱️ Lỗi timeout khi tải xuống file, thử lại lần ${retryCount + 1}...`);
        // Chờ một khoảng thời gian trước khi thử lại (tăng theo số lần thử)
        await new Promise(resolve => setTimeout(resolve, 10000 * (retryCount + 1)));
        
        // Thử tải lại file
        await downloadProcessedFile(result.file, outputPath);
        console.log(`📥 Đã tải file đã xử lý về ${outputPath} sau khi thử lại`);
      } else {
        throw downloadError;
      }
    }
    
    return {
      inputSize: result.input_size,
      outputSize: result.output_size,
      pages: result.file_pages || 0
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
    
    throw new Error(`Lỗi khi xử lý PDF: ${error.message}`);
  }
} 