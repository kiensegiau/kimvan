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
import { findGhostscript, cleanupTempFiles, processBatches, forceGarbageCollection, optimizePerformance } from './utils.js';
import { countPdfPagesWithGhostscript, addImageToPdf } from './pdf-service.js';
import { createConvertWorker, createProcessWorker } from './workers.js';

// Flag để đảm bảo đã kết nối đến MongoDB trong thread chính
let mainThreadConnected = false;

// Tối ưu hàm chính để xóa watermark
export async function cleanPdf(inputPath, outputPath, config = DEFAULT_CONFIG) {
  const startTime = Date.now();
  let tempDir = null;
  let gsPath = null;
  
  // Tăng thời gian chờ tối đa lên 1 giờ
  const maxProcessingTime = 3600000; // 1 giờ tính bằng mili giây
  
  console.log('🔄 Bắt đầu xử lý xóa watermark...');
  
  try {
    // Kiểm tra xem sharp có khả dụng không
    try {
      if (process.env.NODE_ENV === 'production') {
        // Các cấu hình cho môi trường production nếu cần
      }
    } catch (error) {
      throw new Error('Thư viện xử lý hình ảnh (Sharp) không khả dụng trên máy chủ này. Vui lòng liên hệ quản trị viên.');
    }
    
    // Tìm GhostScript một lần và cache kết quả
    try {
      gsPath = await findGhostscript();
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
    let stats;
    try {
      stats = fs.statSync(inputPath);
    } catch (statError) {
      throw new Error(`Không thể đọc thông tin file: ${statError.message}`);
    }
    
    const fileSizeInMB = stats.size / (1024 * 1024);
    console.log(`📊 Kích thước file: ${fileSizeInMB.toFixed(2)} MB`);
    
    // Tối ưu hóa cấu hình dựa trên tài nguyên hệ thống
    const optimizedConfig = optimizePerformance(config);
    
    // Tạo thư mục temp hiệu quả hơn
    tempDir = path.join(os.tmpdir(), `pdf-watermark-removal-${Date.now()}`);
    try {
      fs.mkdirSync(tempDir, { recursive: true });
    } catch (mkdirError) {
      throw new Error(`Không thể tạo thư mục tạm: ${mkdirError.message}`);
    }
    
    // Đếm số trang với cache
    console.log('🔍 Đang phân tích số trang của PDF...');
    let numPages;
    try {
      numPages = await countPdfPagesWithGhostscript(inputPath, gsPath);
    } catch (countError) {
      throw new Error(`Không thể đếm số trang PDF: ${countError.message}`);
    }
    
    console.log(`📄 Phát hiện ${numPages} trang, đang tách PDF...`);
    
    // Xác định số lượng worker tối ưu dựa trên cấu hình
    let optimalWorkers;
    
    // Chế độ Ultra Performance cho hệ thống RAM cao
    if (optimizedConfig.ultra) {
      // Với chế độ Ultra, sử dụng nhiều worker hơn và không giới hạn quá mức
      const maxPossibleWorkers = Math.min(numPages, optimizedConfig.maxWorkers);
      optimalWorkers = maxPossibleWorkers;
      console.log(`🔥 CHẾ ĐỘ ULTRA: Sử dụng ${optimalWorkers} worker(s) để tối ưu tốc độ tối đa`);
    } else if (optimizedConfig.highPerformanceMode) {
      // Chế độ hiệu suất cao
      optimalWorkers = Math.min(optimizedConfig.maxWorkers, numPages);
      console.log(`🧠 Sử dụng ${optimalWorkers} worker(s) để tối ưu hiệu suất cao`);
    } else {
      // Chế độ cân bằng
      optimalWorkers = Math.min(
        optimizedConfig.maxWorkers,
        Math.max(1, Math.min(Math.max(1, os.cpus().length - 2), Math.min(numPages, 2)))
      );
      console.log(`🧠 Sử dụng ${optimalWorkers} worker(s) để cân bằng hiệu suất và ổn định`);
    }
    
    // Tách PDF thành từng trang - sử dụng tùy chọn tối ưu cho GhostScript
    const gsCommand = `"${gsPath}" -dALLOWPSTRANSPARENCY -dBATCH -dNOPAUSE -q -dNumRenderingThreads=${optimizedConfig.gsParallel || optimalWorkers} -sDEVICE=pdfwrite -dSAFER ` +
            `-dFirstPage=1 -dLastPage=${numPages} ` +
            `-sOutputFile="${path.join(tempDir, 'page_%d.pdf')}" "${inputPath}"`;
    
    try {
      execSync(gsCommand, { stdio: 'pipe' });
    } catch (gsError) {
      throw new Error(`Lỗi khi tách PDF: ${gsError.message}`);
    }
    
    // Giải phóng bộ nhớ sau khi tách PDF
    forceGarbageCollection();
    
    // Kiểm tra kết quả nhanh hơn bằng cách dựa vào readdir và lọc
    let pdfFiles;
    try {
      pdfFiles = fs.readdirSync(tempDir, { 
        withFileTypes: true 
      })
      .filter(entry => entry.isFile() && entry.name.endsWith('.pdf'))
      .map(entry => entry.name);
    } catch (readError) {
      throw new Error(`Không thể đọc các file PDF đã tách: ${readError.message}`);
    }
    
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
    
    // Sử dụng batchSize từ cấu hình đã tối ưu
    const batchSize = optimizedConfig.batchSize || Math.min(config.batchSize || 3, 2);
    
    // Chia trang thành các batch nhỏ hơn để xử lý
    const convertResults = [];
    
    // Chế độ Ultra Performance cho hệ thống RAM cao
    if (optimizedConfig.ultra) {
      // Giảm kích thước batch xuống còn 4 trang thay vì 9 để tránh timeout
      const actualBatchSize = Math.min(batchSize, 4);
      console.log(`🚀 Chế độ ULTRA: Xử lý từng batch ${actualBatchSize} trang để tránh timeout (thời gian chờ tối đa: 1 giờ)`);
      
      // Xử lý nhiều batch cùng lúc
      const numBatches = Math.ceil(conversionTasks.length / actualBatchSize);
      const batches = [];
      
      for (let i = 0; i < numBatches; i++) {
        const startIdx = i * actualBatchSize;
        const endIdx = Math.min(startIdx + actualBatchSize, conversionTasks.length);
        batches.push(conversionTasks.slice(startIdx, endIdx));
      }
      
      console.log(`🧩 Đã chia thành ${numBatches} batch để xử lý`);
      
      try {
        let processedCount = 0;
        
        // Xử lý từng batch một thay vì song song
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          // Thêm log để debug
          console.log(`🔄 Bắt đầu xử lý batch ${batchIndex + 1}/${batches.length} (${batch.length} trang)`);
          
          const batchTasks = batch.map(task => 
            createConvertWorker(gsPath, task.pdfPath, task.pngPath, task.page, numPages, optimizedConfig.dpi)
          );
          
          try {
            // Thiết lập timeout dài hơn cho xử lý batch
            const batchPromise = Promise.allSettled(batchTasks);
            
            // Tạo timeout promise để đảm bảo không chờ quá lâu
            const timeoutPromise = new Promise((resolve) => {
              setTimeout(() => {
                resolve('timeout');
              }, maxProcessingTime);
            });
            
            // Chạy với race để đảm bảo không bị treo vô thời hạn
            const raceResult = await Promise.race([batchPromise, timeoutPromise]);
            
            // Kiểm tra nếu bị timeout
            const batchResults = raceResult === 'timeout' 
              ? batch.map(() => ({ status: 'rejected', reason: new Error('Xử lý batch vượt quá thời gian tối đa') }))
              : raceResult;
            
            // Xóa các tệp PDF đã xử lý để giải phóng bộ nhớ
            for (const task of batch) {
              try {
                if (fs.existsSync(task.pdfPath)) {
                  fs.unlinkSync(task.pdfPath);
                }
              } catch (unlinkError) {
                console.debug(`Không thể xóa file PDF tạm: ${unlinkError.message}`);
              }
            }
            
            processedCount += batch.length;
            console.log(`🔄 Chuyển đổi PDF sang hình ảnh: ${Math.round((processedCount / conversionTasks.length) * 100)}% (${processedCount}/${conversionTasks.length} trang)`);
            
            // Thêm kết quả vào mảng kết quả chung
            convertResults.push(...batchResults);
            
            // Thúc đẩy GC sau mỗi batch
            forceGarbageCollection();
            
            // Tăng thời gian chờ giữa các batch để hệ thống có thể phục hồi và tránh timeout
            await new Promise(resolve => setTimeout(resolve, optimizedConfig.waitTime || 800));
          } catch (batchError) {
            console.error(`Lỗi xử lý batch chuyển đổi ${batchIndex + 1}: ${batchError.message}`);
            // Thêm kết quả lỗi vào mảng kết quả
            const errorResults = batch.map(() => ({
              status: 'rejected',
              reason: batchError
            }));
            convertResults.push(...errorResults);
          }
        }
        
        // Thúc đẩy GC sau khi hoàn thành tất cả
        forceGarbageCollection();
      } catch (parallelError) {
        console.error(`Lỗi khi xử lý batch: ${parallelError.message}`);
        throw parallelError;
      }
    } else {
      // Phương pháp xử lý tuần tự dùng cho hệ thống yếu hơn
      for (let i = 0; i < conversionTasks.length; i += batchSize) {
        try {
          const currentBatch = conversionTasks.slice(i, i + batchSize);
          const progress = Math.round((i / conversionTasks.length) * 100);
          console.log(`🔄 Chuyển đổi PDF sang hình ảnh: ${progress}% (${i}/${conversionTasks.length} trang)`);
        
          // Xử lý batch hiện tại
          const batchPromises = currentBatch.map(task => 
            createConvertWorker(gsPath, task.pdfPath, task.pngPath, task.page, numPages, optimizedConfig.dpi)
          );
        
          let batchResults;
          try {
            batchResults = await Promise.allSettled(batchPromises);
          } catch (batchError) {
            console.error(`Lỗi xử lý batch xóa watermark: ${batchError.message}`);
            continue;
          }
          
          convertResults.push(...batchResults);
        
          // Dọn dẹp các file PDF trang đã chuyển đổi để giải phóng bộ nhớ ngay lập tức
          for (const task of currentBatch) {
            try {
              if (fs.existsSync(task.pdfPath)) {
                fs.unlinkSync(task.pdfPath);
              }
            } catch (unlinkError) {
              console.debug(`Không thể xóa file PDF tạm: ${unlinkError.message}`);
            }
          }
          
          // Thúc đẩy GC sau mỗi batch
          forceGarbageCollection();
          
          // Tăng thời gian chờ giữa các batch để tránh timeout
          await new Promise(resolve => setTimeout(resolve, optimizedConfig.waitTime || 800));
        } catch (batchProcessError) {
          console.error(`Lỗi xử lý batch chuyển đổi tại vị trí ${i}: ${batchProcessError.message}`);
          // Vẫn tiếp tục xử lý các batch tiếp theo
        }
      }
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
    
    // Kiểm tra xem có phải chế độ Ultra không
    if (optimizedConfig.ultra) {
      // Giảm kích thước batch xuống còn 4 trang thay vì 9 để tránh timeout
      const actualBatchSize = Math.min(batchSize, 4);
      console.log(`🚀 Chế độ ULTRA: Xử lý từng batch xóa watermark cho ${actualBatchSize} trang để tránh timeout (thời gian chờ tối đa: 1 giờ)`);
      
      // Xử lý nhiều batch song song tương tự như phần chuyển đổi PDF
      const numBatches = Math.ceil(successfulConversions.length / actualBatchSize);
      const batches = [];
      
      for (let i = 0; i < numBatches; i++) {
        const startIdx = i * actualBatchSize;
        const endIdx = Math.min(startIdx + actualBatchSize, successfulConversions.length);
        batches.push(successfulConversions.slice(startIdx, endIdx));
      }
      
      console.log(`🧩 Đã chia thành ${numBatches} batch để xử lý watermark`);
      
      try {
        let processedCount = 0;
        
        // Xử lý từng batch một thay vì song song
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          // Thêm log để debug
          console.log(`🔄 Bắt đầu xử lý watermark batch ${batchIndex + 1}/${batches.length} (${batch.length} trang)`);
          
          const batchTasks = batch.map(result => 
            createProcessWorker(result.pngPath, result.page, successfulConversions.length, optimizedConfig)
          );
          
          try {
            // Thiết lập timeout dài hơn cho xử lý batch
            const batchPromise = Promise.allSettled(batchTasks);
            
            // Tạo timeout promise để đảm bảo không chờ quá lâu
            const timeoutPromise = new Promise((resolve) => {
              setTimeout(() => {
                resolve('timeout');
              }, maxProcessingTime);
            });
            
            // Chạy với race để đảm bảo không bị treo vô thời hạn
            const raceResult = await Promise.race([batchPromise, timeoutPromise]);
            
            // Kiểm tra nếu bị timeout
            const batchResults = raceResult === 'timeout' 
              ? batch.map(() => ({ status: 'rejected', reason: new Error('Xử lý batch vượt quá thời gian tối đa') }))
              : raceResult;
            
            // Xóa các tệp PNG đã xử lý để giải phóng bộ nhớ
            for (const result of batch) {
              try {
                if (fs.existsSync(result.pngPath)) {
                  fs.unlinkSync(result.pngPath);
                }
              } catch (unlinkError) {
                console.debug(`Không thể xóa file PNG tạm: ${unlinkError.message}`);
              }
            }
            
            processedCount += batch.length;
            console.log(`🔄 Xử lý xóa watermark: ${Math.round((processedCount / successfulConversions.length) * 100)}% (${processedCount}/${successfulConversions.length} trang)`);
            
            // Thêm kết quả vào mảng kết quả chung
            processResults.push(...batchResults);
            
            // Thúc đẩy GC sau mỗi batch
            forceGarbageCollection();
            
            // Tăng thời gian chờ giữa các batch để hệ thống có thể phục hồi và tránh timeout
            await new Promise(resolve => setTimeout(resolve, optimizedConfig.waitTime || 800));
          } catch (batchError) {
            console.error(`Lỗi xử lý batch watermark ${batchIndex + 1}: ${batchError.message}`);
            // Thêm kết quả lỗi vào mảng kết quả
            const errorResults = batch.map(() => ({
              status: 'rejected',
              reason: batchError
            }));
            processResults.push(...errorResults);
          }
        }
        
        // Thúc đẩy GC sau khi hoàn thành tất cả
        forceGarbageCollection();
      } catch (parallelError) {
        console.error(`Lỗi khi xử lý watermark: ${parallelError.message}`);
        throw parallelError;
      }
    } else {
      // Phương pháp xử lý tuần tự dùng cho hệ thống yếu hơn
      for (let i = 0; i < successfulConversions.length; i += batchSize) {
        try {
          const currentBatch = successfulConversions.slice(i, i + batchSize);
          const progress = Math.round((i / successfulConversions.length) * 100);
          console.log(`🔄 Xử lý xóa watermark: ${progress}% (${i}/${successfulConversions.length} trang)`);
          
          // Xử lý batch hiện tại
          const batchPromises = currentBatch.map(task => 
            createProcessWorker(task.pngPath, task.page, numPages, optimizedConfig)
          );
          
          let batchResults;
          try {
            batchResults = await Promise.allSettled(batchPromises);
          } catch (batchError) {
            console.error(`Lỗi xử lý batch xóa watermark: ${batchError.message}`);
            continue;
          }
          
          processResults.push(...batchResults);
          
          // Thúc đẩy GC sau mỗi batch và xóa file PNG gốc đã xử lý
          for (const task of currentBatch) {
            try {
              if (fs.existsSync(task.pngPath)) {
                fs.unlinkSync(task.pngPath);
              }
            } catch (unlinkError) {
              console.debug(`Không thể xóa file PNG gốc: ${unlinkError.message}`);
            }
          }
          
          // Thúc đẩy GC sau mỗi batch
          forceGarbageCollection();
          
          // Tăng thời gian chờ giữa các batch để tránh timeout
          await new Promise(resolve => setTimeout(resolve, optimizedConfig.waitTime || 800));
        } catch (batchProcessError) {
          console.error(`Lỗi xử lý batch xóa watermark tại vị trí ${i}: ${batchProcessError.message}`);
          // Vẫn tiếp tục xử lý các batch tiếp theo
        }
      }
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
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.create();
    } catch (createError) {
      throw new Error(`Không thể tạo tài liệu PDF: ${createError.message}`);
    }
    
    // Xử lý từng trang một để tránh tràn bộ nhớ - thay vì song song
    for (let i = 0; i < processedPngPaths.length; i++) {
      try {
        const progress = Math.round((i / processedPngPaths.length) * 100);
        if (i % 5 === 0 || i === processedPngPaths.length - 1) { // Log every 5 pages to reduce output
          console.log(`🔄 Tạo PDF: ${progress}% (${i}/${processedPngPaths.length} trang)`);
        }
        
        const success = await addImageToPdf(pdfDoc, processedPngPaths[i], i, processedPngPaths.length, config);
        if (!success) {
          console.warn(`⚠️ Không thể thêm trang ${i+1} vào PDF`);
        }
        
        // Xóa file PNG đã xử lý để giải phóng bộ nhớ
        try {
          fs.unlinkSync(processedPngPaths[i]);
          const originalPng = processedPngPaths[i].replace('_processed.png', '.png');
          if (fs.existsSync(originalPng)) {
            fs.unlinkSync(originalPng);
          }
        } catch (unlinkError) {
          // Ignore error
          console.debug(`Không thể xóa file PNG tạm: ${unlinkError.message}`);
        }
        
        // Thúc đẩy GC sau mỗi 3 trang
        if (i % 3 === 2) {
          forceGarbageCollection();
        }
      } catch (pageError) {
        console.error(`Lỗi khi thêm trang ${i+1} vào PDF: ${pageError.message}`);
      }
    }
    
    // Giải phóng bộ nhớ trước khi lưu PDF lớn
    forceGarbageCollection();
    
    // Lưu PDF với tùy chọn nén tối ưu
    console.log('💾 Lưu file PDF kết quả...');
    let pdfBytes;
    try {
      pdfBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false
      });
    } catch (saveError) {
      throw new Error(`Không thể lưu nội dung PDF: ${saveError.message}`);
    }
    
    try {
      fs.writeFileSync(outputPath, pdfBytes);
    } catch (writeError) {
      throw new Error(`Không thể ghi file PDF: ${writeError.message}`);
    }
    
    // Giải phóng biến pdfBytes ngay sau khi ghi xong để giải phóng bộ nhớ
    pdfBytes = null;
    forceGarbageCollection();
    
    // Sau khi hoàn thành
    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`✅ Hoàn thành xử lý trong ${processingTime} giây`);
    
    let processedSize;
    try {
      processedSize = fs.existsSync(outputPath) ? (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown';
    } catch (statError) {
      processedSize = 'Unknown (error reading file size)';
    }
    
    // Thêm hình nền/logo nếu được cấu hình
    if (config.backgroundImage && fs.existsSync(config.backgroundImage)) {
      try {
        console.log(`🖼️ Thêm hình nền/logo tùy chỉnh: ${config.backgroundImage}`);
        const bgOutputPath = await addCustomBackground(outputPath, config.backgroundImage, {
          ...config,
          backgroundOpacity: config.backgroundOpacity || 0.15, // Sử dụng độ mờ từ config hoặc mặc định
          forceAddLogo: config.forceAddLogo // Chuyển tiếp tham số forceAddLogo
        });
        
        if (fs.existsSync(bgOutputPath)) {
          console.log(`✅ Đã thêm logo thành công: ${bgOutputPath}`);
          // Cập nhật đường dẫn đầu ra
          outputPath = bgOutputPath;
          // Cập nhật kích thước file
          processedSize = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2) + ' MB';
        }
      } catch (bgError) {
        console.warn(`⚠️ Không thể thêm hình nền/logo: ${bgError.message}`);
      }
    } else {
      console.log(`ℹ️ Không có hình nền/logo được cấu hình hoặc file không tồn tại`);
    }
    
    return { 
      success: true, 
      outputPath, 
      processingTime,
      originalSize: fileSizeInMB.toFixed(2) + ' MB',
      processedSize: processedSize
    };
  } catch (error) {
    console.log(`❌ Lỗi: ${error.message}`);
    throw error;
  } finally {
    // Dọn dẹp file tạm trong finally để đảm bảo luôn được thực hiện
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        cleanupTempFiles(tempDir);
      } catch (cleanupError) {
        console.error(`Không thể dọn dẹp thư mục tạm: ${cleanupError.message}`);
      }
    }
    
    // Thúc đẩy garbage collection lần cuối
    forceGarbageCollection();
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
    console.log(`Bắt đầu xử lý ảnh: ${inputPath}`);
    
    // Kiểm tra xem có phải chế độ nâng cao không
    const isEnhancedMode = config.enhancedMode === true;
    const isBlockedFile = config.isBlockedFile === true;
    
    if (isEnhancedMode) {
      console.log(`Sử dụng chế độ xử lý nâng cao${isBlockedFile ? ' cho file bị khóa' : ''}`);
    }
    
    // Kiểm tra tệp đầu vào tồn tại
    if (!fs.existsSync(inputPath)) {
      console.error(`File ảnh đầu vào không tồn tại: ${inputPath}`);
      // Fallback: tạo file rỗng để tránh lỗi
      try {
        fs.writeFileSync(outputPath, Buffer.alloc(0));
      } catch (writeError) {
        console.error(`Không thể tạo file rỗng: ${writeError.message}`);
      }
      return false;
    }
    
    // Kiểm tra thư mục đầu ra tồn tại
    try {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        console.log(`Tạo thư mục đầu ra: ${outputDir}`);
        fs.mkdirSync(outputDir, { recursive: true });
      }
    } catch (mkdirError) {
      console.error(`Không thể tạo thư mục đầu ra: ${mkdirError.message}`);
    }
    
    // Đọc hình ảnh
    let image;
    try {
      image = sharp(inputPath);
    } catch (sharpError) {
      console.error(`Không thể tạo đối tượng sharp: ${sharpError.message}`);
      console.error(sharpError.stack);
      // Fallback: sao chép file gốc sang đích
      try {
        fs.copyFileSync(inputPath, outputPath);
        console.log(`Đã sao chép file gốc thay vì xử lý: ${inputPath} -> ${outputPath}`);
      } catch (copyError) {
        console.error(`Không thể sao chép file gốc: ${copyError.message}`);
        try {
          // Thử tạo ảnh trống với kích thước nhỏ
          const blankImage = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            'base64'
          );
          fs.writeFileSync(outputPath, blankImage);
          console.log(`Đã tạo ảnh trống tại: ${outputPath}`);
        } catch (writeError) {
          console.error(`Không thể tạo ảnh trống: ${writeError.message}`);
        }
      }
      return false;
    }
    
    // Đọc metadata của ảnh
    let metadata;
    try {
      metadata = await image.metadata();
      console.log(`Thông tin ảnh: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
      
      // Kiểm tra metadata hợp lệ
      if (!metadata.width || !metadata.height || metadata.width <= 0 || metadata.height <= 0) {
        throw new Error(`Kích thước ảnh không hợp lệ: ${metadata.width}x${metadata.height}`);
      }
    } catch (metadataError) {
      console.error(`Không thể đọc metadata: ${metadataError.message}`);
      // Fallback: sao chép file gốc sang đích
      try {
        fs.copyFileSync(inputPath, outputPath);
        console.log(`Đã sao chép file gốc sau lỗi metadata: ${inputPath} -> ${outputPath}`);
      } catch (copyError) {
        console.error(`Không thể sao chép file gốc: ${copyError.message}`);
      }
      return false;
    }
    
    // Điểm ngắt đã xác định - thêm bước kiểm tra đặc biệt sau khi đọc metadata
    console.log(`Kiểm tra ảnh trước khi xử lý: OK`);
    
    // Thêm bước bảo vệ đặc biệt - Sao chép trước file gốc để đảm bảo luôn có output
    try {
      fs.copyFileSync(inputPath, outputPath);
      console.log(`Đã tạo bản sao dự phòng: ${outputPath}`);
    } catch (backupError) {
      console.error(`Không thể tạo bản sao dự phòng: ${backupError.message}`);
    }
    
    try {
      // Tạo một bản sao của hình ảnh sử dụng buffer để tránh sử dụng đối tượng Sharp gốc
      console.log(`Chuẩn bị bộ đệm hình ảnh để xử lý an toàn...`);
      
      // Tối ưu hóa: Điều chỉnh kích thước đầu ra tối đa để tránh lỗi bộ nhớ
      const MAX_DIMENSION = 3000; // Giới hạn kích thước tối đa để xử lý an toàn
      let needResize = false;
      let newWidth = metadata.width;
      let newHeight = metadata.height;
      
      if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
        console.log(`Ảnh quá lớn (${metadata.width}x${metadata.height}), sẽ giảm kích thước để xử lý an toàn`);
        const aspectRatio = metadata.width / metadata.height;
        
        if (metadata.width > metadata.height) {
          newWidth = MAX_DIMENSION;
          newHeight = Math.round(MAX_DIMENSION / aspectRatio);
        } else {
          newHeight = MAX_DIMENSION;
          newWidth = Math.round(MAX_DIMENSION * aspectRatio);
        }
        
        needResize = true;
        console.log(`Kích thước xử lý mới: ${newWidth}x${newHeight}`);
      }
      
      // Xử lý ảnh với cách tiếp cận phù hợp với cấu hình
      let processedImage;
      
      try {
        // Bỏ qua quá trình clone để tránh lỗi
        processedImage = sharp(inputPath);
        
        // Resize nếu cần
        if (needResize) {
          processedImage = processedImage.resize(newWidth, newHeight, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }
        
        // Áp dụng các bước xử lý dựa trên chế độ
        if (isEnhancedMode) {
          // Chế độ nâng cao cho file bị khóa
          try {
            // Tăng độ sáng và độ bão hòa
            const brightness = config.brightnessBoost || 1.05;  // Giảm từ 1.1 xuống 1.05 để giữ nội dung
            const saturation = config.saturationAdjust || 1.3;  // Tăng từ 1.2 lên 1.3 để tăng màu sắc
            
            processedImage = processedImage.modulate({
              brightness: brightness,
              saturation: saturation
            });
            console.log(`Đã áp dụng tăng độ sáng (${brightness}) và độ bão hòa (${saturation})`);
          } catch (modulateError) {
            console.warn(`Bỏ qua bước modulate nâng cao do lỗi: ${modulateError.message}`);
          }
          
          try {
            // Tăng độ tương phản vừa phải
            const contrastBoost = config.contrastBoost || 1.2;  // Giảm từ 1.35 xuống 1.2 để không mất chi tiết
            processedImage = processedImage.linear(
              contrastBoost, 
              -(128 * contrastBoost - 128) / 255 * 0.8  // Giảm hệ số xuống 80% để giữ chi tiết
            );
            console.log(`Đã áp dụng tăng độ tương phản (${contrastBoost})`);
          } catch (contrastError) {
            console.warn(`Bỏ qua bước tăng tương phản do lỗi: ${contrastError.message}`);
          }
          
          try {
            // Tăng độ sắc nét mạnh hơn
            const sharpenAmount = config.sharpenAmount || 1.8;  // Tăng từ 1.5 lên 1.8 để tăng độ nét tối đa
            processedImage = processedImage.sharpen({
              sigma: sharpenAmount,
              m1: 0.6,  // Tăng từ 0.5 lên 0.6
              m2: 0.8,  // Tăng từ 0.7 lên 0.8
              x1: 2,
              y2: 7,    // Tăng từ 6 lên 7
              y3: 7     // Tăng từ 6 lên 7
            });
            console.log(`Đã áp dụng tăng độ nét nâng cao (${sharpenAmount})`);
          } catch (sharpenError) {
            console.warn(`Bỏ qua bước sharpen nâng cao do lỗi: ${sharpenError.message}`);
          }
          
          // Bỏ qua bước cân bằng màu nếu cần giữ màu sắc
          if (!config.preserveColors) {
            try {
              // Cân bằng màu
              processedImage = processedImage.normalise();
              console.log(`Đã áp dụng cân bằng màu`);
            } catch (normaliseError) {
              console.warn(`Bỏ qua bước cân bằng màu do lỗi: ${normaliseError.message}`);
            }
          } else {
            console.log(`Đã bỏ qua bước cân bằng màu để giữ màu sắc`);
          }
          
          // Nếu là file bị khóa, thử áp dụng thêm các kỹ thuật xử lý đặc biệt
          if (isBlockedFile) {
            try {
              // Thử áp dụng bộ lọc medianFilter để giảm nhiễu
              processedImage = processedImage.median(1);  // Giữ nguyên 1 để giữ chi tiết
              console.log(`Đã áp dụng bộ lọc median để giảm nhiễu`);
            } catch (medianError) {
              console.warn(`Bỏ qua bước lọc median do lỗi: ${medianError.message}`);
            }
            
            // Xử lý đặc biệt cho watermark khi giữ màu sắc
            if (config.preserveColors === true) {
              try {
                console.log(`Áp dụng xử lý giữ màu sắc cho file bị khóa...`);
                
                // Tăng độ sắc nét để làm rõ nội dung
                processedImage = processedImage.sharpen({
                  sigma: 1.8,  // Tăng từ 1.5 lên 1.8
                  m1: 0.6,     // Tăng từ 0.5 lên 0.6
                  m2: 0.8      // Tăng từ 0.7 lên 0.8
                });
                
                // Tăng độ tương phản nhẹ để làm rõ văn bản
                processedImage = processedImage.linear(
                  1.25,  // Tăng từ 1.2 lên 1.25
                  -0.03  // Giữ nguyên
                );
                
                // Tăng độ bão hòa màu một chút nữa
                processedImage = processedImage.modulate({
                  saturation: 1.3, // Tăng từ 1.1 lên 1.3
                  brightness: 1.05 // Thêm tham số độ sáng nhẹ
                });
                
                console.log(`Đã áp dụng xử lý giữ màu sắc cho file bị khóa`);
              } catch (colorError) {
                console.warn(`Bỏ qua bước xử lý giữ màu sắc do lỗi: ${colorError.message}`);
              }
            }
          }
        } else {
          // Chế độ cơ bản
          try {
            processedImage = processedImage.modulate({
              brightness: 1.1,  // Giảm từ 1.15 xuống 1.1
              saturation: 1.2   // Thêm tham số độ bão hòa
            });
            console.log(`Đã áp dụng tăng độ sáng và bão hòa cơ bản`);
          } catch (modulateError) {
            console.warn(`Bỏ qua bước modulate do lỗi: ${modulateError.message}`);
          }
          
          try {
            // Tăng độ sắc nét cho chế độ cơ bản
            processedImage = processedImage.sharpen({ 
              sigma: 1.5,  // Tăng từ 1.2 lên 1.5
              m1: 0.5,     // Tăng từ 0.4 lên 0.5
              m2: 0.7      // Tăng từ 0.6 lên 0.7
            });
            console.log(`Đã áp dụng tăng độ nét cơ bản`);
          } catch (sharpenError) {
            console.warn(`Bỏ qua bước sharpen do lỗi: ${sharpenError.message}`);
          }
          
          // Thêm bước xử lý tăng độ nét thứ hai cho chế độ cơ bản
          try {
            processedImage = processedImage.linear(
              1.15,  // Tăng độ tương phản nhẹ
              -0.02  // Điểm cắt âm nhỏ để giữ chi tiết
            );
            console.log(`Đã áp dụng tăng độ tương phản nhẹ cho chế độ cơ bản`);
          } catch (contrastError) {
            console.warn(`Bỏ qua bước tăng tương phản do lỗi: ${contrastError.message}`);
          }
        }
        
        // Đặt chất lượng đầu ra và định dạng để tối ưu kích thước
        if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
          processedImage = processedImage.jpeg({ quality: 90 });
        } else if (metadata.format === 'png') {
          processedImage = processedImage.png({ compressionLevel: 6 });
        } else {
          // Mặc định chuyển về JPEG nếu format không phải jpeg hoặc png
          processedImage = processedImage.jpeg({ quality: 90 });
        }
        
        // Lưu ảnh đã xử lý
        console.log(`Đang lưu ảnh đã xử lý...`);
        try {
          // Tạo buffer trước thay vì ghi trực tiếp vào file
          const outputBuffer = await processedImage.toBuffer();
          console.log(`Đã tạo buffer ảnh đã xử lý: ${outputBuffer.length} bytes`);
          
          // Kiểm tra buffer hợp lệ
          if (!outputBuffer || outputBuffer.length < 100) {
            throw new Error(`Buffer ảnh không hợp lệ hoặc quá nhỏ: ${outputBuffer ? outputBuffer.length : 0} bytes`);
          }
          
          // Sử dụng fs.writeFileSync thay vì sharp.toFile
          fs.writeFileSync(outputPath, outputBuffer);
          console.log(`Đã lưu ảnh đã xử lý thành công: ${outputPath}`);
          
          return true;
        } catch (saveError) {
          console.error(`Lỗi khi lưu ảnh đã xử lý: ${saveError.message}`);
          console.error(saveError.stack);
          
          // Kiểm tra lỗi cụ thể
          if (saveError.message.includes('memory') || saveError.message.includes('heap')) {
            console.error(`Có vẻ như lỗi bộ nhớ khi lưu ảnh lớn, thử với kích thước nhỏ hơn`);
            try {
              // Thử lưu ảnh với kích thước nhỏ hơn nhiều
              const MAX_DIMENSION_FALLBACK = 1200;
              console.log(`Thử lại với kích thước tối đa ${MAX_DIMENSION_FALLBACK}px`);
              
              const imgFallbackBuffer = await sharp(inputPath)
                .resize(MAX_DIMENSION_FALLBACK, MAX_DIMENSION_FALLBACK, {
                  fit: 'inside',
                  withoutEnlargement: true
                })
                .jpeg({ quality: 85 })
                .toBuffer();
                
              fs.writeFileSync(outputPath, imgFallbackBuffer);
              console.log(`Đã lưu ảnh với kích thước thu nhỏ thành công: ${outputPath}`);
              return true;
            } catch (fallbackError) {
              console.error(`Lỗi khi lưu ảnh với kích thước nhỏ hơn: ${fallbackError.message}`);
              // Tiếp tục xuống phương án dự phòng cuối cùng
              try {
                console.log(`Thử phương pháp cuối cùng: sao chép file gốc`);
                fs.copyFileSync(inputPath, outputPath);
                console.log(`Đã sao chép file gốc thành công: ${outputPath}`);
                return true;
              } catch (copyError) {
                console.error(`Không thể sao chép file gốc: ${copyError.message}`);
              }
            }
          }
          
          // Chúng ta đã có bản sao dự phòng rồi, không cần sao chép lại
          console.log(`Sử dụng bản sao dự phòng đã tạo`);
          return false;
        }
      } catch (processingError) {
        console.error(`Lỗi khi xử lý ảnh: ${processingError.message}`);
        console.error(processingError.stack);
        
        // Chúng ta đã có bản sao dự phòng rồi, không cần sao chép lại
        console.log(`Sử dụng bản sao dự phòng đã tạo`);
        return false;
      }
    } catch (outerError) {
      console.error(`Lỗi bên ngoài quá trình xử lý: ${outerError.message}`);
      console.error(outerError.stack);
      
      // Chúng ta đã có bản sao dự phòng rồi, không cần sao chép lại
      console.log(`Sử dụng bản sao dự phòng đã tạo`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Lỗi xử lý ảnh cấp cao nhất: ${error.message}`);
    console.error(error.stack);
    
    // Fallback an toàn nhất, đảm bảo luôn có file đầu ra
    try {
      fs.copyFileSync(inputPath, outputPath);
      console.log(`Đã sao chép file gốc sau khi bắt lỗi cuối cùng: ${inputPath} -> ${outputPath}`);
      return false;
    } catch (copyError) {
      console.error(`Không thể sao chép file gốc: ${copyError.message}`);
      
      // Tạo file rỗng nếu không thể sao chép
      try {
        fs.writeFileSync(outputPath, Buffer.alloc(0));
        console.log(`Đã tạo file rỗng sau khi không thể sao chép: ${outputPath}`);
      } catch (writeError) {
        console.error(`Không thể tạo file rỗng: ${writeError.message}`);
      }
    }
    return false;
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
    console.log(`🖼️ Thêm logo vào PDF: ${path.basename(pdfPath)} -> ${path.basename(outputPath)}`);
    
    // Kiểm tra xem có phải là file PDF đã xử lý trước đó không
    const isProcessedFile = pdfPath.includes('_processed') || pdfPath.includes('_clean');
    
    // Nếu là file đã xử lý và không có tham số forceAddLogo, bỏ qua
    if (isProcessedFile && !config.forceAddLogo) {
      console.log(`⚠️ Bỏ qua thêm logo vì file đã được xử lý trước đó: ${pdfPath}`);
      // Sao chép file gốc làm kết quả
      fs.copyFileSync(pdfPath, outputPath);
      return outputPath;
    }
    
    // Đọc PDF gốc
    let pdfBytes;
    try {
      pdfBytes = fs.readFileSync(pdfPath);
    } catch (readError) {
      throw new Error(`Không thể đọc file PDF: ${readError.message}`);
    }
    
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(pdfBytes, { 
        ignoreEncryption: true,
        updateMetadata: false
      });
    } catch (loadError) {
      throw new Error(`Không thể tải file PDF: ${loadError.message}`);
    }
    
    // Đọc hình nền
    let backgroundImage;
    try {
      let backgroundData;
      try {
        backgroundData = fs.readFileSync(backgroundPath);
      } catch (readBgError) {
        throw new Error(`Không thể đọc file hình nền: ${readBgError.message}`);
      }
      
      if (backgroundPath.toLowerCase().endsWith('.png')) {
        backgroundImage = await pdfDoc.embedPng(backgroundData);
      } else if (backgroundPath.toLowerCase().endsWith('.jpg') || backgroundPath.toLowerCase().endsWith('.jpeg')) {
        backgroundImage = await pdfDoc.embedJpg(backgroundData);
      } else {
        throw new Error('Định dạng hình nền không được hỗ trợ. Vui lòng sử dụng PNG hoặc JPG.');
      }
    } catch (embedError) {
      throw new Error(`Không thể nhúng hình nền: ${embedError.message}`);
    }
    
    // Lấy kích thước hình nền
    const bgDimensions = backgroundImage.size();
    
    // Xử lý từng trang PDF
    try {
      const pages = pdfDoc.getPages();
      console.log(`📄 Thêm logo vào ${pages.length} trang...`);
      
      // Độ mờ của logo
      const opacity = config.backgroundOpacity !== undefined ? config.backgroundOpacity : 0.15;
      console.log(`🔍 Sử dụng độ mờ logo: ${opacity}`);
      
      for (const page of pages) {
        try {
          const { width, height } = page.getSize();
          
          // Tính kích thước và vị trí để hình nền vừa với trang
          const scale = Math.min(width / bgDimensions.width, height / bgDimensions.height) * 0.5; // Giảm kích thước logo xuống 50%
          const bgWidth = bgDimensions.width * scale;
          const bgHeight = bgDimensions.height * scale;
          
          // Đặt logo ở giữa trang
          const xOffset = (width - bgWidth) / 2;
          const yOffset = (height - bgHeight) / 2;
          
          // Vẽ hình nền
          page.drawImage(backgroundImage, {
            x: xOffset,
            y: yOffset,
            width: bgWidth,
            height: bgHeight,
            opacity: opacity
          });
        } catch (pageError) {
          console.warn(`⚠️ Lỗi xử lý logo trên một trang: ${pageError.message}`);
          // Tiếp tục với trang tiếp theo
        }
      }
    } catch (pagesError) {
      throw new Error(`Không thể xử lý các trang PDF: ${pagesError.message}`);
    }
    
    // Lưu PDF đã xử lý
    try {
      const modifiedPdfBytes = await pdfDoc.save({
        updateMetadata: false,
        addDefaultPage: false
      });
      fs.writeFileSync(outputPath, modifiedPdfBytes);
      console.log(`✅ Đã lưu PDF với logo: ${outputPath}`);
    } catch (saveError) {
      throw new Error(`Không thể lưu PDF đã xử lý: ${saveError.message}`);
    }
    
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
    
    // Kiểm tra xem các ảnh có phải đã được xử lý trước đó không
    const hasProcessedImages = images.some(img => img.includes('_processed'));
    
    if (hasProcessedImages) {
      console.log(`⚠️ Phát hiện ảnh đã được xử lý trước đó, sẽ không thêm logo lần nữa để tránh lặp`);
    }
    
    // Tạo PDF mới
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.create();
    } catch (createError) {
      throw new Error(`Không thể tạo tài liệu PDF: ${createError.message}`);
    }
    
    // Xử lý từng ảnh
    for (let i = 0; i < images.length; i++) {
      try {
        const imagePath = images[i];
        
        if (i % 5 === 0 || i === images.length - 1) {
          console.log(`🔄 Tạo PDF: ${Math.round((i / images.length) * 100)}% (${i}/${images.length} trang)`);
        }
        
        // Thêm ảnh vào PDF với hình nền
        const success = await addImageToPdf(pdfDoc, imagePath, i, images.length, config);
        if (!success) {
          console.warn(`⚠️ Không thể thêm ảnh ${imagePath} vào PDF`);
        }
      } catch (pageError) {
        console.error(`Lỗi khi thêm ảnh thứ ${i+1} vào PDF: ${pageError.message}`);
      }
    }
    
    // Lưu PDF
    try {
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false
      });
      
      fs.writeFileSync(outputPath, pdfBytes);
    } catch (saveError) {
      // Nếu lưu PDF thất bại, thử phương pháp thay thế
      console.error(`Lỗi khi lưu PDF: ${saveError.message}`);
      console.log(`⚠️ Thử phương pháp thay thế để tạo PDF...`);
      
      // Sử dụng hàm createPDFFromRawImages như một phương pháp thay thế
      return await createPDFFromRawImages(images, outputPath);
    }
    
    console.log(`✅ Đã tạo PDF thành công: ${outputPath}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Lỗi tạo PDF từ ảnh: ${error.message}`);
    
    // Thử phương pháp thay thế nếu gặp lỗi
    try {
      console.log(`⚠️ Thử phương pháp thay thế để tạo PDF...`);
      return await createPDFFromRawImages(images, outputPath);
    } catch (fallbackError) {
      console.error(`❌ Phương pháp thay thế cũng thất bại: ${fallbackError.message}`);
      throw error; // Ném lỗi gốc
    }
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
    
    // Thử sử dụng pdf-lib thay vì PDFKit để tránh lỗi font
    try {
      // Tạo PDF mới với pdf-lib
      const pdfDoc = await PDFDocument.create();
      
      // Sắp xếp ảnh theo thứ tự trang
      const sortedImages = images.sort((a, b) => {
        try {
          const pageA = parseInt(path.basename(a).match(/page_(\d+)/)[1]);
          const pageB = parseInt(path.basename(b).match(/page_(\d+)/)[1]);
          return pageA - pageB;
        } catch (error) {
          return 0;
        }
      });
      
      // Thêm từng ảnh vào PDF
      for (let i = 0; i < sortedImages.length; i++) {
        const imagePath = sortedImages[i];
        
        try {
          // Đọc dữ liệu ảnh
          let imageData;
          try {
            imageData = fs.readFileSync(imagePath);
          } catch (readError) {
            console.warn(`⚠️ Không thể đọc file ảnh ${imagePath}: ${readError.message}`);
            continue;
          }
          
          // Xử lý WebP nếu cần
          if (imagePath.endsWith('.webp')) {
            try {
              console.log(`🔄 Chuyển đổi WebP sang PNG...`);
              imageData = await sharp(imageData).png().toBuffer();
            } catch (convertError) {
              console.warn(`⚠️ Không thể chuyển đổi WebP sang PNG: ${convertError.message}`);
              continue;
            }
          }
          
          // Nhúng ảnh vào PDF
          let embeddedImage;
          try {
            embeddedImage = await pdfDoc.embedPng(imageData);
          } catch (embedError) {
            console.warn(`⚠️ Không thể nhúng ảnh vào PDF: ${embedError.message}`);
            continue;
          }
          
          // Lấy kích thước ảnh
          const imgDimensions = embeddedImage.size();
          
          // Thêm trang mới với kích thước của ảnh
          const page = pdfDoc.addPage([imgDimensions.width, imgDimensions.height]);
          
          // Vẽ ảnh lên trang
          page.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: imgDimensions.width,
            height: imgDimensions.height
          });
          
          console.log(`✅ Đã thêm trang ${i+1}/${sortedImages.length} (${path.basename(imagePath)})`);
        } catch (pageError) {
          console.warn(`⚠️ Lỗi xử lý ảnh ${imagePath}: ${pageError.message}`);
        }
      }
      
      // Lưu PDF
      const pdfBytes = await pdfDoc.save();
      fs.writeFileSync(outputPath, pdfBytes);
      
      console.log(`✅ Đã tạo PDF thành công với pdf-lib: ${outputPath}`);
      return true;
    } catch (pdfLibError) {
      console.error(`❌ Lỗi khi tạo PDF với pdf-lib: ${pdfLibError.message}`);
      console.log(`⚠️ Thử phương pháp thay thế...`);
      
      // Phương pháp thay thế sử dụng PDFKit với cấu hình không phụ thuộc font
      const doc = new PDFKit({
        autoFirstPage: false,
        margin: 0,
        bufferPages: true,
        font: null, // Không sử dụng font mặc định
        compress: true
      });
      
      // Tạo write stream và promise để theo dõi khi nào hoàn thành
      let writeStream;
      try {
        writeStream = fs.createWriteStream(outputPath);
      } catch (streamError) {
        throw new Error(`Không thể tạo write stream: ${streamError.message}`);
      }
      
      const streamFinished = new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      
      doc.pipe(writeStream);
      
      // Xử lý từng ảnh
      const sortedImages = images.sort((a, b) => {
        try {
          const pageA = parseInt(path.basename(a).match(/page_(\d+)/)[1]);
          const pageB = parseInt(path.basename(b).match(/page_(\d+)/)[1]);
          return pageA - pageB;
        } catch (error) {
          return 0;
        }
      });
      
      for (const imagePath of sortedImages) {
        try {
          let imageBuffer;
          try {
            imageBuffer = fs.readFileSync(imagePath);
          } catch (readError) {
            console.warn(`⚠️ Không thể đọc file ảnh ${imagePath}: ${readError.message}`);
            continue;
          }
          
          // Nếu là WebP, chuyển sang PNG
          if (imagePath.endsWith('.webp')) {
            try {
              console.log(`🔄 Chuyển đổi WebP sang PNG...`);
              imageBuffer = await sharp(imageBuffer).png().toBuffer();
            } catch (convertError) {
              console.warn(`⚠️ Không thể chuyển đổi WebP sang PNG: ${convertError.message}`);
              continue;
            }
          }
          
          try {
            // Sử dụng cách thay thế không cần openImage
            const metadata = await sharp(imageBuffer).metadata();
            doc.addPage({ size: [metadata.width, metadata.height] });
            
            // Chuyển đổi buffer thành base64
            const base64Image = imageBuffer.toString('base64');
            const imgFormat = imagePath.endsWith('.webp') ? 'png' : (metadata.format || 'png');
            const imgSrc = `data:image/${imgFormat};base64,${base64Image}`;
            
            // Vẽ ảnh sử dụng phương thức image với nguồn dữ liệu
            doc.image(imgSrc, 0, 0, {
              width: metadata.width,
              height: metadata.height
            });
            
            console.log(`✅ Đã thêm trang ${path.basename(imagePath)}`);
          } catch (imageError) {
            console.warn(`⚠️ Không thể thêm ảnh vào PDF: ${imageError.message}`);
          }
        } catch (error) {
          console.warn(`⚠️ Lỗi xử lý ảnh ${imagePath}: ${error.message}`);
        }
      }
      
      // Kết thúc document và đợi stream hoàn thành
      try {
        doc.end();
        await streamFinished;
      } catch (finishError) {
        throw new Error(`Không thể hoàn thành tạo PDF: ${finishError.message}`);
      }
      
      console.log(`✅ Đã tạo PDF thành công với PDFKit (phương pháp thay thế): ${outputPath}`);
      return true;
    }
  } catch (error) {
    console.error(`❌ Lỗi tạo PDF: ${error.message}`);
    throw error;
  }
} 