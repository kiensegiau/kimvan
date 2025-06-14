/**
 * Các hàm xử lý worker threads
 * Lưu ý: Tất cả worker threads đều tắt kết nối database để tránh tạo quá nhiều kết nối
 */
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { DEFAULT_CONFIG } from './config.js';

const execPromise = promisify(exec);

// Số lượng worker tối đa chạy đồng thời (để tránh tràn RAM)
const MAX_CONCURRENT_WORKERS = 3;

// Hàm tạo worker để chuyển đổi PDF sang PNG
export function createConvertWorker(gsPath, pdfPath, pngPath, page, numPages, dpi) {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(__filename, {
        workerData: {
          task: 'convertPage',
          gsPath,
          pdfPath,
          pngPath,
          page,
          numPages,
          dpi,
          DB_DISABLED: true // Đảm bảo luôn tắt kết nối DB trong worker
        },
        env: {
          ...process.env,
          WORKER_THREAD: 'true', // Đánh dấu đây là worker thread
          NO_DB: 'true' // Tắt kết nối database
        }
      });
      
      worker.on('message', (result) => {
        try {
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(result.error));
          }
        } catch (messageError) {
          reject(new Error(`Lỗi xử lý message từ worker: ${messageError.message}`));
        }
      });
      
      worker.on('error', (err) => {
        reject(err);
      });
      
      worker.on('exit', (code) => {
        if (code !== 0) {
          // Handle non-zero exit code
          console.warn(`Worker chuyển đổi PDF trang ${page} kết thúc với mã lỗi ${code}`);
        }
      });
    } catch (workerError) {
      reject(new Error(`Không thể tạo worker chuyển đổi PDF: ${workerError.message}`));
    }
  });
}

// Hàm xử lý chuyển đổi PDF sang PNG theo batch để tránh tràn RAM
export async function processPDFConversionInBatches(gsPath, pdfPath, outputDir, numPages, dpi, batchSize = MAX_CONCURRENT_WORKERS) {
  console.log(`Bắt đầu xử lý chuyển đổi PDF sang PNG theo batch, tổng số trang: ${numPages}`);
  
  const results = [];
  const totalBatches = Math.ceil(numPages / batchSize);
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startPage = batchIndex * batchSize + 1;
    const endPage = Math.min((batchIndex + 1) * batchSize, numPages);
    console.log(`Đang xử lý batch ${batchIndex + 1}/${totalBatches}, trang ${startPage}-${endPage}`);
    
    const batchPromises = [];
    for (let page = startPage; page <= endPage; page++) {
      const pngPath = path.join(outputDir, `page_${page}.png`);
      batchPromises.push(createConvertWorker(gsPath, pdfPath, pngPath, page, numPages, dpi));
    }
    
    // Chờ hoàn thành xử lý batch hiện tại trước khi chuyển sang batch tiếp theo
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const page = startPage + index;
        console.error(`Không thể chuyển đổi trang ${page}: ${result.reason}`);
        results.push({ success: false, page, error: result.reason.message });
      }
    });
    
    // Giải phóng bộ nhớ giữa các batch
    if (global.gc) {
      global.gc();
    }
  }
  
  return results;
}

