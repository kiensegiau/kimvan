import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { checkDriveLinkStatus } from '@/app/api/drive/remove-watermark/lib/drive-service';

// Hàm trích xuất Google Drive ID đơn giản hóa
function extractGoogleDriveFileId(url) {
  if (!url) {
    throw new Error('URL không hợp lệ');
  }
  
  // Format: https://drive.google.com/file/d/{fileId}/view
  const filePattern = /\/file\/d\/([^\/\?&]+)/;
  const fileMatch = url.match(filePattern);
  
  if (fileMatch && fileMatch[1]) {
    return { fileId: fileMatch[1].split('?')[0] };
  }
  
  // Format: https://drive.google.com/open?id={fileId}
  const openPattern = /[?&]id=([^&]+)/;
  const openMatch = url.match(openPattern);
  
  if (openMatch && openMatch[1]) {
    return { fileId: openMatch[1].split('&')[0] };
  }
  
  // Format: https://drive.google.com/drive/folders/{folderId}
  const folderPattern = /\/folders\/([^\/\?&]+)/;
  const folderMatch = url.match(folderPattern);
  
  if (folderMatch && folderMatch[1]) {
    return { fileId: folderMatch[1].split('?')[0] };
  }
  
  throw new Error('Không thể trích xuất ID từ URL Google Drive');
}

