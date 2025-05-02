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
    
    const output = execSync(command, { encoding: 'utf8' }).trim();
    const numPages = parseInt(output);
    
    if (!isNaN(numPages)) {
      // Lưu vào cache
      pageCountCache.set(cacheKey, numPages);
      return numPages;
    }

    // Thay vì thử nhiều phương pháp tuần tự, sử dụng Promise.any để chạy song song
    const results = await Promise.any([
      // Phương pháp thay thế 1
      (async () => {
        const altCommand = `"${gsPath}" -q -dNODISPLAY -dNOSAFER -c "(${escapedPath}) << /SubFileDecode true >> (r) file pdfdict begin pdfinitfile Trailer/Root get/Pages get/Count get == quit"`;
        const altOutput = execSync(altCommand, { encoding: 'utf8' }).trim();
        const pages = parseInt(altOutput);
        if (isNaN(pages)) throw new Error('Không thể phân tích kết quả');
        return pages;
      })(),
      
      // Phương pháp thay thế 2: pdf-lib
      (async () => {
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        return pdfDoc.getPageCount();
      })()
    ]);
    
    // Lưu kết quả vào cache
    pageCountCache.set(cacheKey, results);
    return results;
  } catch (error) {
    // Fallback - đọc trực tiếp từ file thay vì chạy nhiều lệnh
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = pdfDoc.getPageCount();
      
      // Lưu vào cache
      pageCountCache.set(cacheKey, pageCount);
      return pageCount;
    } catch {
      return 1; // Fallback cuối cùng
    }
  }
}

// Tối ưu hàm vẽ hình ảnh vào PDF
export async function addImageToPdf(pdfDoc, pngPath, index, totalPages, config) {
  if (!fs.existsSync(pngPath)) {
    return false;
  }
  
  // Đọc dữ liệu PNG - sử dụng đệm buffer lớn hơn để giảm I/O
  const pngData = fs.readFileSync(pngPath, { 
    highWaterMark: 1024 * 1024 // 1MB buffer
  });
  
  // Nhúng hình ảnh nội dung vào PDF
  const contentImage = await pdfDoc.embedPng(pngData);
  const pngDimensions = contentImage.size();
  
  // Tạo trang mới với kích thước của hình ảnh
  const page = pdfDoc.addPage([pngDimensions.width, pngDimensions.height]);
  
  // Vẽ hình ảnh nội dung lên trang
  page.drawImage(contentImage, {
    x: 0,
    y: 0,
    width: pngDimensions.width,
    height: pngDimensions.height
  });
  
  // Bây giờ thêm hình nền *SAU* nội dung (để hiển thị trên cùng)
  if (config.backgroundImage && fs.existsSync(config.backgroundImage)) {
    try {
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
        page.drawImage(backgroundImage, {
          x: xOffset,
          y: yOffset,
          width: bgWidth,
          height: bgHeight,
          opacity: config.backgroundOpacity || 0.15, // Mặc định 0.15 nếu không có giá trị
        });
      }
    } catch (backgroundError) {
      // Just continue without background on error
    }
  }
  
  return true;
} 