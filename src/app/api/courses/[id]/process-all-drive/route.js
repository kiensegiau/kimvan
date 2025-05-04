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

    // Nếu không tìm thấy link nào
    if (drivePdfLinks.length === 0) {
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
      course.processedDriveFiles = [];
    }

    // Xử lý tuần tự từng link
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const link of drivePdfLinks) {
      try {
        // Kiểm tra xem link đã xử lý chưa
        const existingProcessed = course.processedDriveFiles.find(
          file => file.originalUrl === link.url
        );

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
          
          // Gọi API kiểm tra loại nội dung
          const checkUrl = new URL('/api/drive/check-file-type', request.url).toString();
          const checkResponse = await fetch(checkUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              token: 'api@test-watermark',
              fileId: fileId
            })
          });
          
          const checkData = await checkResponse.json();
          
          if (!checkResponse.ok) {
            throw new Error(checkData.error || 'Không thể kiểm tra loại nội dung');
          }
          
          // Nếu không phải file PDF, bỏ qua
          if (checkData.mimeType !== 'application/pdf' && 
              !checkData.mimeType.startsWith('image/')) {
            // Nếu là folder, xử lý đặc biệt
            if (checkData.mimeType === 'application/vnd.google-apps.folder') {
              console.log(`Phát hiện thư mục: ${link.url} - Đang kiểm tra tồn tại...`);
              
              // Kiểm tra xem folder này đã được xử lý trước đó trong database hay chưa
              // (đã kiểm tra ở trên với existingProcessed, nhưng kiểm tra kỹ lại bằng ID)
              const folderIdToCheck = fileId;
              
              const existingProcessedById = course.processedDriveFiles.find(
                file => file.originalUrl && file.originalUrl.includes(folderIdToCheck)
              );
              
              if (existingProcessedById) {
                console.log(`Thư mục với ID ${folderIdToCheck} đã được xử lý trước đó`);
                
                // Kiểm tra xem thư mục đã xử lý còn tồn tại không
                console.log(`Kiểm tra trạng thái thư mục đã xử lý: ${existingProcessedById.processedUrl}`);
                let needReprocessFolder = false;
                
                try {
                  const folderStatus = await checkDriveLinkStatus(existingProcessedById.processedUrl);
                  
                  if (!folderStatus.exists) {
                    console.log(`Thư mục đã xử lý không còn tồn tại: ${existingProcessedById.processedUrl}`);
                    console.log(`Lỗi: ${folderStatus.error}`);
                    needReprocessFolder = true;
                  } else {
                    console.log(`Thư mục đã xử lý vẫn còn tồn tại, bỏ qua xử lý lại`);
                  }
                } catch (statusError) {
                  console.error(`Lỗi khi kiểm tra trạng thái thư mục: ${statusError.message}`);
                  // Nếu không kiểm tra được, vẫn giả định thư mục tồn tại để tránh xử lý lại không cần thiết
                }
                
                if (!needReprocessFolder) {
                  // Thư mục vẫn còn hoạt động, bỏ qua xử lý lại
                  results.push({
                    originalUrl: link.url,
                    displayName: link.displayName,
                    sheetTitle: link.sheetTitle,
                    status: 'Thư mục đã xử lý trước đó',
                    processedUrl: existingProcessedById.processedUrl,
                    isFolder: true
                  });
                  successCount++;
                  continue;
                }
                
                // Nếu cần xử lý lại thư mục, xóa khỏi danh sách đã xử lý
                console.log(`Chuẩn bị xử lý lại thư mục: ${link.displayName}`);
                const folderProcessedIndex = course.processedDriveFiles.findIndex(
                  file => file.originalUrl && file.originalUrl.includes(folderIdToCheck)
                );
                if (folderProcessedIndex !== -1) {
                  course.processedDriveFiles.splice(folderProcessedIndex, 1);
                }
              }
              
              console.log(`Đang xử lý thư mục: ${link.url}`);
              
              // Gọi API xử lý folder
              const folderApiUrl = new URL('/api/drive/remove-watermark', request.url).toString();
              
              const folderResponse = await fetch(folderApiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                  token: 'api@test-watermark',
                  driveLink: link.url,
                  courseName: course.name || 'Khóa học không tên'
                })
              });
              
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
                folderInfo: folderData.folderInfo || null
              };
              
              // Thêm vào danh sách cục bộ
              course.processedDriveFiles.push(processedFolder);
              
              results.push({
                originalUrl: link.url,
                displayName: link.displayName,
                sheetTitle: link.sheetTitle,
                status: 'Xử lý thành công thư mục',
                processedUrl: folderProcessedUrl,
                isFolder: true
              });
              
              successCount++;
              continue;
            }
            // Nếu không phải folder, PDF hoặc hình ảnh, bỏ qua
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
        } catch (checkError) {
          console.log(`Không thể kiểm tra loại nội dung: ${checkError.message}`);
          // Vẫn tiếp tục xử lý - API remove-watermark sẽ xử lý lỗi nếu không phải PDF
        }

        // Gọi API xử lý watermark
        console.log(`Đang xử lý link: ${link.url}`);
        const apiUrl = new URL('/api/drive/remove-watermark', request.url).toString();
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            token: 'api@test-watermark',
            driveLink: link.url,
            courseName: course.name || 'Khóa học không tên'
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Không thể xử lý file');
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
        
        results.push({
          originalUrl: link.url,
          displayName: link.displayName,
          sheetTitle: link.sheetTitle,
          status: `Lỗi: ${error.message}`,
          error: true
        });
        
        errorCount++;
      }
    }

    // Lưu thay đổi vào database
    console.log('Đang lưu kết quả vào database...');
    try {
      // Cập nhật document
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { processedDriveFiles: course.processedDriveFiles } }
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