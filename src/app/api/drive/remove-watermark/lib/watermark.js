/**
 * Xử lý xóa watermark từ PDF
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import { DEFAULT_CONFIG } from './config';
import { findGhostscript, cleanupTempFiles, processBatches } from './utils';
import { countPdfPagesWithGhostscript, addImageToPdf } from './pdf-service';
import { createConvertWorker, createProcessWorker } from './workers';

// Tối ưu hàm chính để xóa watermark
export async function cleanPdf(inputPath, outputPath, config = DEFAULT_CONFIG) {
  const startTime = Date.now();
  console.log('🔄 Bắt đầu xử lý xóa watermark...');
  
  // Kiểm tra xem sharp có khả dụng không
  let sharp;
  try {
    sharp = require('sharp');
    
    if (process.env.NODE_ENV === 'production') {
      // Các cấu hình cho môi trường production nếu cần
    }
  } catch (error) {
    throw new Error('Thư viện xử lý hình ảnh (Sharp) không khả dụng trên máy chủ này. Vui lòng liên hệ quản trị viên.');
  }
  
  // Tìm GhostScript một lần và cache kết quả
  let gsPath;
  try {
    gsPath = findGhostscript();
  } catch (gsError) {
    throw gsError;
  }

  if (!inputPath) {
    throw new Error('Không có đường dẫn file đầu vào');
  }
  
  outputPath = outputPath || inputPath.replace('.pdf', '_clean.pdf');
  
  if (!fs.existsSync(inputPath)) {
    throw new Error(`File không tồn tại: ${inputPath}`);
  }
  
  // Kiểm tra kích thước file
  const stats = fs.statSync(inputPath);
  const fileSizeInMB = stats.size / (1024 * 1024);
  
  // Tạo thư mục temp hiệu quả hơn
  const tempDir = path.join(os.tmpdir(), `pdf-watermark-removal-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  try {
    // Đếm số trang với cache
    console.log('🔍 Đang phân tích số trang của PDF...');
    const numPages = await countPdfPagesWithGhostscript(inputPath, gsPath);
    console.log(`📄 Phát hiện ${numPages} trang, đang tách PDF...`);
    
    // Tối ưu biến cho số lượng công nhân
    const optimalWorkers = Math.min(
      config.maxWorkers,
      Math.max(1, Math.min(os.cpus().length - 1, numPages))
    );
    
    // Tách PDF thành từng trang - sử dụng tùy chọn tối ưu cho GhostScript
    const gsCommand = `"${gsPath}" -dALLOWPSTRANSPARENCY -dBATCH -dNOPAUSE -q -dNumRenderingThreads=${optimalWorkers} -sDEVICE=pdfwrite -dSAFER ` +
            `-dFirstPage=1 -dLastPage=${numPages} ` +
            `-sOutputFile="${path.join(tempDir, 'page_%d.pdf')}" "${inputPath}"`;
    
    execSync(gsCommand, { stdio: 'pipe' });
    
    // Kiểm tra kết quả nhanh hơn bằng cách dựa vào readdir và lọc
    const pdfFiles = fs.readdirSync(tempDir, { 
      withFileTypes: true 
    })
    .filter(entry => entry.isFile() && entry.name.endsWith('.pdf'))
    .map(entry => entry.name);
    
    if (pdfFiles.length === 0) {
      throw new Error('Không thể tách PDF thành các trang. GhostScript không tạo ra file nào.');
    }
    
    // Chuẩn bị danh sách công việc hiệu quả hơn
    const conversionTasks = [];
    
    // Sử dụng cách tối ưu hơn để tạo nhiệm vụ
    for (let page = 1; page <= numPages; page++) {
      const pdfPath = path.join(tempDir, `page_${page}.pdf`);
      if (fs.existsSync(pdfPath)) {
        conversionTasks.push({
          pdfPath,
          pngPath: path.join(tempDir, `page_${page}.png`),
          page
        });
      }
    }

    if (conversionTasks.length === 0) {
      throw new Error('Không có trang PDF nào để chuyển đổi!');
    }

    // Chuyển đổi PDF sang PNG theo batch nhỏ, không phải song song toàn bộ
    console.log('🔄 Bước 1/3: Chuyển đổi PDF sang hình ảnh...');
    const batchSize = config.batchSize || 3; // Xử lý tối đa 3 trang cùng lúc để tránh tràn bộ nhớ
    
    // Chia trang thành các batch nhỏ hơn để xử lý
    const convertResults = [];
    for (let i = 0; i < conversionTasks.length; i += batchSize) {
      const currentBatch = conversionTasks.slice(i, i + batchSize);
      const progress = Math.round((i / conversionTasks.length) * 100);
      console.log(`🔄 Chuyển đổi PDF sang hình ảnh: ${progress}% (${i}/${conversionTasks.length} trang)`);
      
      // Xử lý batch hiện tại
      const batchPromises = currentBatch.map(task => 
        createConvertWorker(gsPath, task.pdfPath, task.pngPath, task.page, numPages, config.dpi)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      convertResults.push(...batchResults);
      
      // Thúc đẩy GC sau mỗi batch
      global.gc && global.gc();
      
      // Tạm dừng để cho GC có cơ hội chạy và giải phóng bộ nhớ
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log(`🔄 Chuyển đổi PDF sang hình ảnh: 100% (${conversionTasks.length}/${conversionTasks.length} trang)`);
    
    // Lọc và giải phóng bộ nhớ sớm hơn
    const successfulConversions = convertResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    if (successfulConversions.length === 0) {
      throw new Error('Không có trang nào được chuyển đổi thành công!');
    }
    
    // Xử lý các PNG theo từng batch nhỏ
    console.log('🔄 Bước 2/3: Xử lý xóa watermark trên hình ảnh...');
    const processResults = [];
    
    for (let i = 0; i < successfulConversions.length; i += batchSize) {
      const currentBatch = successfulConversions.slice(i, i + batchSize);
      const progress = Math.round((i / successfulConversions.length) * 100);
      console.log(`🔄 Xử lý xóa watermark: ${progress}% (${i}/${successfulConversions.length} trang)`);
      
      // Xử lý batch hiện tại
      const batchPromises = currentBatch.map(conversion => 
        createProcessWorker(conversion.pngPath, conversion.page, numPages, config)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      processResults.push(...batchResults);
      
      // Thúc đẩy GC sau mỗi batch
      global.gc && global.gc();
      
      // Tạm dừng để cho GC có cơ hội chạy và giải phóng bộ nhớ
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log(`🔄 Xử lý xóa watermark: 100% (${successfulConversions.length}/${successfulConversions.length} trang)`);
    
    // Lọc và sắp xếp hiệu quả hơn
    const successfulProcessing = processResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .sort((a, b) => a.index - b.index);
    
    // Lấy danh sách đường dẫn PNG đã xử lý
    const processedPngPaths = successfulProcessing.map(result => result.processedPngPath);
    
    if (processedPngPaths.length === 0) {
      throw new Error('Không có trang nào được xử lý thành công!');
    }
    
    // Ghép các trang PNG thành PDF hiệu quả hơn
    console.log('🔄 Bước 3/3: Ghép các trang thành PDF kết quả...');
    
    // Tạo PDF hiệu quả hơn
    const pdfDoc = await PDFDocument.create();
    
    // Xử lý từng trang một để tránh tràn bộ nhớ - thay vì song song
    for (let i = 0; i < processedPngPaths.length; i++) {
      const progress = Math.round((i / processedPngPaths.length) * 100);
      if (i % 5 === 0 || i === processedPngPaths.length - 1) { // Log every 5 pages to reduce output
        console.log(`🔄 Tạo PDF: ${progress}% (${i}/${processedPngPaths.length} trang)`);
      }
      
      await addImageToPdf(pdfDoc, processedPngPaths[i], i, processedPngPaths.length, config);
      
      // Xóa file PNG đã xử lý để giải phóng bộ nhớ
      try {
        fs.unlinkSync(processedPngPaths[i]);
        fs.unlinkSync(processedPngPaths[i].replace('_processed.png', '.png'));
      } catch (error) {
        // Ignore error
      }
      
      // Thúc đẩy GC sau mỗi trang
      global.gc && global.gc();
    }
    
    // Lưu PDF với tùy chọn nén tối ưu
    console.log('💾 Lưu file PDF kết quả...');
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false
    });
    
    fs.writeFileSync(outputPath, pdfBytes);
    
    // Dọn dẹp file tạm ngay khi có thể để tiết kiệm bộ nhớ
    if (config.cleanupTempFiles) {
      cleanupTempFiles(tempDir);
    }
    
    // Sau khi hoàn thành
    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`✅ Hoàn thành xử lý trong ${processingTime} giây`);
    
    return { 
      success: true, 
      outputPath, 
      processingTime,
      originalSize: fileSizeInMB.toFixed(2) + ' MB',
      processedSize: fs.existsSync(outputPath) ? (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown'
    };
  } catch (error) {
    console.log(`❌ Lỗi: ${error.message}`);
    
    // Dọn dẹp file tạm
    try {
      cleanupTempFiles(tempDir);
    } catch (cleanupError) {
      // Ignore error
    }
    
    throw error;
  }
} 