// Hàm tạo worker để xử lý một trang
export function createProcessWorker(pngPath, page, numPages, config) {
  return new Promise((resolve, reject) => {
    try {
      const processedPngPath = path.join(path.dirname(pngPath), `page_${page}_processed.png`);
      
      // Kiểm tra file đầu vào trước khi tạo worker
      if (!fs.existsSync(pngPath)) {
        console.warn(`File ảnh đầu vào không tồn tại: ${pngPath}, đang bỏ qua xử lý trang ${page}`);
        
        // Tạo file kết quả trống để tránh lỗi
        try {
          fs.writeFileSync(processedPngPath, '');
          resolve({ success: false, index: page - 1, error: 'File đầu vào không tồn tại', processedPngPath });
          return;
        } catch (writeError) {
          reject(new Error(`Không thể tạo file kết quả trống: ${writeError.message}`));
          return;
        }
      }
      
      const worker = new Worker(__filename, {
        workerData: {
          task: 'processPage',
          pngPath,
          processedPngPath,
          page,
          numPages,
          config,
          DB_DISABLED: true // Tắt hoàn toàn kết nối DB trong worker
        },
        env: {
          ...process.env,
          WORKER_THREAD: 'true', // Đánh dấu đây là worker thread
          NO_DB: 'true' // Tắt kết nối database
        }
      });
      
      worker.on('message', (result) => {
        try {
          if (result.success) {
            resolve({ ...result, index: page - 1 });
          } else {
            // Thử sao chép file gốc khi worker báo lỗi
            try {
              if (fs.existsSync(pngPath)) {
                fs.copyFileSync(pngPath, processedPngPath);
                console.log(`Đã sao chép file gốc khi worker báo lỗi cho trang ${page}`);
                resolve({
                  success: true,
                  page, 
                  index: page - 1,
                  processedPngPath,
                  warning: `Sử dụng file gốc do lỗi worker: ${result.error}`
                });
                return;
              }
            } catch (copyError) {
              console.error(`Không thể sao chép file gốc từ worker: ${copyError.message}`);
            }
            
            reject(new Error(result.error));
          }
        } catch (messageError) {
          reject(new Error(`Lỗi xử lý message từ worker: ${messageError.message}`));
        }
      });
      
      worker.on('error', (err) => {
        // Thử sao chép file gốc khi worker lỗi
        try {
          if (fs.existsSync(pngPath)) {
            fs.copyFileSync(pngPath, processedPngPath);
            console.log(`Đã sao chép file gốc khi worker error cho trang ${page}`);
            resolve({
              success: true,
              page,
              index: page - 1,
              processedPngPath,
              warning: `Sử dụng file gốc do lỗi worker: ${err.message}`
            });
            return;
          }
        } catch (copyError) {
          console.error(`Không thể sao chép file gốc từ worker error: ${copyError.message}`);
        }
        
        reject(err);
      });
      
      worker.on('exit', (code) => {
        if (code !== 0) {
          // Handle non-zero exit code
          console.warn(`Worker xử lý trang ${page} kết thúc với mã lỗi ${code}`);
          
          // Thử sao chép file gốc khi worker exit không thành công
          try {
            if (fs.existsSync(pngPath) && !fs.existsSync(processedPngPath)) {
              fs.copyFileSync(pngPath, processedPngPath);
              console.log(`Đã sao chép file gốc khi worker exit code ${code} cho trang ${page}`);
              resolve({
                success: true,
                page,
                index: page - 1,
                processedPngPath,
                warning: `Sử dụng file gốc do worker kết thúc với mã lỗi ${code}`
              });
              return;
            }
          } catch (copyError) {
            console.error(`Không thể sao chép file gốc khi worker exit: ${copyError.message}`);
          }
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Hàm xử lý ảnh PNG theo batch để tránh tràn RAM
export async function processImagesInBatches(pagePaths, numPages, config, batchSize = MAX_CONCURRENT_WORKERS) {
  console.log(`Bắt đầu xử lý ảnh theo batch, tổng số ảnh: ${pagePaths.length}`);
  
  const results = [];
  const totalBatches = Math.ceil(pagePaths.length / batchSize);
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * batchSize;
    const endIndex = Math.min((batchIndex + 1) * batchSize, pagePaths.length);
    console.log(`Đang xử lý batch ${batchIndex + 1}/${totalBatches}, ảnh ${startIndex + 1}-${endIndex}`);
    
    const batchPromises = [];
    for (let i = startIndex; i < endIndex; i++) {
      const page = i + 1; // Chuyển từ index sang số trang
      batchPromises.push(createProcessWorker(pagePaths[i], page, numPages, config));
    }
    
    // Chờ hoàn thành xử lý batch hiện tại trước khi chuyển sang batch tiếp theo
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const page = startIndex + index + 1;
        console.error(`Không thể xử lý ảnh trang ${page}: ${result.reason}`);
        
        // Tạo bản sao của file gốc làm kết quả khi có lỗi
        try {
          const pngPath = pagePaths[startIndex + index];
          const processedPngPath = path.join(path.dirname(pngPath), `page_${page}_processed.png`);
          
          if (fs.existsSync(pngPath)) {
            fs.copyFileSync(pngPath, processedPngPath);
            console.log(`Đã tạo kết quả từ bản sao file gốc cho trang ${page}`);
            results.push({ 
              success: true, 
              page, 
              index: page - 1,
              processedPngPath, 
              warning: `Sử dụng file gốc do lỗi xử lý: ${result.reason}` 
            });
          } else {
            // Nếu file gốc không tồn tại, ghi nhận lỗi
            results.push({ success: false, page, index: page - 1, error: result.reason.message });
          }
        } catch (copyError) {
          console.error(`Không thể tạo bản sao cho trang ${page}: ${copyError.message}`);
          results.push({ success: false, page, index: page - 1, error: result.reason.message });
        }
      }
    });
    
    // Giải phóng bộ nhớ giữa các batch
    if (global.gc) {
      global.gc();
    }
    
    // Tạm dừng một chút giữa các batch để giảm tải hệ thống
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results.sort((a, b) => a.index - b.index); // Sắp xếp kết quả theo thứ tự trang
}

// Hàm chuyển đổi PDF sang PNG trong worker thread
export async function convertPage(data) {
  const { gsPath, pdfPath, pngPath, page, numPages, dpi } = data;
  
  try {
    // Tối ưu lệnh chuyển đổi với các tùy chọn hiệu suất cao hơn
    await execPromise(`"${gsPath}" -dALLOWPSTRANSPARENCY -dQUIET -dBATCH -dNOPAUSE -dNOPAUSE -dMaxBitmap=500000000 -dNOGC -dBufferSpace=1000000 -sDEVICE=png16m -r${dpi} -o "${pngPath}" "${pdfPath}"`);
    return { success: true, page, pngPath };
  } catch (error) {
    console.error(`Lỗi chuyển đổi trang ${page}: ${error.message}`);
    return { success: false, page, error: error.message };
  }
}

// Hàm xử lý trang trong worker thread
export async function processPage(data) {
  const { pngPath, processedPngPath, page, numPages, config } = data;
  
  try {
    // Kiểm tra tồn tại của file đầu vào
    if (!fs.existsSync(pngPath)) {
      console.error(`File ảnh không tồn tại: ${pngPath}`);
      return { success: false, page, error: 'File ảnh không tồn tại' };
    }
    
    // Đảm bảo thư mục đầu ra tồn tại
    const outputDir = path.dirname(processedPngPath);
    if (!fs.existsSync(outputDir)) {
      try {
        fs.mkdirSync(outputDir, { recursive: true });
      } catch (mkdirError) {
        console.error(`Không thể tạo thư mục đầu ra: ${mkdirError.message}`);
      }
    }
    
    // Đọc hình ảnh
    let image;
    try {
      image = sharp(pngPath);
    } catch (sharpError) {
      // Thử sao chép file gốc nếu không thể xử lý
      try {
        fs.copyFileSync(pngPath, processedPngPath);
        console.log(`Đã sao chép file gốc làm kết quả cho trang ${page} do lỗi: ${sharpError.message}`);
        return { success: true, page, processedPngPath, warning: 'Sử dụng file gốc do lỗi' };
      } catch (copyError) {
        console.error(`Không thể sao chép file gốc: ${copyError.message}`);
      }
      throw new Error(`Không thể tạo đối tượng sharp từ ${pngPath}: ${sharpError.message}`);
    }
    
    let metadata;
    try {
      metadata = await image.metadata();
    } catch (metadataError) {
      throw new Error(`Không thể đọc metadata của ảnh: ${metadataError.message}`);
    }
    
    if (config.processCenter) {
      try {
        // Xử lý vùng trung tâm
        const centerX = Math.floor(metadata.width * 0.1);
        const centerY = Math.floor(metadata.height * 0.1);
        const centerWidth = Math.floor(metadata.width * config.centerSize);
        const centerHeight = Math.floor(metadata.height * config.centerSize);
        
        let center;
        try {
          center = await image
            .clone()
            .extract({
              left: centerX,
              top: centerY,
              width: centerWidth,
              height: centerHeight
            })
            .modulate({
              brightness: 1 + (config.brightness / 100)
            })
            .linear(
              1 + (config.contrast / 100),
              -(config.contrast / 2)
            )
            .toBuffer();
        } catch (extractError) {
          throw new Error(`Không thể trích xuất và xử lý vùng trung tâm: ${extractError.message}`);
        }
        
        let processedCenter = sharp(center);
        if (config.threshold > 0 && !config.keepColors) {
          try {
            processedCenter = processedCenter.threshold(config.threshold * 100);
          } catch (thresholdError) {
            console.warn(`Không thể áp dụng threshold: ${thresholdError.message}`);
          }
        }
        
        let processedCenterBuffer;
        try {
          processedCenterBuffer = await processedCenter.toBuffer();
        } catch (bufferError) {
          throw new Error(`Không thể tạo buffer cho vùng trung tâm đã xử lý: ${bufferError.message}`);
        }
        
        try {
          await sharp(pngPath)
            .composite([{
              input: processedCenterBuffer,
              left: centerX,
              top: centerY
            }])
            .toFile(processedPngPath);
        } catch (compositeError) {
          throw new Error(`Không thể ghép ảnh: ${compositeError.message}`);
        }
      } catch (centerProcessError) {
        throw new Error(`Lỗi xử lý vùng trung tâm: ${centerProcessError.message}`);
      }
    } else {
      try {
        // Xử lý toàn bộ hình ảnh
        let processedImage = image
          .modulate({
            brightness: 1 + (config.brightness / 100),
            saturation: 1.2  // Tăng độ bão hòa màu để làm rõ nội dung
          }, { failOnError: false })
          .linear(
            1 + (config.contrast / 100),
            -(config.contrast / 2)
          , { failOnError: false });
        
        // Chỉ áp dụng threshold nếu không giữ màu sắc
        if (config.threshold > 0 && !config.keepColors) {
          try {
            processedImage = processedImage.threshold(config.threshold * 100, { failOnError: false });
          } catch (thresholdError) {
            console.warn(`Không thể áp dụng threshold: ${thresholdError.message}`);
          }
        }
        
        // Nếu giữ màu sắc, có thể áp dụng các phương pháp khác để xóa watermark
        if (config.keepColors) {
          try {
            // Áp dụng từng bước xử lý trong try-catch riêng biệt
            try {
              // Thay thế gamma bằng điều chỉnh tương phản để có hiệu ứng tương tự
              processedImage = processedImage.linear(1.2, -0.1);
              console.log(`Đã thay thế gamma bằng điều chỉnh tương phản`);
            } catch (contrastError) {
              console.warn(`Không thể áp dụng thay thế gamma: ${contrastError.message}`);
            }
            
            try {
              // Thay thế sharpen bằng phương pháp đơn giản hơn
              processedImage = processedImage.recomb([
                [1.1, 0, 0],
                [0, 1.1, 0],
                [0, 0, 1.1]
              ]);
              console.log(`Đã thay thế sharpen bằng bộ lọc recomb`);
            } catch (recombError) {
              console.warn(`Không thể áp dụng thay thế sharpen: ${recombError.message}`);
            }
            
            try {
              // Tăng độ tương phản cục bộ để làm rõ nội dung
              processedImage = processedImage.normalise({ failOnError: false });
            } catch (normaliseError) {
              console.warn(`Không thể áp dụng normalise: ${normaliseError.message}`);
            }
            
            // Loại bỏ nhiễu và làm mịn khu vực có watermark
            if (config.sharpening > 1.4) {
              try {
                processedImage = processedImage.median(3, { failOnError: false });
              } catch (medianError) {
                console.warn(`Không thể áp dụng median: ${medianError.message}`);
              }
            }
          } catch (filterError) {
            console.warn(`Không thể áp dụng một số bộ lọc: ${filterError.message}`);
          }
        }
        
        try {
          await processedImage.toFile(processedPngPath);
        } catch (saveError) {
          // Thử sao chép file gốc nếu không thể lưu
          try {
            fs.copyFileSync(pngPath, processedPngPath);
            console.log(`Đã sao chép file gốc do lỗi lưu file: ${saveError.message}`);
            return { success: true, page, processedPngPath, warning: 'Sử dụng file gốc do lỗi lưu file' };
          } catch (copyError) {
            console.error(`Không thể sao chép file gốc khi lưu: ${copyError.message}`);
          }
          throw new Error(`Không thể lưu ảnh đã xử lý: ${saveError.message}`);
        }
      } catch (fullImageProcessError) {
        throw new Error(`Lỗi xử lý toàn bộ ảnh: ${fullImageProcessError.message}`);
      }
    }
    
    return { success: true, page, processedPngPath };
  } catch (error) {
    console.error(`Lỗi xử lý trang ${page}: ${error.message}`);
    
    // Thử sao chép file gốc nếu có lỗi
    try {
      if (fs.existsSync(pngPath)) {
        fs.copyFileSync(pngPath, processedPngPath);
        console.log(`Đã sao chép file gốc làm kết quả cho trang ${page} sau lỗi xử lý`);
        return { 
          success: true, 
          page, 
          processedPngPath, 
          warning: `Sử dụng file gốc do lỗi: ${error.message}` 
        };
      }
    } catch (fallbackError) {
      console.error(`Không thể tạo kết quả dự phòng: ${fallbackError.message}`);
    }
    
    return { success: false, page, error: error.message };
  }
}

// Hàm kiểm tra xem có nên tắt kết nối database không
export function shouldDisableDatabase() {
  // Kiểm tra các điều kiện để tắt kết nối database
  return (
    // Đang chạy trong worker thread
    process.env.WORKER_THREAD === 'true' ||
    // Biến môi trường chỉ định tắt DB
    process.env.NO_DB === 'true' ||
    // Đang chạy trong môi trường test
    process.env.NODE_ENV === 'test' ||
    // Đang chạy các tác vụ xử lý tệp tin mà không cần DB
    process.env.FILE_PROCESSING_ONLY === 'true'
  );
}

// Ghi log cảnh báo nếu có kết nối database trong worker thread
if (process.env.WORKER_THREAD === 'true' && !process.env.NO_DB) {
  console.warn('CẢNH BÁO: Worker thread không nên kết nối đến database. Đặt NO_DB=true để tắt kết nối.');
}

// Thêm code xử lý worker thread entry point
if (!isMainThread) {
  // Đảm bảo không có kết nối database nào được tạo
  process.env.NO_DB = 'true';
  
  // Ghi đè các biến môi trường liên quan đến database để ngăn kết nối
  process.env.DATABASE_URL = '';
  process.env.DB_CONNECTION_STRING = '';
  process.env.MONGODB_URI = '';
  process.env.POSTGRES_URL = '';
  process.env.MYSQL_URL = '';
  
  // Xử lý nhiệm vụ được giao
  const handleTask = async () => {
    try {
      if (!workerData || !workerData.task) {
        throw new Error('Không có nhiệm vụ được giao cho worker');
      }
      
      console.log(`Worker bắt đầu nhiệm vụ: ${workerData.task}`);
      
      let result;
      // Chọn hàm xử lý dựa trên nhiệm vụ
      switch (workerData.task) {
        case 'convertPage':
          result = await convertPage(workerData);
          break;
        case 'processPage':
          result = await processPage(workerData);
          break;
        default:
          throw new Error(`Nhiệm vụ không được hỗ trợ: ${workerData.task}`);
      }
      
      // Gửi kết quả về cho thread chính
      parentPort.postMessage(result);
    } catch (error) {
      console.error(`Lỗi trong worker thread: ${error.message}`);
      // Gửi thông báo lỗi về cho thread chính
      parentPort.postMessage({ 
        success: false, 
        error: error.message,
        task: workerData?.task
      });
    }
  };
  
  // Bắt đầu xử lý
  handleTask();
} 