export async function POST(request, { params }) {
  try {
    // Lấy ID khóa học từ params - đảm bảo await params trước
    const resolvedParams = await params;
    const id = resolvedParams.id;
    
    if (!id) {
      return NextResponse.json(
        { message: 'Thiếu ID khóa học' },
        { status: 400 }
      );
    }

    // Đọc request body
    const requestBody = await request.json().catch(() => ({}));
    const skipWatermarkRemoval = requestBody.skipWatermarkRemoval !== false; // Mặc định là true trừ khi được đặt rõ ràng là false
    
    if (skipWatermarkRemoval) {
      console.log('⏩ Chế độ bỏ qua xử lý watermark được bật (mặc định)');
    } else {
      console.log('Chế độ xử lý watermark được bật theo yêu cầu');
    }

    console.log(`Đang xử lý các links PDF cho khóa học ID: ${id}`);

    // Kết nối đến MongoDB
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    const collection = db.collection('courses');

    // Tìm khóa học với ObjectId
    let course;
    try {
      // Sử dụng phương pháp chính xác như route.js
      course = await collection.findOne({ _id: new ObjectId(id) });
    } catch (err) {
      console.error('Lỗi khi chuyển đổi ID:', err);
      return NextResponse.json(
        { message: 'ID không hợp lệ' },
        { status: 400 }
      );
    }

    if (!course) {
      return NextResponse.json(
        { message: 'Không tìm thấy khóa học' },
        { status: 404 }
      );
    }

    console.log(`Đã tìm thấy khóa học: ${course.name || 'Không có tên'}`);

    // Làm sạch các mục đang xử lý đã quá hạn (30 phút)
    if (course.processingDriveFiles && course.processingDriveFiles.length > 0) {
      const now = new Date();
      const staleThreshold = 30 * 60 * 1000; // 30 phút
      
      const staleEntries = course.processingDriveFiles.filter(entry => {
        const startedAt = new Date(entry.startedAt);
        const elapsedMs = now - startedAt;
        return elapsedMs > staleThreshold;
      });
      
      if (staleEntries.length > 0) {
        console.log(`Xóa ${staleEntries.length} mục xử lý quá hạn (> 30 phút)`);
        course.processingDriveFiles = course.processingDriveFiles.filter(entry => {
          const startedAt = new Date(entry.startedAt);
          const elapsedMs = now - startedAt;
          return elapsedMs <= staleThreshold;
        });
        
        // Cập nhật danh sách đang xử lý trong database
        await collection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { processingDriveFiles: course.processingDriveFiles } }
        );
      }
    }

    // Log cấu trúc dữ liệu để debug
    console.log('Cấu trúc originalData:', course.originalData ? 
      `Có ${course.originalData.sheets?.length || 0} sheets` : 
      'Không có originalData');

    // Tìm tất cả các link Google Drive PDF trong dữ liệu khóa học
    const drivePdfLinks = [];
    
    // Duyệt qua tất cả sheets và rows để tìm các link PDF
    if (course.originalData && course.originalData.sheets) {
      // Log thông tin về các sheets
      course.originalData.sheets.forEach((sheet, sheetIndex) => {
        console.log(`Sheet ${sheetIndex}: ${sheet?.properties?.title || 'Không có tiêu đề'}, có data: ${!!sheet.data}, có rowData: ${sheet.data?.[0]?.rowData?.length || 0} rows`);
        
        const sheetTitle = sheet?.properties?.title || `Sheet ${sheetIndex + 1}`;
        
        if (sheet.data && sheet.data[0] && sheet.data[0].rowData) {
          sheet.data[0].rowData.forEach((row, rowIndex) => {
            // Bỏ qua hàng tiêu đề (hàng đầu tiên)
            if (rowIndex === 0) return;
            
            if (row.values) {
              row.values.forEach((cell, cellIndex) => {
                const url = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
                const displayName = cell.formattedValue || `Tài liệu ${rowIndex}`;
                
                // Log ra URL để debug
                if (url) {
                  console.log(`Tìm thấy URL ở Sheet ${sheetIndex}, Row ${rowIndex}, Cell ${cellIndex}: ${url.substring(0, 50)}...`);
                }
                
                // Kiểm tra nếu là Google Drive PDF với điều kiện rộng hơn
                if (url && isGoogleDrivePdf(url)) {
                  console.log(`Tìm thấy link Google Drive PDF: ${url.substring(0, 50)}...`);
                  drivePdfLinks.push({
                    url,
                    sheetIndex,
                    rowIndex,
                    cellIndex,
                    sheetTitle,
                    displayName
                  });
                }
              });
            }
          });
        }
      });
    }

    console.log(`Tìm thấy ${drivePdfLinks.length} links Google Drive PDF`);

    // Thêm bước khử trùng links dựa trên file ID
    const uniqueLinks = [];
    const fileIdMap = new Map();
    
    for (const link of drivePdfLinks) {
      try {
        const { fileId } = extractGoogleDriveFileId(link.url);
        
        if (!fileIdMap.has(fileId)) {
          fileIdMap.set(fileId, link);
          uniqueLinks.push(link);
        } else {
          console.log(`Bỏ qua link trùng lặp: ${link.url} (trùng fileId: ${fileId})`);
        }
      } catch (error) {
        console.error(`Lỗi khi trích xuất fileId từ ${link.url}: ${error.message}`);
        uniqueLinks.push(link); // Vẫn giữ link nếu không thể trích xuất fileId
      }
    }
    
    console.log(`Sau khi khử trùng: ${uniqueLinks.length}/${drivePdfLinks.length} links độc nhất`);

    // Nếu không tìm thấy link nào
    if (uniqueLinks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Không tìm thấy link Google Drive PDF nào trong khóa học này',
        totalLinks: 0,
        processedLinks: 0,
        errorLinks: 0,
        details: []
      });
    }

    // Khởi tạo mảng processedDriveFiles nếu chưa có
    if (!course.processedDriveFiles) {
      course.processingDriveFiles = [];
      course.processedDriveFiles = [];
    }

    // Đảm bảo mảng processingDriveFiles tồn tại
    if (!course.processingDriveFiles) {
      course.processingDriveFiles = [];
    }

    // Xử lý tuần tự từng link
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const link of uniqueLinks) {
      try {
        // Kiểm tra xem link đã xử lý chưa
        const existingProcessed = course.processedDriveFiles.find(
          file => file.originalUrl === link.url
        );

        // Kiểm tra xem link đang được xử lý bởi request khác không
        const isCurrentlyProcessing = course.processingDriveFiles.some(
          processing => processing.fileId === extractGoogleDriveFileId(link.url).fileId
        );

        if (isCurrentlyProcessing) {
          console.log(`Link đang được xử lý bởi request khác: ${link.url}`);
          results.push({
            originalUrl: link.url,
            displayName: link.displayName,
            sheetTitle: link.sheetTitle,
            status: 'Đang được xử lý bởi request khác',
            skipped: true
          });
          continue;
        }

        if (existingProcessed) {
          // Link đã được xử lý trước đó, kiểm tra xem link mới còn tồn tại không
          console.log(`Link đã xử lý trước đó: ${link.url}`);
          console.log(`Kiểm tra trạng thái link đã xử lý: ${existingProcessed.processedUrl}`);
          
          let needReprocess = false;
          
          // Kiểm tra link đã xử lý còn tồn tại không
          try {
            const linkStatus = await checkDriveLinkStatus(existingProcessed.processedUrl);
            
            if (!linkStatus.exists) {
              console.log(`Link đã xử lý không còn tồn tại: ${existingProcessed.processedUrl}`);
              console.log(`Lỗi: ${linkStatus.error}`);
              needReprocess = true;
            } else {
              console.log(`Link đã xử lý vẫn còn tồn tại, bỏ qua xử lý lại`);
            }
          } catch (statusError) {
            console.error(`Lỗi khi kiểm tra trạng thái link: ${statusError.message}`);
            // Nếu không kiểm tra được, vẫn giả định link tồn tại để tránh xử lý lại không cần thiết
          }
          
          if (!needReprocess) {
            // Link vẫn còn hoạt động, bỏ qua xử lý lại
            results.push({
              originalUrl: link.url,
              displayName: link.displayName,
              sheetTitle: link.sheetTitle,
              status: existingProcessed.isFolder ? 'Thư mục đã xử lý trước đó' : 'File đã xử lý trước đó',
              processedUrl: existingProcessed.processedUrl,
              isFolder: existingProcessed.isFolder || false
            });
            successCount++;
            continue;
          }
          
          // Nếu cần xử lý lại, xóa khỏi danh sách đã xử lý
            console.log(`Chuẩn bị xử lý lại file: ${link.displayName}`);
            const processedIndex = course.processedDriveFiles.findIndex(
              file => file.originalUrl === link.url
            );
            if (processedIndex !== -1) {
              course.processedDriveFiles.splice(processedIndex, 1);
            }
        }

        // Kiểm tra loại nội dung trước khi xử lý
        console.log(`Kiểm tra loại nội dung của: ${link.url}`);
        try {
          // Trích xuất file ID
          const { fileId } = extractGoogleDriveFileId(link.url);
          
          // Kiểm tra file type trước khi xử lý
          try {
            console.log(`Kiểm tra loại nội dung của: ${link.url}`);
            const checkUrl = new URL('/api/drive/check-file-type', request.url).toString();
            
            // Tạo controller với timeout ngắn hơn cho API kiểm tra file type
            const checkController = new AbortController();
            const checkTimeoutId = setTimeout(() => checkController.abort(), 30000); // 30 giây là đủ
            
            try {
              const checkResponse = await fetch(checkUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  token: 'api@test-watermark',
                  fileId: fileId
                }),
                signal: checkController.signal
              });
              
              clearTimeout(checkTimeoutId); // Xóa timeout khi hoàn thành
              
              const checkData = await checkResponse.json();
              
              if (!checkResponse.ok) {
                throw new Error(checkData.error || 'Không thể kiểm tra loại nội dung');
              }
              
              // Kiểm tra kết quả
              if (checkData.isFolder) {
                // Xử lý folder
                console.log(`Xử lý folder: ${link.url}`);
                const folderUrl = new URL('/api/drive/remove-watermark', request.url).toString();
                
                const folderController = new AbortController();
                const folderTimeoutId = setTimeout(() => folderController.abort(), 10 * 60 * 1000); // 10 phút
                
                try {
                  const folderResponse = await fetch(folderUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      token: 'api@test-watermark',
                      driveLink: link.url,
                      courseName: course.name || 'Khóa học không tên',
                      skipWatermarkRemoval: skipWatermarkRemoval,
                      processRecursively: true, // Thêm flag để xử lý đệ quy các thư mục con
                      maxRecursionDepth: 5 // Giới hạn độ sâu đệ quy để tránh vòng lặp vô hạn
                    }),
                    signal: folderController.signal
                  });
                  
                  clearTimeout(folderTimeoutId);
                  
                  const folderData = await folderResponse.json();
                  
                  if (!folderResponse.ok) {
                    throw new Error(folderData.message || 'Không thể xử lý thư mục');
                  }
                  
                  console.log(`Xử lý thư mục thành công, URL mới: ${folderData.folderLink || folderData.url || folderData.driveUrl || folderData.folderUrl || 'không xác định'}`);
                  
                  // Lấy URL đã xử lý cho folder
                  const folderProcessedUrl = folderData.folderLink || folderData.url || folderData.driveUrl || folderData.folderUrl;
                  
                  // Chuẩn bị đối tượng xử lý để lưu
                  const processedFolder = {
                    originalUrl: link.url,
                    processedUrl: folderProcessedUrl,
                    processedAt: new Date(),
                    fileName: link.displayName,
                    sheetIndex: link.sheetIndex,
                    rowIndex: link.rowIndex,
                    isFolder: true,
                    folderInfo: folderData.folderInfo || null,
                    nestedFilesProcessed: folderData.nestedFilesProcessed || 0, // Số lượng files con đã xử lý
                    nestedFoldersProcessed: folderData.nestedFoldersProcessed || 0 // Số lượng thư mục con đã xử lý
                  };
                  
                  // Thêm vào danh sách cục bộ
                  course.processedDriveFiles.push(processedFolder);
                  
                  results.push({
                    originalUrl: link.url,
                    displayName: link.displayName,
                    sheetTitle: link.sheetTitle,
                    status: 'Xử lý thành công thư mục',
                    processedUrl: folderProcessedUrl,
                    isFolder: true,
                    nestedStats: folderData.nestedStats || { 
                      filesProcessed: folderData.nestedFilesProcessed || 0,
                      foldersProcessed: folderData.nestedFoldersProcessed || 0
                    }
                  });
                  
                  successCount++;
                  continue;
                } catch (folderError) {
                  throw new Error(`Lỗi xử lý thư mục: ${folderError.message}`);
                }
              }
              
              // Nếu không phải folder, PDF hoặc hình ảnh, bỏ qua
              if (!checkData.isPdf && !checkData.mimeType.startsWith('image/')) {
                console.log(`Bỏ qua: ${link.url} - Không phải PDF, hình ảnh hoặc thư mục (${checkData.mimeType})`);
                
                // Ghi rõ loại nội dung trong thông báo
                results.push({
                  originalUrl: link.url,
                  displayName: link.displayName,
                  sheetTitle: link.sheetTitle,
                  status: `Bỏ qua: ${checkData.mimeType}`,
                  skipped: true
                });
                
                continue;
              }
              
              console.log(`Xác nhận là PDF hoặc hình ảnh: ${link.url} (${checkData.mimeType})`);
            } catch (innerCheckError) {
              console.log(`Lỗi khi kiểm tra file type: ${innerCheckError.message}`);
              // Vẫn tiếp tục xử lý
            }
          } catch (checkError) {
            console.log(`Không thể kiểm tra loại nội dung: ${checkError.message}`);
            // Vẫn tiếp tục xử lý - API remove-watermark sẽ xử lý lỗi nếu không phải PDF
          }

          // Gọi API xử lý watermark
          console.log(`Đang xử lý link: ${link.url}`);
          const apiUrl = new URL('/api/drive/remove-watermark', request.url).toString();
          
          // Đánh dấu link đang được xử lý
          try {
            const { fileId } = extractGoogleDriveFileId(link.url);
            course.processingDriveFiles.push({
              fileId,
              url: link.url,
              startedAt: new Date()
            });
            
            // Cập nhật trạng thái đang xử lý vào database
            await collection.updateOne(
              { _id: new ObjectId(id) },
              { $set: { processingDriveFiles: course.processingDriveFiles } }
            );
          } catch (markError) {
            console.error(`Không thể đánh dấu link đang xử lý: ${markError.message}`);
          }
          
          try {
            // Thêm retry logic
            let retryCount = 0;
            const maxRetries = 5; // Tăng số lần retry tối đa
            let response = null;
            
            while (retryCount <= maxRetries) {
              try {
                console.log(`Thử gọi API lần ${retryCount + 1} cho ${link.url}`);
                
                // Tạo AbortController mới cho mỗi lần thử
                const requestController = new AbortController();
                
                // Điều chỉnh thời gian timeout tùy theo số lần thử
                const timeoutDuration = Math.min(5 * 60 * 1000, 2 * 60 * 1000 * (retryCount + 1));
                console.log(`⏱️ Thiết lập timeout ${timeoutDuration/1000}s cho lần thử ${retryCount + 1}`);
                
                const requestTimeoutId = setTimeout(() => {
                  console.log(`⏱️ Timeout cho request lần ${retryCount + 1} sau ${timeoutDuration/1000}s`);
                  requestController.abort();
                }, timeoutDuration);
                
                console.log(`🚀 Bắt đầu request lần ${retryCount + 1} tới ${apiUrl} cho ${link.displayName}`);
                
                response = await fetch(apiUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ 
                    token: 'api@test-watermark',
                    driveLink: link.url,
                    courseName: course.name || 'Khóa học không tên',
                    skipWatermarkRemoval: skipWatermarkRemoval
                  }),
                  signal: requestController.signal
                });
                
                // Xóa timeout khi request thành công
                clearTimeout(requestTimeoutId);
                console.log(`✅ Request lần ${retryCount + 1} thành công, nhận được phản hồi cho ${link.displayName}`);
                
                // Nếu fetch thành công, thoát khỏi vòng lặp
                break;
              } catch (fetchError) {
                retryCount++;
                console.log(`❌ Chi tiết lỗi lần ${retryCount}:`, fetchError.message);
                
                // Phân loại lỗi để xử lý thích hợp
                const isNetworkError = 
                  fetchError.name === 'AbortError' || 
                  fetchError.message.includes('timeout') || 
                  fetchError.message.includes('Headers Timeout Error') ||
                  fetchError.code?.includes('UND_ERR_HEADERS_TIMEOUT') ||
                  fetchError.code === 'UND_ERR_HEADERS_TIMEOUT' ||
                  fetchError.message.includes('network') ||
                  fetchError.message.includes('connection') ||
                  fetchError.message.includes('ECONNREFUSED') ||
                  fetchError.message.includes('ENOTFOUND') ||
                  fetchError.message.includes('fetch failed');
                
                // Ghi log chi tiết hơn cho lỗi Headers Timeout
                if (fetchError.message.includes('Headers Timeout Error') || 
                    fetchError.code === 'UND_ERR_HEADERS_TIMEOUT' ||
                    fetchError.code?.includes('UND_ERR_HEADERS_TIMEOUT')) {
                  console.log('⚠️ Phát hiện lỗi Headers Timeout Error, sẽ thử lại sau thời gian chờ');
                }
                
                // Nếu đã hết số lần thử lại hoặc lỗi không phải timeout, throw lỗi
                if (retryCount > maxRetries || !isNetworkError) {
                  console.log(`❌ Đã hết số lần thử lại (${retryCount}/${maxRetries}) hoặc lỗi không phải do mạng, dừng thử lại`);
                  throw fetchError;
                }
                
                const waitTime = 20000 * Math.pow(2, retryCount-1); // 20s, 40s, 80s, 160s, 320s - backoff tăng theo cấp số nhân
                console.log(`⏱️ Thử lại sau ${waitTime/1000} giây... (lần thử ${retryCount+1}/${maxRetries+1})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
            }
            
            if (!response) {
              throw new Error('Không thể kết nối đến API sau nhiều lần thử');
            }
            
            console.log(`🔄 Đang đọc dữ liệu JSON từ phản hồi cho ${link.displayName}...`);
            const data = await response.json();
            console.log(`✅ Đã đọc xong dữ liệu JSON cho ${link.displayName}`);

            if (!response.ok) {
              throw new Error(data.message || data.error || 'Không thể xử lý file');
            }

            console.log(`Xử lý thành công, URL mới: ${data.webViewLink || data.viewLink || data.folderLink || data.url || data.driveUrl || 'không xác định'}`);

            // Lấy URL đã xử lý (ưu tiên các trường khác nhau tùy theo loại nội dung)
            const processedUrl = data.webViewLink || data.viewLink || data.folderLink || data.url || data.driveUrl;
            
            // Chuẩn bị đối tượng xử lý để lưu
            const processedFile = {
              originalUrl: link.url,
              processedUrl: processedUrl,
              processedAt: new Date(),
              fileName: link.displayName,
              sheetIndex: link.sheetIndex,
              rowIndex: link.rowIndex
            };
            
            // Thêm vào danh sách cục bộ
            course.processedDriveFiles.push(processedFile);
            
            // Xóa khỏi danh sách đang xử lý
            try {
              const { fileId } = extractGoogleDriveFileId(link.url);
              const processingIndex = course.processingDriveFiles.findIndex(
                processing => processing.fileId === fileId
              );
              
              if (processingIndex !== -1) {
                course.processingDriveFiles.splice(processingIndex, 1);
              }
            } catch (unmarkError) {
              console.error(`Không thể xóa trạng thái đang xử lý: ${unmarkError.message}`);
            }

            results.push({
              originalUrl: link.url,
              displayName: link.displayName,
              sheetTitle: link.sheetTitle,
              status: 'Xử lý thành công',
              processedUrl: processedUrl
            });

            successCount++;
          } catch (error) {
            console.error(`Lỗi xử lý file ${link.displayName}:`, error);
            
            // Xóa khỏi danh sách đang xử lý khi có lỗi
            try {
              const { fileId } = extractGoogleDriveFileId(link.url);
              const processingIndex = course.processingDriveFiles.findIndex(
                processing => processing.fileId === fileId
              );
              
              if (processingIndex !== -1) {
                course.processingDriveFiles.splice(processingIndex, 1);
              }
            } catch (unmarkError) {
              console.error(`Không thể xóa trạng thái đang xử lý: ${unmarkError.message}`);
            }
            
            results.push({
              originalUrl: link.url,
              displayName: link.displayName,
              sheetTitle: link.sheetTitle,
              status: `Lỗi: ${error.message}`,
              error: true
            });
            
            errorCount++;
          }
        } catch (error) {
          // Đã có phần catch trước đó, nên không cần phần này nữa
          // Xóa toàn bộ phần catch này
        }
      } catch (error) {
        // Đã có phần catch trước đó, nên không cần phần này nữa
        // Xóa toàn bộ phần catch này
      }
    }

    // Lưu thay đổi vào database
    console.log('Đang lưu kết quả vào database...');
    try {
      // Cập nhật document
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            processedDriveFiles: course.processedDriveFiles,
            processingDriveFiles: course.processingDriveFiles
          } 
        }
      );
      
      if (result.modifiedCount === 0) {
        console.warn('Cảnh báo: Không có document nào được cập nhật');
      } else {
        console.log(`Đã cập nhật thành công, ${result.modifiedCount} document đã được sửa`);
      }
    } catch (error) {
      console.error('Lỗi khi lưu kết quả xử lý:', error);
      return NextResponse.json(
        { message: `Lỗi khi lưu kết quả xử lý: ${error.message}` },
        { status: 500 }
      );
    }

    // Trả về kết quả
    return NextResponse.json({
      success: true,
      message: `Đã xử lý ${successCount}/${drivePdfLinks.length} link. ${errorCount > 0 ? `${errorCount} lỗi.` : ''}`,
      totalLinks: drivePdfLinks.length,
      processedLinks: successCount,
      errorLinks: errorCount,
      details: results.map(r => `${r.displayName} (${r.sheetTitle}): ${r.status}`)
    });

  } catch (error) {
    console.error('Lỗi khi xử lý các link Drive:', error);
    return NextResponse.json(
      { message: `Lỗi: ${error.message}` },
      { status: 500 }
    );
  }
}

// Hàm kiểm tra xem URL có phải là Google Drive PDF không
function isGoogleDrivePdf(url) {
  if (!url) return false;
  
  // Kiểm tra xem có phải là URL Google Drive không
  const isDriveUrl = 
    url.includes('drive.google.com') || 
    url.includes('docs.google.com');
    
  if (!isDriveUrl) return false;
  
  console.log(`Tìm thấy URL Google Drive: ${url}`);
  
  // Loại bỏ các URL chắc chắn không phải PDF 
  if (
    url.includes('spreadsheets') || 
    url.includes('document/d/') ||
    url.includes('presentation/d/') ||
    url.includes('youtu.be') ||
    url.includes('youtube.com')
  ) {
    console.log(`URL loại trừ (không phải PDF): ${url}`);
    return false;
  }
  
  // Thử trích xuất fileId
  try {
    const { fileId } = extractGoogleDriveFileId(url);
    console.log(`Đã trích xuất thành công fileId: ${fileId}`);
    return true;
  } catch (error) {
    console.log(`Không thể trích xuất fileId: ${error.message}`);
    return false;
  }
} 