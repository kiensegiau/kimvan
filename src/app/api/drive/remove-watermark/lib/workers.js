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

// Hàm tạo worker để chuyển đổi PDF sang PNG
export function createConvertWorker(gsPath, pdfPath, pngPath, page, numPages, dpi) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: {
        task: 'convertPage',
        gsPath,
        pdfPath,
        pngPath,
        page,
        numPages,
        dpi
      }
    });
    
    worker.on('message', (result) => {
      if (result.success) {
        resolve(result);
      } else {
        reject(new Error(result.error));
      }
    });
    
    worker.on('error', (err) => {
      reject(err);
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        // Handle non-zero exit code
      }
    });
  });
}

// Hàm tạo worker để xử lý một trang
export function createProcessWorker(pngPath, page, numPages, config) {
  return new Promise((resolve, reject) => {
    const processedPngPath = path.join(path.dirname(pngPath), `page_${page}_processed.png`);
    
    const worker = new Worker(__filename, {
      workerData: {
        task: 'processPage',
        pngPath,
        processedPngPath,
        page,
        numPages,
        config
      }
    });
    
    worker.on('message', (result) => {
      if (result.success) {
        resolve({ ...result, index: page - 1 });
      } else {
        reject(new Error(result.error));
      }
    });
    
    worker.on('error', (err) => {
      reject(err);
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        // Handle non-zero exit code
      }
    });
  });
}

// Hàm chuyển đổi PDF sang PNG trong worker thread
export async function convertPage(data) {
  const { gsPath, pdfPath, pngPath, page, numPages, dpi } = data;
  
  try {
    // Tối ưu lệnh chuyển đổi với các tùy chọn hiệu suất cao hơn
    await execPromise(`"${gsPath}" -dALLOWPSTRANSPARENCY -dQUIET -dBATCH -dNOPAUSE -dNOPAUSE -dMaxBitmap=500000000 -dNOGC -dBufferSpace=1000000 -sDEVICE=png16m -r${dpi} -o "${pngPath}" "${pdfPath}"`);
    return { success: true, page, pngPath };
  } catch (error) {
    return { success: false, page, error: error.message };
  }
}

// Hàm xử lý trang trong worker thread
export async function processPage(data) {
  const { pngPath, processedPngPath, page, numPages, config } = data;
  
  try {
    // Đọc hình ảnh
    const image = sharp(pngPath);
    const metadata = await image.metadata();
    
    if (config.processCenter) {
      // Xử lý vùng trung tâm
      const centerX = Math.floor(metadata.width * 0.1);
      const centerY = Math.floor(metadata.height * 0.1);
      const centerWidth = Math.floor(metadata.width * config.centerSize);
      const centerHeight = Math.floor(metadata.height * config.centerSize);
      
      const center = await image
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
      
      let processedCenter = sharp(center);
      if (config.threshold > 0 && !config.keepColors) {
        processedCenter = processedCenter.threshold(config.threshold * 100);
      }
      
      const processedCenterBuffer = await processedCenter.toBuffer();
      
      await sharp(pngPath)
        .composite([{
          input: processedCenterBuffer,
          left: centerX,
          top: centerY
        }])
        .toFile(processedPngPath);
    } else {
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
        processedImage = processedImage.threshold(config.threshold * 100);
      }
      
      // Nếu giữ màu sắc, có thể áp dụng các phương pháp khác để xóa watermark
      if (config.keepColors) {
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
      }
      
      await processedImage.toFile(processedPngPath);
    }
    
    return { success: true, page, processedPngPath };
  } catch (error) {
    return { success: false, page, error: error.message };
  }
} 