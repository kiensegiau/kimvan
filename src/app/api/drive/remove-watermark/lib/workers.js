/**
 * Các hàm xử lý worker threads
 */
import { Worker } from 'worker_threads';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { DEFAULT_CONFIG } from './config.js';

const execPromise = promisify(exec);

// Biến để kiểm soát việc kết nối đến database
let shouldConnectDB = false;

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
          connectToDB: false // Thêm flag không kết nối đến DB
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
      
      const worker = new Worker(__filename, {
        workerData: {
          task: 'processPage',
          pngPath,
          processedPngPath,
          page,
          numPages,
          config,
          connectToDB: false // Thêm flag không kết nối đến DB
        }
      });
      
      worker.on('message', (result) => {
        try {
          if (result.success) {
            resolve({ ...result, index: page - 1 });
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
          console.warn(`Worker xử lý trang ${page} kết thúc với mã lỗi ${code}`);
        }
      });
    } catch (workerError) {
      reject(new Error(`Không thể tạo worker xử lý ảnh: ${workerError.message}`));
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
        results.push({ success: false, page, error: result.reason.message });
      }
    });
    
    // Giải phóng bộ nhớ giữa các batch
    if (global.gc) {
      global.gc();
    }
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
    // Đọc hình ảnh
    let image;
    try {
      image = sharp(pngPath);
    } catch (sharpError) {
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
          })
          .linear(
            1 + (config.contrast / 100),
            -(config.contrast / 2)
          );
        
        // Chỉ áp dụng threshold nếu không giữ màu sắc
        if (config.threshold > 0 && !config.keepColors) {
          try {
            processedImage = processedImage.threshold(config.threshold * 100);
          } catch (thresholdError) {
            console.warn(`Không thể áp dụng threshold: ${thresholdError.message}`);
          }
        }
        
        // Nếu giữ màu sắc, có thể áp dụng các phương pháp khác để xóa watermark
        if (config.keepColors) {
          try {
            // Thêm xử lý nâng cao để làm mờ watermark
            processedImage = processedImage.gamma(config.gamma);
            processedImage = processedImage.sharpen(config.sharpening);
            
            // Thêm xử lý màu sắc nâng cao để giảm thiểu hiệu ứng watermark
            // Tăng độ tương phản cục bộ để làm rõ nội dung
            processedImage = processedImage.normalise();
            
            // Loại bỏ nhiễu và làm mịn khu vực có watermark
            if (config.sharpening > 1.4) {
              processedImage = processedImage.median(3);
            }
          } catch (filterError) {
            console.warn(`Không thể áp dụng một số bộ lọc: ${filterError.message}`);
          }
        }
        
        try {
          await processedImage.toFile(processedPngPath);
        } catch (saveError) {
          throw new Error(`Không thể lưu ảnh đã xử lý: ${saveError.message}`);
        }
      } catch (fullImageProcessError) {
        throw new Error(`Lỗi xử lý toàn bộ ảnh: ${fullImageProcessError.message}`);
      }
    }
    
    return { success: true, page, processedPngPath };
  } catch (error) {
    console.error(`Lỗi xử lý trang ${page}: ${error.message}`);
    return { success: false, page, error: error.message };
  }
} 