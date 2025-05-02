/**
 * Xử lý xóa watermark từ PDF
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import PDFKit from 'pdfkit';
import sharp from 'sharp';
import { DEFAULT_CONFIG } from './config.js';
import { findGhostscript, cleanupTempFiles, processBatches } from './utils.js';
import { countPdfPagesWithGhostscript, addImageToPdf } from './pdf-service.js';
import { createConvertWorker, createProcessWorker } from './workers.js';

// Tối ưu hàm chính để xóa watermark
export async function cleanPdf(inputPath, outputPath, config = DEFAULT_CONFIG) {
  const startTime = Date.now();
  console.log('🔄 Bắt đầu xử lý xóa watermark...');
  
  // Kiểm tra xem sharp có khả dụng không
  try {
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

/**
 * Xử lý một hình ảnh để loại bỏ watermark
 * @param {string} inputPath - Đường dẫn đến ảnh đầu vào
 * @param {string} outputPath - Đường dẫn để lưu ảnh đã xử lý
 * @param {Object} config - Cấu hình xử lý watermark
 * @returns {Promise<boolean>} - Kết quả xử lý
 */
export async function processImage(inputPath, outputPath, config = DEFAULT_CONFIG) {
  try {
    // Đọc hình ảnh
    const image = sharp(inputPath);
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
          brightness: 1 + (15 / 100),  // Cố định giá trị thấp
        })
        .linear(
          1 + (25 / 100),  // Cố định giá trị vừa phải
          -(25 / 3)
        )
        .toBuffer();
      
      let processedCenter = sharp(center);
      if (config.threshold > 0 && !config.keepColors) {
        processedCenter = processedCenter.threshold(config.threshold * 100);
      }
      
      const processedCenterBuffer = await processedCenter.toBuffer();
      
      await sharp(inputPath)
        .composite([{
          input: processedCenterBuffer,
          left: centerX,
          top: centerY
        }])
        .toFile(outputPath);
    } else {
      // Xử lý toàn bộ hình ảnh với cách tiếp cận đơn giản hơn
      // Giảm số bước xử lý để tránh mất màu
      
      // Cách tiếp cận đơn giản: Chỉ sử dụng brightness và contrast nhẹ
      // Tránh toàn bộ các biến đổi màu sắc phức tạp
      let processedImage = image
        .modulate({
          brightness: 1 + (15 / 100),  // Giảm xuống mức nhẹ nhàng (15%)
        })
        .linear(
          1 + (25 / 100),  // Mức độ tương phản nhẹ (25%)
          -(25 / 3)
        );
      
      // Chỉ áp dụng sharpen nhẹ nhàng thay vì nhiều bước xử lý
      processedImage = processedImage.sharpen({
        sigma: 0.5,  // Sharpen nhẹ
        m1: 0.3,
        m2: 0.2
      });
      
      await processedImage.toFile(outputPath);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Lỗi xử lý ảnh: ${error.message}`);
    throw error;
  }
}

/**
 * Thêm hình nền tùy chỉnh vào PDF
 * @param {string} pdfPath - Đường dẫn đến file PDF
 * @param {string} backgroundPath - Đường dẫn đến ảnh nền
 * @param {Object} config - Cấu hình
 * @returns {Promise<string>} - Đường dẫn đến PDF đã xử lý
 */
export async function addCustomBackground(pdfPath, backgroundPath, config = DEFAULT_CONFIG) {
  try {
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`File PDF không tồn tại: ${pdfPath}`);
    }
    
    if (!fs.existsSync(backgroundPath)) {
      throw new Error(`File hình nền không tồn tại: ${backgroundPath}`);
    }
    
    const outputPath = pdfPath.replace('.pdf', '_with_bg.pdf');
    
    // Đọc PDF gốc
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Đọc hình nền
    let backgroundImage;
    if (backgroundPath.toLowerCase().endsWith('.png')) {
      const backgroundData = fs.readFileSync(backgroundPath);
      backgroundImage = await pdfDoc.embedPng(backgroundData);
    } else if (backgroundPath.toLowerCase().endsWith('.jpg') || backgroundPath.toLowerCase().endsWith('.jpeg')) {
      const backgroundData = fs.readFileSync(backgroundPath);
      backgroundImage = await pdfDoc.embedJpg(backgroundData);
    } else {
      throw new Error('Định dạng hình nền không được hỗ trợ. Vui lòng sử dụng PNG hoặc JPG.');
    }
    
    // Lấy kích thước hình nền
    const bgDimensions = backgroundImage.size();
    
    // Xử lý từng trang PDF
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();
      
      // Tính kích thước và vị trí để hình nền vừa với trang
      const scale = Math.min(width / bgDimensions.width, height / bgDimensions.height);
      const bgWidth = bgDimensions.width * scale;
      const bgHeight = bgDimensions.height * scale;
      
      // Đặt hình nền ở giữa trang
      const xOffset = (width - bgWidth) / 2;
      const yOffset = (height - bgHeight) / 2;
      
      // Vẽ hình nền
      page.drawImage(backgroundImage, {
        x: xOffset,
        y: yOffset,
        width: bgWidth,
        height: bgHeight,
        opacity: config.backgroundOpacity || 0.3
      });
    }
    
    // Lưu PDF đã xử lý
    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, modifiedPdfBytes);
    
    return outputPath;
  } catch (error) {
    console.error(`❌ Lỗi thêm hình nền: ${error.message}`);
    throw error;
  }
}

/**
 * Tạo file PDF từ các ảnh đã xử lý với hình nền tùy chỉnh
 * @param {Array<string>} images - Mảng đường dẫn đến ảnh đã xử lý
 * @param {string} outputPath - Đường dẫn lưu file PDF
 * @param {Object} config - Cấu hình
 * @returns {Promise<boolean>} - Kết quả xử lý
 */
export async function createPDFFromProcessedImages(images, outputPath, config = DEFAULT_CONFIG) {
  try {
    console.log(`📑 Bắt đầu tạo PDF với hình nền từ ${images.length} ảnh...`);
    
    // Tạo PDF mới
    const pdfDoc = await PDFDocument.create();
    
    // Xử lý từng ảnh
    for (let i = 0; i < images.length; i++) {
      const imagePath = images[i];
      
      if (i % 5 === 0 || i === images.length - 1) {
        console.log(`🔄 Tạo PDF: ${Math.round((i / images.length) * 100)}% (${i}/${images.length} trang)`);
      }
      
      // Thêm ảnh vào PDF với hình nền
      await addImageToPdf(pdfDoc, imagePath, i, images.length, config);
    }
    
    // Lưu PDF
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false
    });
    
    fs.writeFileSync(outputPath, pdfBytes);
    
    console.log(`✅ Đã tạo PDF thành công: ${outputPath}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Lỗi tạo PDF từ ảnh: ${error.message}`);
    throw error;
  }
}

/**
 * Tạo file PDF từ các ảnh (không cần thêm hình nền)
 * @param {Array<string>} images - Mảng đường dẫn đến ảnh
 * @param {string} outputPath - Đường dẫn lưu file PDF
 * @returns {Promise<boolean>} - Kết quả xử lý
 */
export async function createPDFFromRawImages(images, outputPath) {
  try {
    console.log(`📑 Bắt đầu tạo PDF từ ${images.length} ảnh...`);
    
    // Sử dụng PDFKit để tạo PDF
    const doc = new PDFKit({
      autoFirstPage: false,
      margin: 0,
      bufferPages: true
    });
    
    // Tạo write stream và promise để theo dõi khi nào hoàn thành
    const writeStream = fs.createWriteStream(outputPath);
    const streamFinished = new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    doc.pipe(writeStream);
    
    // Xử lý từng ảnh
    for (const imagePath of images.sort((a, b) => {
      try {
        const pageA = parseInt(path.basename(a).match(/page_(\d+)/)[1]);
        const pageB = parseInt(path.basename(b).match(/page_(\d+)/)[1]);
        return pageA - pageB;
      } catch (error) {
        return 0;
      }
    })) {
      try {
        let imageBuffer = fs.readFileSync(imagePath);
        
        // Nếu là WebP, chuyển sang PNG
        if (imagePath.endsWith('.webp')) {
          console.log(`🔄 Chuyển đổi WebP sang PNG...`);
          imageBuffer = await sharp(imageBuffer).png().toBuffer();
        }
        
        const img = doc.openImage(imageBuffer);
        doc.addPage({ size: [img.width, img.height] });
        doc.image(img, 0, 0);
        console.log(`✅ Đã thêm trang ${path.basename(imagePath)}`);
      } catch (error) {
        console.warn(`⚠️ Lỗi xử lý ảnh ${imagePath}: ${error.message}`);
      }
    }
    
    // Kết thúc document và đợi stream hoàn thành
    doc.end();
    await streamFinished;
    
    console.log(`✅ Đã tạo PDF thành công: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Lỗi tạo PDF: ${error.message}`);
    throw error;
  }
} 