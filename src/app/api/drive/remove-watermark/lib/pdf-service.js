/**
 * Các hàm xử lý PDF
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { PDFDocument } from 'pdf-lib';

// Thêm cache cho kết quả đếm trang PDF
const pageCountCache = new Map();

// Tối ưu hàm đếm số trang PDF
export async function countPdfPagesWithGhostscript(pdfPath, gsPath) {
  // Kiểm tra cache trước
  const cacheKey = pdfPath;
  if (pageCountCache.has(cacheKey)) {
    return pageCountCache.get(cacheKey);
  }

  try {
    // Chuẩn hóa đường dẫn và escape đúng cho cú pháp PostScript
    const normalizedPath = pdfPath.replace(/\\/g, '/');
    const escapedPath = normalizedPath.replace(/[\(\)]/g, '\\$&');
    
    // Đơn giản hóa lệnh để tăng hiệu suất
    const command = `"${gsPath}" -q -dNODISPLAY -c "(${escapedPath}) (r) file runpdfbegin pdfpagecount = quit"`;
    
    let output;
    try {
      output = execSync(command, { encoding: 'utf8' }).trim();
    } catch (execError) {
      console.error(`Lỗi khi thực thi lệnh GhostScript: ${execError.message}`);
      throw new Error(`Không thể đếm số trang với GhostScript: ${execError.message}`);
    }
    
    const numPages = parseInt(output);
    
    if (!isNaN(numPages)) {
      // Lưu vào cache
      pageCountCache.set(cacheKey, numPages);
      return numPages;
    }

    // Thay vì thử nhiều phương pháp tuần tự, sử dụng Promise.any để chạy song song
    try {
      const results = await Promise.any([
        // Phương pháp thay thế 1
        (async () => {
          try {
            const altCommand = `"${gsPath}" -q -dNODISPLAY -dNOSAFER -c "(${escapedPath}) << /SubFileDecode true >> (r) file pdfdict begin pdfinitfile Trailer/Root get/Pages get/Count get == quit"`;
            const altOutput = execSync(altCommand, { encoding: 'utf8' }).trim();
            const pages = parseInt(altOutput);
            if (isNaN(pages)) throw new Error('Không thể phân tích kết quả');
            return pages;
          } catch (altError) {
            throw new Error(`Phương pháp thay thế 1 không thành công: ${altError.message}`);
          }
        })(),
        
        // Phương pháp thay thế 2: pdf-lib
        (async () => {
          try {
            const pdfBuffer = fs.readFileSync(pdfPath);
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            return pdfDoc.getPageCount();
          } catch (pdfLibError) {
            throw new Error(`Phương pháp pdf-lib không thành công: ${pdfLibError.message}`);
          }
        })()
      ]);
      
      // Lưu kết quả vào cache
      pageCountCache.set(cacheKey, results);
      return results;
    } catch (promiseError) {
      console.error(`Tất cả các phương pháp đếm trang đều thất bại: ${promiseError.message}`);
      throw new Error(`Không thể đếm số trang PDF: ${promiseError.message}`);
    }
  } catch (error) {
    // Fallback - đọc trực tiếp từ file thay vì chạy nhiều lệnh
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = pdfDoc.getPageCount();
      
      // Lưu vào cache
      pageCountCache.set(cacheKey, pageCount);
      return pageCount;
    } catch (fallbackError) {
      console.error(`Lỗi fallback đếm trang: ${fallbackError.message}`);
      return 1; // Fallback cuối cùng
    }
  }
}

// Tối ưu hàm vẽ hình ảnh vào PDF
export async function addImageToPdf(pdfDoc, pngPath, index, totalPages, config) {
  try {
    if (!fs.existsSync(pngPath)) {
      console.warn(`Không tìm thấy file ảnh: ${pngPath}`);
      return false;
    }
    
    // Đọc dữ liệu PNG - sử dụng đệm buffer lớn hơn để giảm I/O
    let pngData;
    try {
      pngData = fs.readFileSync(pngPath, { 
        highWaterMark: 1024 * 1024 // 1MB buffer
      });
    } catch (readError) {
      console.error(`Không thể đọc file PNG ${pngPath}: ${readError.message}`);
      return false;
    }
    
    // Nhúng hình ảnh nội dung vào PDF
    let contentImage;
    try {
      contentImage = await pdfDoc.embedPng(pngData);
    } catch (embedError) {
      console.error(`Không thể nhúng hình ảnh vào PDF: ${embedError.message}`);
      return false;
    }
    
    const pngDimensions = contentImage.size();
    
    // Tạo trang mới với kích thước của hình ảnh
    let page;
    try {
      page = pdfDoc.addPage([pngDimensions.width, pngDimensions.height]);
    } catch (addPageError) {
      console.error(`Không thể thêm trang vào PDF: ${addPageError.message}`);
      return false;
    }
    
    // Vẽ hình ảnh nội dung lên trang
    try {
      page.drawImage(contentImage, {
        x: 0,
        y: 0,
        width: pngDimensions.width,
        height: pngDimensions.height
      });
    } catch (drawError) {
      console.error(`Không thể vẽ hình ảnh lên trang PDF: ${drawError.message}`);
      return false;
    }
    
    // Kiểm tra xem ảnh đã được xử lý watermark chưa
    // Nếu tên file có chứa "_processed", không thêm logo nữa để tránh lặp logo
    const isProcessedImage = pngPath.includes('_processed');
    
    // Bây giờ thêm hình nền *SAU* nội dung (để hiển thị trên cùng)
    // Chỉ thêm nếu không phải là ảnh đã xử lý
    if (!isProcessedImage && config.backgroundImage && fs.existsSync(config.backgroundImage)) {
      try {
        console.log(`Thêm logo vào trang ${index + 1}/${totalPages}`);
        // Đọc hình nền
        const backgroundData = fs.readFileSync(config.backgroundImage);
        
        // Xác định loại file và nhúng phù hợp
        let backgroundImage;
        if (config.backgroundImage.toLowerCase().endsWith('.png')) {
          backgroundImage = await pdfDoc.embedPng(backgroundData);
        } else if (config.backgroundImage.toLowerCase().endsWith('.jpg') || 
                  config.backgroundImage.toLowerCase().endsWith('.jpeg')) {
          backgroundImage = await pdfDoc.embedJpg(backgroundData);
        } else {
          console.warn(`Định dạng hình nền không được hỗ trợ: ${config.backgroundImage}`);
          return true; // Vẫn tiếp tục mà không có hình nền
        }
        
        if (backgroundImage) {
          const bgDimensions = backgroundImage.size();
          
          // CHỈ THÊM MỘT HÌNH NỀN LỚN Ở GIỮA TRANG
          // Tính toán để hình nền chiếm khoảng 85% diện tích trang (tăng từ 70%)
          const targetWidth = pngDimensions.width * 0.85;
          const targetHeight = pngDimensions.height * 0.85;
          
          // Tính tỷ lệ phù hợp để giữ nguyên tỷ lệ hình ảnh
          const scaleWidth = targetWidth / bgDimensions.width;
          const scaleHeight = targetHeight / bgDimensions.height;
          const scale = Math.min(scaleWidth, scaleHeight);
          
          // Tính kích thước và vị trí hình nền
          const bgWidth = bgDimensions.width * scale;
          const bgHeight = bgDimensions.height * scale;
          const xOffset = (pngDimensions.width - bgWidth) / 2; // Giữa trang theo chiều ngang
          const yOffset = (pngDimensions.height - bgHeight) / 2; // Giữa trang theo chiều dọc
          
          // Vẽ một hình nền duy nhất ở giữa với độ trong suốt được cấu hình
          try {
            page.drawImage(backgroundImage, {
              x: xOffset,
              y: yOffset,
              width: bgWidth,
              height: bgHeight,
              opacity: config.backgroundOpacity || 0.15, // Mặc định 0.15 nếu không có giá trị
            });
          } catch (drawBgError) {
            console.error(`Không thể vẽ hình nền: ${drawBgError.message}`);
            // Tiếp tục mà không có hình nền
          }
        }
      } catch (backgroundError) {
        console.error(`Lỗi khi xử lý hình nền: ${backgroundError.message}`);
        // Just continue without background on error
      }
    } else if (isProcessedImage) {
      console.log(`Bỏ qua thêm logo cho trang ${index + 1}/${totalPages} vì ảnh đã được xử lý trước đó`);
    }
    
    return true;
  } catch (error) {
    console.error(`Lỗi tổng thể khi thêm hình ảnh vào PDF: ${error.message}`);
    return false;
  }
} 