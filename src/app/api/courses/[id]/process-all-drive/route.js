import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

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
          // Link đã được xử lý trước đó
          console.log(`Link đã xử lý trước đó: ${link.url}`);
          results.push({
            originalUrl: link.url,
            displayName: link.displayName,
            sheetTitle: link.sheetTitle,
            status: 'Đã xử lý trước đó',
            processedUrl: existingProcessed.processedUrl
          });
          successCount++;
          continue;
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
          if (checkData.mimeType !== 'application/pdf') {
            console.log(`Bỏ qua: ${link.url} - Không phải PDF (${checkData.mimeType})`);
            
            // Nếu là folder, ghi rõ trong thông báo
            const contentType = checkData.mimeType === 'application/vnd.google-apps.folder' 
              ? 'Folder/Thư mục' 
              : checkData.mimeType;
              
            results.push({
              originalUrl: link.url,
              displayName: link.displayName,
              sheetTitle: link.sheetTitle,
              status: `Bỏ qua: ${contentType}`,
              skipped: true
            });
            
            continue;
          }
          
          console.log(`Xác nhận là PDF: ${link.url}`);
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
            driveLink: link.url
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Không thể xử lý file PDF');
        }

        console.log(`Xử lý thành công, URL mới: ${data.webViewLink}`);

        // Chuẩn bị đối tượng xử lý để lưu
        const processedFile = {
          originalUrl: link.url,
          processedUrl: data.webViewLink,
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
          processedUrl: data.webViewLink
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
      message: `Đã xử lý ${successCount}/${drivePdfLinks.length} link PDF. ${errorCount > 0 ? `${errorCount} lỗi.` : ''}`,
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