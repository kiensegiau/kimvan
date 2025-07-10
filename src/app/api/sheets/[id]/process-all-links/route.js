import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { dbMiddleware } from '@/utils/db-middleware';
import Sheet from '@/models/Sheet';
import { ObjectId } from 'mongodb';
import { 
  extractDriveFileId, 
  extractUrlFromCell, 
  isDriveUrl, 
  createHyperlinkFormula, 
  processLink,
  processRecursiveFolder
} from '@/utils/drive-utils';

// Thêm lại hàm determineFileTypeFromExtension đã bị xóa
function determineFileTypeFromExtension(url) {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith('.pdf')) return 'application/pdf';
  if (lowerUrl.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lowerUrl.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lowerUrl.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (lowerUrl.endsWith('.doc')) return 'application/msword';
  if (lowerUrl.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lowerUrl.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerUrl.endsWith('.png')) return 'image/png';
  if (lowerUrl.endsWith('.mp4')) return 'video/mp4';
  if (lowerUrl.endsWith('.mp3')) return 'audio/mpeg';
  return 'application/pdf'; // Mặc định là PDF
}

export async function POST(request, { params }) {
  console.log('============== BẮT ĐẦU XỬ LÝ TẤT CẢ LINK TRONG SHEET ==============');
  
  try {
    await dbMiddleware(request);
    const { id } = await params;
    // Xử lý trường hợp request không có body hoặc body không hợp lệ
    let requestBody = {};
    try {
      requestBody = await request.json();
    } catch (jsonError) {
      console.log('Không có body hoặc body không hợp lệ, sử dụng object rỗng');
    }
    
    console.log('ID sheet:', id);
    
    // Find the sheet in the database
    let sheet;
    if (ObjectId.isValid(id)) {
      sheet = await Sheet.findById(id);
    } else {
      // If not an ObjectId, assume it's a sheetId
      sheet = await Sheet.findOne({ sheetId: id });
    }

    if (!sheet) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy sheet' }, 
        { status: 404 }
      );
    }
    
    console.log('Tìm thấy sheet:', sheet.name, 'với ID:', sheet.sheetId);
    
    // Lấy dữ liệu sheet từ Google Sheets API
    let auth;
    
    // Kiểm tra xem có file credentials không
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    console.log('Đường dẫn credentials:', credentialsPath);
    
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      // Xác thực với file credentials
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      console.log('Sử dụng xác thực từ file credentials');
    } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      // Xác thực với biến môi trường
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      console.log('Sử dụng xác thực từ biến môi trường');
    } else {
      console.error('Không tìm thấy thông tin xác thực Google API');
      throw new Error('Không tìm thấy thông tin xác thực Google API');
    }
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Lấy dữ liệu sheet
    let values;
    let htmlData;
    let firstSheetName;
    let actualSheetId = 0;
    let apiSheetName = 'Sheet1'; // Khai báo biến apiSheetName ở phạm vi ngoài để có thể truy cập từ mọi nơi
    
    try {
      // First try to get spreadsheet metadata to find sheet names
      const spreadsheetInfo = await sheets.spreadsheets.get({
        spreadsheetId: sheet.sheetId
      });
      
      // Ưu tiên sử dụng tên sheet từ database vì đây là tên sheet thật do người dùng đặt
      // Bắt buộc sử dụng tên sheet từ database (sheet.name) để tránh sử dụng tên mặc định "Trang tính 1"
      const sheetTitle = sheet.title || sheet.name;
      firstSheetName = sheetTitle || 'Untitled Sheet'; // Không sử dụng tên sheet từ API để tránh "Trang tính 1"
      
      // Lấy sheetId thực tế của sheet đầu tiên
      actualSheetId = spreadsheetInfo.data.sheets[0]?.properties?.sheetId || 0;
      console.log(`Tên sheet từ database: ${sheetTitle || 'không có'}`);
      console.log(`Tên sheet đầu tiên từ API: ${spreadsheetInfo.data.sheets[0]?.properties?.title || 'không có'}`);
      console.log(`Tên sheet sẽ sử dụng: ${firstSheetName}, SheetId: ${actualSheetId}`);
      
      // Now get the values using the actual sheet name from Google Sheets API
      // Sử dụng tên sheet từ API chỉ để truy vấn dữ liệu, không dùng cho tên thư mục
      apiSheetName = spreadsheetInfo.data.sheets[0]?.properties?.title || 'Sheet1'; // Gán giá trị cho biến đã khai báo
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheet.sheetId,
        range: `${apiSheetName}!A:Z`  // Use the actual sheet name from API for data retrieval
      });
      
      values = response.data.values;
      
      // Lấy thêm dữ liệu HTML để phát hiện hyperlink
      try {
        // Instead of using the spreadsheets API that opens Chrome,
        // we'll use the Sheets API to get hyperlinks directly
        const spreadsheetData = await sheets.spreadsheets.get({
          spreadsheetId: sheet.sheetId,
          ranges: [`${apiSheetName}!A:Z`], // Use apiSheetName for data retrieval
          includeGridData: true
        });
        
        // Extract hyperlink data from the response
        if (spreadsheetData.data && 
            spreadsheetData.data.sheets && 
            spreadsheetData.data.sheets.length > 0 && 
            spreadsheetData.data.sheets[0].data && 
            spreadsheetData.data.sheets[0].data.length > 0) {
          
          const sheetData = spreadsheetData.data.sheets[0].data[0];
          htmlData = {
            values: []
          };
          
          // Process the grid data to extract hyperlinks
          if (sheetData.rowData) {
            sheetData.rowData.forEach((row, rowIndex) => {
              if (!htmlData.values[rowIndex]) {
                htmlData.values[rowIndex] = { values: [] };
              }
              
              if (row.values) {
                row.values.forEach((cell, colIndex) => {
                  const hyperlink = cell.hyperlink || 
                                   (cell.userEnteredFormat && 
                                    cell.userEnteredFormat.textFormat && 
                                    cell.userEnteredFormat.textFormat.link && 
                                    cell.userEnteredFormat.textFormat.link.uri);
                  
                  // Lấy ghi chú của ô (nếu có)
                  const note = cell.note || '';
                  
                  htmlData.values[rowIndex].values[colIndex] = {
                    hyperlink: hyperlink,
                    note: note  // Lưu ghi chú để kiểm tra sau
                  };
                });
              }
            });
          }
          
          console.log('Đã lấy được dữ liệu hyperlink và ghi chú từ Google Sheets API');
        }
      } catch (htmlError) {
        console.error('Lỗi khi lấy dữ liệu hyperlink:', htmlError);
        // Không throw error, chỉ log và tiếp tục
      }
      
      console.log('Dữ liệu sheet:', {
        totalRows: values?.length || 0,
        sampleFirstRow: values && values.length > 0 ? values[0] : 'không có dữ liệu',
        sampleSecondRow: values && values.length > 1 ? values[1] : 'không có dữ liệu',
        hasHtmlData: !!htmlData
      });
      
      if (!values || values.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Sheet không có dữ liệu' }, 
          { status: 404 }
        );
      }
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu từ Google Sheets:', error);
      return NextResponse.json(
        { success: false, error: `Lỗi khi lấy dữ liệu từ Google Sheets: ${error.message}` }, 
        { status: 500 }
      );
    }
    
    // Tìm tất cả các ô chứa link Google Drive
    const cellsToProcess = [];
    const skippedCells = [];
    
    for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
      const row = values[rowIndex] || [];
      
      // Lấy dữ liệu HTML tương ứng nếu có
      const htmlRow = htmlData?.values?.[rowIndex]?.values || [];
      
      for (let colIndex = 0; colIndex < (row.length || 0); colIndex++) {
        const cell = row[colIndex];
        if (!cell) continue;
        
        // Kiểm tra xem có dữ liệu HTML không
        const htmlCell = htmlRow[colIndex];
        const hyperlink = htmlCell?.hyperlink;
        const note = htmlCell?.note || '';
        
        // Kiểm tra xem ô đã được xử lý trước đó chưa (dựa vào ghi chú)
        const isProcessed = note && (note.includes('Link gốc:') || note.includes('Đã xử lý lúc:'));
        if (isProcessed) {
          console.log(`Bỏ qua ô [${rowIndex + 1}:${colIndex + 1}] vì đã được xử lý trước đó (có ghi chú)`);
          skippedCells.push({
            rowIndex,
            colIndex,
            cell,
            note
          });
          continue;  // Bỏ qua ô này và chuyển sang ô tiếp theo
        }
        
        // Ưu tiên lấy hyperlink từ dữ liệu HTML
        let url = hyperlink;
        
        // Nếu không có hyperlink từ HTML, thử trích xuất từ nội dung cell
        if (!url) {
          url = extractUrlFromCell(cell);
          console.log(`Trích xuất URL từ nội dung cell [${rowIndex + 1}:${colIndex + 1}]: "${cell.substring(0, 50)}${cell.length > 50 ? '...' : ''}" -> ${url || 'không tìm thấy URL'}`);
        }
        
        console.log(`Kiểm tra ô [${rowIndex + 1}:${colIndex + 1}]:`, cell, 
          '-> HTML hyperlink:', hyperlink,
          '-> Extracted URL:', url ? url : 'không có',
          '-> Là Drive URL:', url ? isDriveUrl(url) : false);
        
        if (url && isDriveUrl(url)) {
          cellsToProcess.push({
            rowIndex,
            colIndex,
            cell,
            url
          });
        } else if (cell && typeof cell === 'string') {
          // Try to extract Drive ID directly from text for cases that might be missed
          const driveIdRegex = /([a-zA-Z0-9_-]{25,})/;
          const idMatch = cell.match(driveIdRegex);
          
          if (idMatch && idMatch[1]) {
            const potentialDriveId = idMatch[1];
            console.log(`Tìm thấy ID tiềm năng trong cell [${rowIndex + 1}:${colIndex + 1}]: ${potentialDriveId}`);
            
            // Construct a Drive URL and check if it's valid
            const constructedUrl = `https://drive.google.com/file/d/${potentialDriveId}/view`;
            
            cellsToProcess.push({
              rowIndex,
              colIndex,
              cell,
              url: constructedUrl,
              note: 'Extracted from potential Drive ID in text'
            });
          }
        }
      }
    }
    
    console.log(`Tìm thấy ${cellsToProcess.length} ô chứa link Google Drive cần xử lý`);
    console.log(`Đã bỏ qua ${skippedCells.length} ô đã được xử lý trước đó (có ghi chú)`);
    
    // If no links found, add a test link from the request body if provided
    if (cellsToProcess.length === 0 && requestBody.testDriveLink) {
      console.log('Không tìm thấy link nào trong sheet, sử dụng link test:', requestBody.testDriveLink);
      cellsToProcess.push({
        rowIndex: 1,
        colIndex: 0,
        cell: requestBody.testDriveLink,
        url: requestBody.testDriveLink
      });
    }
    
    // Nhóm các ô có cùng URL để tránh xử lý lặp lại
    const urlGroups = {};
    cellsToProcess.forEach(cellInfo => {
      // Chuẩn hóa URL để so sánh
      const normalizedUrl = extractDriveFileId(cellInfo.url);
      if (!urlGroups[normalizedUrl]) {
        urlGroups[normalizedUrl] = {
          fileId: normalizedUrl,
          originalUrl: cellInfo.url,
          cells: []
        };
      }
      urlGroups[normalizedUrl].cells.push(cellInfo);
    });
    
    console.log(`Đã nhóm ${cellsToProcess.length} ô thành ${Object.keys(urlGroups).length} nhóm URL duy nhất`);
    
    // Xử lý từng link
    const processedCells = [];
    const errors = [];
    
    // Determine the base URL for API calls
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const baseUrl = `${protocol}://${host}`;
    const cookie = request.headers.get('cookie') || '';
    
    // Xử lý theo batch thay vì tuần tự
    console.log(`Bắt đầu xử lý theo batch (5 link cùng lúc) với tổng ${Object.keys(urlGroups).length} link duy nhất...`);
    
    // Chuyển đổi object urlGroups thành mảng để dễ xử lý theo batch
    const urlGroupsArray = Object.values(urlGroups);
    
    // Xử lý theo batch, mỗi batch 5 link
    const BATCH_SIZE = 1    
    // Thay đổi hàm processUrlGroup thành async
    async function processUrlGroup(urlGroup, index) {
      const firstCell = urlGroup.cells[0];
      try {
        console.log(`\n===== Đang xử lý URL: ${urlGroup.originalUrl} (${urlGroup.cells.length} ô) =====`);
        
        // ----- 1. XÁC ĐỊNH LOẠI FILE & ID -----
        let fileType = null; // MIME type
        let fileId = null;  // Google Drive file ID
        let isFolder = false; // Flag để đánh dấu nếu là folder
        let fileName = null; // Tên file nếu có thể xác định
        
        // Trích xuất file ID từ URL - sử dụng hàm mới để xử lý URL phức tạp
        try {
          const extracted = extractDriveFileId(urlGroup.originalUrl);
          if (extracted && extracted.fileId) {
            fileId = extracted.fileId;
            console.log(`✅ Đã trích xuất file ID: ${fileId}`);
          } else {
            console.log(`⚠️ Không thể trích xuất ID từ URL: ${urlGroup.originalUrl}`);
          }
        } catch (extractError) {
          console.warn(`⚠️ Lỗi khi trích xuất ID file: ${extractError.message}`);
        }
        
        // Thử xác định loại file từ URL (nếu không có fileId)
        if (!fileId) {
          fileType = determineFileTypeFromExtension(urlGroup.originalUrl);
          console.log(`🔍 Xác định loại file từ URL: ${fileType}`);
          
          // Kiểm tra URL xem có phải folder không
          const url = urlGroup.originalUrl.toLowerCase();
          if (url.includes('drive.google.com/drive/folders/') || 
              url.includes('drive.google.com/drive/u/0/folders/') ||
              url.includes('drive.google.com/drive/my-drive/folders/') ||
              url.includes('drive.google.com/folders/')) {
            console.log('📁 Phát hiện link là folder Google Drive từ URL');
            isFolder = true;
            fileType = 'application/vnd.google-apps.folder';
          }
          
          return continueProcessing();
        }
        
        // Có fileId: Lấy thông tin file từ Drive API
        try {
          // Import hàm getTokenByType từ utils
          const { getTokenByType } = await import('@/app/api/drive/remove-watermark/lib/utils.js');
          
          // Lấy token tải xuống
          const downloadToken = getTokenByType('download');
          if (!downloadToken) {
            console.error('❌ Không tìm thấy token Google Drive tải xuống');
            throw new Error('Không tìm thấy token Google Drive tải xuống');
          }
          
          // Tạo OAuth2 client
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
          );
          
          // Thiết lập credentials
          oauth2Client.setCredentials(downloadToken);
          
          // Khởi tạo Google Drive API
          const drive = google.drive({ version: 'v3', auth: oauth2Client });
          
          // Lấy thông tin file
          const fileMetadata = await drive.files.get({
            fileId: fileId,
            fields: 'id,name,mimeType,fileExtension',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
          });
          
          if (fileMetadata.data) {
            fileType = fileMetadata.data.mimeType;
            fileName = fileMetadata.data.name;
            console.log(`📄 Thông tin file: Tên=${fileName}, MIME=${fileType}`);
            
            // Kiểm tra xem có phải là folder không
            if (fileType === 'application/vnd.google-apps.folder') {
              console.log(`📁 Phát hiện file là folder: ${fileName || 'không có tên'}`);
              isFolder = true;
            }
          }
        } catch (driveApiError) {
          console.warn(`⚠️ Lỗi khi truy vấn Drive API: ${driveApiError.message}`);
          // Fallback: xác định loại file từ URL nếu không lấy được từ API
          fileType = determineFileTypeFromExtension(urlGroup.originalUrl);
          console.log(`🔍 Fallback: Xác định loại file từ URL: ${fileType}`);
        }
        
        return continueProcessing();
        
        // ----- 2. XỬ LÝ FILE DỰA TRÊN LOẠI -----
        async function continueProcessing() {
          console.log(`\n----- PHÂN LOẠI FILE -----`);
          console.log(`📋 Thông tin file: ID=${fileId}, Type=${fileType}, Folder=${isFolder}, Name=${fileName || 'N/A'}`);
          
          // 2.1 XỬ LÝ FOLDER
          if (isFolder) {
            console.log(`📁 Xử lý FOLDER: ${urlGroup.originalUrl}`);
            return await processFolder();
          }
          
          // 2.2 PHÂN LOẠI FILE DỰA TRÊN MIME TYPE
          const fileCategory = categorizeFile(fileType, urlGroup.originalUrl);
          console.log(`🏷️ Phân loại file: ${fileCategory.type} (${fileCategory.description})`);
          
          // 2.3 XỬ LÝ THEO TỪNG LOẠI FILE
          switch (fileCategory.type) {
            case 'video':
              return await processVideoFile();
            case 'pdf':
              return await processPDFFile();
            case 'image':
              return await processImageFile();
            case 'document':
              return await processDocumentFile();
            case 'spreadsheet':
              return await processSpreadsheetFile();
            case 'presentation':
              return await processPresentationFile();
            case 'audio':
              return await processAudioFile();
            default:
              return await processGenericFile();
          }
        }
        
        // ----- 3. HANDLERS CHO TỪNG LOẠI FILE -----
        
        // 3.1 XỬ LÝ FOLDER
        async function processFolder() {
          console.log(`📂 Tiến hành xử lý đệ quy folder: ${urlGroup.originalUrl}`);
          console.log(`📂 Sẽ lưu vào thư mục cha có tên: ${firstSheetName}`);
          
          return processRecursiveFolder(urlGroup.originalUrl, 3, 0, null, 0.15, firstSheetName)
            .then(folderResult => {
              console.log(`✅ Đã xử lý folder đệ quy thành công: ${urlGroup.originalUrl}`);
              console.log(`📊 Số file đã xử lý: ${folderResult.nestedFilesProcessed}, số folder đã xử lý: ${folderResult.nestedFoldersProcessed}`);
              
              // Lấy link folder đã xử lý
              const processedFolderLink = folderResult.folderStructure.processedFolderLink || urlGroup.originalUrl;
              console.log(`🔗 Link folder đã xử lý: ${processedFolderLink}`);
              
              return {
                success: true,
                urlGroup,
                newUrl: processedFolderLink,
                processResult: {
                  success: true,
                  originalLink: urlGroup.originalUrl,
                  processedLink: processedFolderLink,
                  isFolder: true,
                  folderInfo: folderResult.folderStructure,
                  nestedFilesProcessed: folderResult.nestedFilesProcessed,
                  nestedFoldersProcessed: folderResult.nestedFoldersProcessed
                },
                fileType: 'folder',
                isFolder: true
              };
            })
            .catch(folderError => {
              console.error(`❌ Lỗi khi xử lý folder đệ quy: ${folderError.message}`);
              return {
                success: true,
                keepOriginalUrl: true,
                urlGroup,
                newUrl: urlGroup.originalUrl,
                error: `Lỗi xử lý folder: ${folderError.message}`,
                processResult: {
                  success: false,
                  originalLink: urlGroup.originalUrl,
                  processedLink: urlGroup.originalUrl,
                  isFolder: true,
                  error: folderError.message
                },
                fileType: 'folder',
                isFolder: true
              };
            });
        }
        
        // 3.2 XỬ LÝ VIDEO FILE
        async function processVideoFile() {
          console.log(`🎥 Xử lý VIDEO: ${urlGroup.originalUrl}`);
          
          try {
            if (!fileId) {
              throw new Error('Không có file ID hợp lệ để xử lý video');
            }
            
            // Import VideoProcessor
            const VideoProcessor = require('@/app/api/drive/process-and-replace/lib/video-processor');
            
            // Khởi tạo processor
            const videoProcessor = new VideoProcessor('temp');
            
            // Tạo tên file an toàn
            const safeFileName = fileName ? 
              fileName.replace(/[\\/:*?"<>|]/g, '_') : 
              `Video_${fileId}.mp4`;
              
            const targetFolderId = "1Lt10aHyWp9VtPaImzInE0DmIcbrjJgpN"; // Folder mặc định
            
            console.log(`🎬 Bắt đầu xử lý video: ID=${fileId}, fileName=${safeFileName}, targetFolderId=${targetFolderId}`);
            
            // Xử lý video
            const videoResult = await videoProcessor.handlePDFToVideo(fileId, safeFileName, targetFolderId);
            
            // Giải phóng tài nguyên
            await videoProcessor.close();
            
            // Kiểm tra kết quả xử lý video
            if (!videoResult.success) {
              console.error(`❌ Lỗi xử lý video: ${videoResult.error}`);
              return {
                success: true,
                keepOriginalUrl: true,
                urlGroup,
                newUrl: urlGroup.originalUrl,
                error: videoResult.error || 'Lỗi xử lý video',
                processResult: null,
                fileType: fileType,
                fileCategory: 'video'
              };
            }
            
            // Lấy URL mới từ kết quả upload
            let newUrl = urlGroup.originalUrl; // Mặc định giữ URL gốc
            
            if (videoResult.uploadResult && videoResult.uploadResult.success) {
              // Nếu upload thành công, sử dụng link mới
              newUrl = videoResult.uploadResult.webViewLink || videoResult.uploadResult.webContentLink;
              console.log(`✅ Đã xử lý video thành công và upload: ${newUrl}`);
            } else if (videoResult.filePath) {
              // Nếu không upload được nhưng có file local
              newUrl = `file://${videoResult.filePath}`;
              console.log(`⚠️ Đã xử lý video nhưng chỉ lưu local: ${newUrl}`);
            }
            
            return {
              success: true,
              urlGroup,
              newUrl: newUrl,
              processResult: videoResult,
              fileType: fileType,
              fileCategory: 'video'
            };
          } catch (videoError) {
            console.error(`❌ Lỗi khi xử lý file video: ${videoError.message}`);
            
            return {
              success: true,
              keepOriginalUrl: true,
              urlGroup,
              newUrl: urlGroup.originalUrl,
              error: `Lỗi xử lý video: ${videoError.message}`,
              processResult: null,
              fileType: fileType,
              fileCategory: 'video'
            };
          }
        }
        
        // 3.3 XỬ LÝ PDF FILE
        async function processPDFFile() {
          console.log(`📑 Xử lý PDF: ${urlGroup.originalUrl}`);
          
          try {
            if (!fileId) {
              throw new Error('Không có file ID hợp lệ để xử lý PDF');
            }
            
            console.log(`📤 Gọi API process-and-replace cho PDF với fileId: ${fileId}`);
            
            // Tạo URL đơn giản từ fileId thay vì sử dụng URL phức tạp
            const simpleUrl = `https://drive.google.com/file/d/${fileId}/view`;
            
            const processResponse = await fetch(`${baseUrl}/api/drive/process-and-replace`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Cookie': cookie // Chuyển tiếp cookie để duy trì phiên đăng nhập
              },
              body: JSON.stringify({
                fileId: fileId, // Ưu tiên sử dụng fileId trực tiếp
                url: simpleUrl, // Cung cấp URL đơn giản như backup
                targetFolderId: "1Lt10aHyWp9VtPaImzInE0DmIcbrjJgpN", // Folder mặc định
                watermarkApiKey: requestBody.apiKey || null,
                courseName: firstSheetName
              })
            });
            
            // Kiểm tra phản hồi từ API
            if (!processResponse.ok) {
              let errorText = await processResponse.text();
              try {
                const errorJson = JSON.parse(errorText);
                errorText = errorJson.error || errorJson.message || errorText;
              } catch (e) { /* Không phải JSON */ }
              
              console.error(`❌ Lỗi từ API process-and-replace: ${errorText}`);
              return {
                success: true,
                keepOriginalUrl: true,
                urlGroup,
                newUrl: urlGroup.originalUrl,
                error: errorText,
                processResult: null,
                fileType: fileType,
                fileCategory: 'pdf'
              };
            }
            
            // Đọc kết quả từ API
            const processResultJson = await processResponse.json();
            console.log(`📊 Kết quả xử lý PDF:`, JSON.stringify(processResultJson, null, 2));
            
            // Log chi tiết về processedFile để debug
            if (processResultJson && processResultJson.processedFile) {
              console.log(`📄 Chi tiết file đã xử lý:
- ID: ${processResultJson.processedFile.id || 'không có'}
- Tên: ${processResultJson.processedFile.name || 'không có'}
- Link: ${processResultJson.processedFile.link || 'không có'}
- webViewLink: ${processResultJson.processedFile.webViewLink || 'không có'}
- webContentLink: ${processResultJson.processedFile.webContentLink || 'không có'}
`);
            }
            
            // Kiểm tra lỗi từ kết quả
            if (!processResultJson || processResultJson.error || !processResultJson.processedFile) {
              const errorMessage = processResultJson?.error || 'Không nhận được kết quả xử lý hợp lệ';
              console.error(`❌ Lỗi từ kết quả API: ${errorMessage}`);
              
              return {
                success: true,
                keepOriginalUrl: true,
                urlGroup,
                newUrl: urlGroup.originalUrl,
                error: errorMessage,
                processResult: processResultJson,
                fileType: fileType,
                fileCategory: 'pdf'
              };
            }
            
            // Kiểm tra nếu file bị bỏ qua xử lý
            if (processResultJson.skipped) {
              console.log(`⚠️ PDF đã được bỏ qua xử lý: ${processResultJson.message || 'Không rõ lý do'}`);
              
              // Nếu có URL mới, sử dụng URL mới
              const newUrl = processResultJson.processedFile?.webContentLink || 
                            processResultJson.processedFile?.webViewLink || 
                            urlGroup.originalUrl;
              
              return {
                success: true,
                urlGroup,
                newUrl: newUrl,
                processResult: processResultJson.processedFile,
                fileType: processResultJson.mimeType || fileType,
                fileCategory: 'pdf',
                skipped: true
              };
            }
            
            // Kiểm tra nếu không có link mới
            if (!processResultJson.processedFile.webViewLink && 
                !processResultJson.processedFile.webContentLink && 
                !processResultJson.processedFile.link) {
              console.error(`❌ Không nhận được URL mới sau khi xử lý PDF: ${urlGroup.originalUrl}`);
              
              return {
                success: true,
                keepOriginalUrl: true,
                urlGroup,
                newUrl: urlGroup.originalUrl,
                error: "Không nhận được URL mới sau khi xử lý",
                processResult: processResultJson,
                fileType: fileType,
                fileCategory: 'pdf'
              };
            }
            
            // Lấy URL mới từ kết quả - ưu tiên theo thứ tự: link, webContentLink, webViewLink
            const newUrl = processResultJson.processedFile.link || 
                          processResultJson.processedFile.webContentLink || 
                          processResultJson.processedFile.webViewLink;
            console.log(`✅ PDF đã được xử lý thành công: ${newUrl}`);
            
            return {
              success: true,
              urlGroup,
              newUrl,
              processResult: processResultJson.processedFile,
              fileType: processResultJson.mimeType || fileType,
              fileCategory: 'pdf',
              skipped: processResultJson.skipped || false
            };
          } catch (pdfError) {
            console.error(`❌ Lỗi khi xử lý file PDF: ${pdfError.message}`);
            
            return {
              success: true,
              keepOriginalUrl: true,
              urlGroup,
              newUrl: urlGroup.originalUrl,
              error: `Lỗi xử lý PDF: ${pdfError.message}`,
              processResult: null,
              fileType: fileType,
              fileCategory: 'pdf'
            };
          }
        }
        
        // 3.4 XỬ LÝ IMAGE FILE
        async function processImageFile() {
          console.log(`🖼️ Xử lý FILE HÌNH ẢNH: ${urlGroup.originalUrl}`);
          return await processGenericFile('image');
        }
        
        // 3.5 XỬ LÝ DOCUMENT FILE
        async function processDocumentFile() {
          console.log(`📝 Xử lý FILE VĂN BẢN: ${urlGroup.originalUrl}`);
          return await processGenericFile('document');
        }
        
        // 3.6 XỬ LÝ SPREADSHEET FILE
        async function processSpreadsheetFile() {
          console.log(`📊 Xử lý FILE BẢNG TÍNH: ${urlGroup.originalUrl}`);
          return await processGenericFile('spreadsheet');
        }
        
        // 3.7 XỬ LÝ PRESENTATION FILE
        async function processPresentationFile() {
          console.log(`🎞️ Xử lý FILE TRÌNH CHIẾU: ${urlGroup.originalUrl}`);
          return await processGenericFile('presentation');
        }
        
        // 3.8 XỬ LÝ AUDIO FILE
        async function processAudioFile() {
          console.log(`🎵 Xử lý FILE ÂM THANH: ${urlGroup.originalUrl}`);
          return await processGenericFile('audio');
        }
        
        // 3.9 XỬ LÝ CÁC LOẠI FILE KHÁC
        async function processGenericFile(specificCategory = 'other') {
          console.log(`📦 Xử lý FILE KHÁC (${specificCategory}): ${urlGroup.originalUrl}`);
          
          try {
            if (!fileId) {
              throw new Error(`Không có file ID hợp lệ để xử lý file ${specificCategory}`);
            }
            
            console.log(`📤 Sao chép file ${specificCategory} với fileId: ${fileId}`);
            
            // Tạo URL đơn giản từ fileId thay vì sử dụng URL phức tạp
            const simpleUrl = `https://drive.google.com/file/d/${fileId}/view`;
            
            // Sử dụng API process-and-replace nhưng với cờ skipProcessing để chỉ tải xuống và upload lại
            const processResponse = await fetch(`${baseUrl}/api/drive/process-and-replace`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Cookie': cookie // Chuyển tiếp cookie để duy trì phiên đăng nhập
              },
              body: JSON.stringify({
                fileId: fileId, // Ưu tiên sử dụng fileId trực tiếp
                url: simpleUrl, // Cung cấp URL đơn giản như backup
                fileType: fileType,
                targetFolderId: "1Lt10aHyWp9VtPaImzInE0DmIcbrjJgpN", // Folder mặc định
                skipProcessing: true, // Chỉ tải xuống và upload lại, không xử lý
                courseName: firstSheetName
              })
            });
            
            // Xử lý phản hồi tương tự PDF
            if (!processResponse.ok) {
              let errorText = await processResponse.text();
              try {
                const errorJson = JSON.parse(errorText);
                errorText = errorJson.error || errorJson.message || errorText;
              } catch (e) { /* Không phải JSON */ }
              
              console.error(`❌ Lỗi từ API khi xử lý file ${specificCategory}: ${errorText}`);
              return {
                success: true,
                keepOriginalUrl: true,
                urlGroup,
                newUrl: urlGroup.originalUrl,
                error: errorText,
                processResult: null,
                fileType: fileType,
                fileCategory: specificCategory
              };
            }
            
            const processResultJson = await processResponse.json();
            
            // Log chi tiết về processedFile để debug
            if (processResultJson && processResultJson.processedFile) {
              console.log(`📄 Chi tiết file ${specificCategory} đã xử lý:
- ID: ${processResultJson.processedFile.id || 'không có'}
- Tên: ${processResultJson.processedFile.name || 'không có'}
- Link: ${processResultJson.processedFile.link || 'không có'}
- webViewLink: ${processResultJson.processedFile.webViewLink || 'không có'}
- webContentLink: ${processResultJson.processedFile.webContentLink || 'không có'}
`);
            }
            
            // Kiểm tra kết quả
            if (!processResultJson || processResultJson.error || !processResultJson.processedFile) {
              const errorMessage = processResultJson?.error || 'Không nhận được kết quả xử lý hợp lệ';
              console.error(`❌ Lỗi từ kết quả API: ${errorMessage}`);
              return {
                success: true,
                keepOriginalUrl: true,
                urlGroup,
                newUrl: urlGroup.originalUrl,
                error: errorMessage,
                processResult: processResultJson,
                fileType: fileType,
                fileCategory: specificCategory
              };
            }
            
            // Kiểm tra nếu không có link mới
            if (!processResultJson.processedFile.webViewLink && 
                !processResultJson.processedFile.webContentLink && 
                !processResultJson.processedFile.link) {
              console.error(`❌ Không nhận được URL mới sau khi xử lý file ${specificCategory}: ${urlGroup.originalUrl}`);
              return {
                success: true,
                keepOriginalUrl: true,
                urlGroup,
                newUrl: urlGroup.originalUrl,
                error: "Không nhận được URL mới sau khi xử lý",
                processResult: processResultJson,
                fileType: fileType,
                fileCategory: specificCategory
              };
            }
            
            // Lấy URL mới từ kết quả - ưu tiên theo thứ tự: link, webContentLink, webViewLink
            const newUrl = processResultJson.processedFile.link || 
                          processResultJson.processedFile.webContentLink || 
                          processResultJson.processedFile.webViewLink || 
                          urlGroup.originalUrl;
            
            console.log(`✅ File ${specificCategory} đã được xử lý thành công: ${newUrl}`);
            
            return {
              success: true,
              urlGroup,
              newUrl,
              processResult: processResultJson.processedFile,
              fileType: processResultJson.mimeType || fileType,
              fileCategory: specificCategory,
              skipped: processResultJson.skipped || false
            };
          } catch (error) {
            console.error(`❌ Lỗi khi xử lý file ${specificCategory}: ${error.message}`);
            
            return {
              success: true,
              keepOriginalUrl: true,
              urlGroup,
              newUrl: urlGroup.originalUrl,
              error: `Lỗi xử lý file ${specificCategory}: ${error.message}`,
              processResult: null,
              fileType: fileType,
              fileCategory: specificCategory
            };
          }
        }
      } catch (error) {
        console.error(`❌ Lỗi khi xử lý URL: ${urlGroup.originalUrl}:`, error);
        return {
          success: false,
          urlGroup,
          error: error.message || 'Lỗi không xác định',
          keepOriginalUrl: true
        };
      }
    }
    
    /**
     * Phân loại file dựa vào MIME type hoặc đường dẫn
     * @param {string} mimeType - MIME type của file (nếu có)
     * @param {string} url - URL của file
     * @returns {{type: string, description: string}} - Loại file và mô tả
     */
    function categorizeFile(mimeType, url) {
      // Xác định từ URL nếu không có MIME type
      if (!mimeType || mimeType === 'application/octet-stream') {
        const lowerUrl = url.toLowerCase();
        
        // Xác định loại từ phần mở rộng trong URL
        if (lowerUrl.match(/\.(mp4|avi|mov|wmv|flv|mkv|webm)($|\?)/)) {
          return { type: 'video', description: 'Video file (từ URL)' };
        } else if (lowerUrl.match(/\.(pdf)($|\?)/)) {
          return { type: 'pdf', description: 'PDF file (từ URL)' };
        } else if (lowerUrl.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp|tiff)($|\?)/)) {
          return { type: 'image', description: 'Image file (từ URL)' };
        } else if (lowerUrl.match(/\.(doc|docx|odt|rtf|txt)($|\?)/)) {
          return { type: 'document', description: 'Document file (từ URL)' };
        } else if (lowerUrl.match(/\.(xls|xlsx|ods|csv)($|\?)/)) {
          return { type: 'spreadsheet', description: 'Spreadsheet file (từ URL)' };
        } else if (lowerUrl.match(/\.(ppt|pptx|odp)($|\?)/)) {
          return { type: 'presentation', description: 'Presentation file (từ URL)' };
        } else if (lowerUrl.match(/\.(mp3|wav|ogg|flac|aac|m4a)($|\?)/)) {
          return { type: 'audio', description: 'Audio file (từ URL)' };
        } else if (lowerUrl.match(/\.(zip|rar|7z|tar|gz)($|\?)/)) {
          return { type: 'archive', description: 'Archive file (từ URL)' };
        }
        
        // Mặc định
        return { type: 'other', description: 'Không xác định được loại (từ URL)' };
      }
      
      // Xác định từ MIME type
      const lowerMime = mimeType.toLowerCase();
      
      // Phân loại theo MIME
      if (lowerMime === 'application/vnd.google-apps.folder') {
        return { type: 'folder', description: 'Google Drive Folder' };
      } else if (lowerMime.includes('pdf')) {
        return { type: 'pdf', description: 'PDF document' };
      } else if (lowerMime.startsWith('video/') || lowerMime.includes('video')) {
        return { type: 'video', description: 'Video file' };
      } else if (lowerMime.startsWith('image/') || lowerMime.includes('image')) {
        return { type: 'image', description: 'Image file' };
      } else if (lowerMime.startsWith('audio/') || lowerMime.includes('audio')) {
        return { type: 'audio', description: 'Audio file' };
      } else if (
        lowerMime.includes('spreadsheet') || 
        lowerMime.includes('excel') || 
        lowerMime.includes('csv') ||
        lowerMime === 'application/vnd.google-apps.spreadsheet'
      ) {
        return { type: 'spreadsheet', description: 'Spreadsheet file' };
      } else if (
        lowerMime.includes('presentation') || 
        lowerMime.includes('powerpoint') ||
        lowerMime === 'application/vnd.google-apps.presentation'
      ) {
        return { type: 'presentation', description: 'Presentation file' };
      } else if (
        lowerMime.includes('document') || 
        lowerMime.includes('word') || 
        lowerMime.includes('text/') ||
        lowerMime === 'application/vnd.google-apps.document'
      ) {
        return { type: 'document', description: 'Document file' };
      } else if (lowerMime.includes('zip') || lowerMime.includes('compressed')) {
        return { type: 'archive', description: 'Archive file' };
      }
      
      // Mặc định
      return { type: 'other', description: `Loại khác: ${mimeType}` };
    }
    
    // Thay đổi cách gọi hàm processUrlGroup
    for (let i = 0; i < urlGroupsArray.length; i += BATCH_SIZE) {
      const batch = urlGroupsArray.slice(i, i + BATCH_SIZE);
      console.log(`Xử lý batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(urlGroupsArray.length / BATCH_SIZE)}, kích thước: ${batch.length}`);
      
      // Sử dụng Promise.all để xử lý song song các URL trong batch
      const batchResults = await Promise.all(
        batch.map((urlGroup, index) => processUrlGroup(urlGroup, i + index))
      );
      
      // Xử lý kết quả của batch
      for (const result of batchResults) {
        // Kiểm tra xem kết quả có tồn tại và thành công không
        if (!result || !result.success || result.error) {
          // Xử lý lỗi cho tất cả các ô trong nhóm
          if (result && result.urlGroup && result.urlGroup.cells) {
            const urlGroup = result.urlGroup;
            const errorMessage = result.error ? (result.error.message || result.error.toString()) : 'Lỗi không xác định';
            
            console.log(`❌ Lỗi xử lý URL: ${urlGroup.originalUrl}`);
            console.log(`❌ Chi tiết lỗi: ${errorMessage}`);
            console.log(`✋ Không cập nhật sheet do gặp lỗi`);
            
            for (const cellInfo of urlGroup.cells) {
              // Ghi nhận lỗi nhưng không cập nhật ô trong sheet
              errors.push({
                rowIndex: cellInfo.rowIndex,
                colIndex: cellInfo.colIndex,
                url: cellInfo.url,
                error: `Lỗi xử lý: ${errorMessage}`,
                timestamp: new Date().toISOString(),
                sharedWithCells: urlGroup.cells.length - 1,
                noChangeMade: true // Đánh dấu là không thay đổi gì trong sheet
              });
            }
          }
          continue; // Bỏ qua phần còn lại và chuyển sang kết quả tiếp theo
        }
        
        const { urlGroup, newUrl, processResult } = result;
        const fileType = result.fileType || 'pdf'; // Lấy fileType nếu có, mặc định là pdf
        
        console.log(`Xử lý kết quả cho URL: ${urlGroup.originalUrl}, loại file: ${fileType}`);
        
        // Kiểm tra thêm các điều kiện lỗi khác
        if (result.keepOriginalUrl || 
            (processResult && !processResult.success) || 
            (!newUrl || newUrl === urlGroup.originalUrl)) {
          
          console.log(`Giữ nguyên URL gốc do gặp lỗi: ${result.error || 'Không xác định'}`);
          console.log(`Không thay đổi bất kỳ điều gì trong sheet khi gặp lỗi`);
          
          // Chỉ ghi log lỗi, không cập nhật sheet
          for (const cellInfo of urlGroup.cells) {
            console.log(`Bỏ qua cập nhật ô [${cellInfo.rowIndex + 1}:${cellInfo.colIndex + 1}] do lỗi: ${result.error || 'Không xác định'}`);
            
            // Thêm vào mảng errors để báo cáo
            errors.push({
              rowIndex: cellInfo.rowIndex,
              colIndex: cellInfo.colIndex,
              url: cellInfo.url,
              error: `Lỗi xử lý: ${result.error || 'Không xác định'}`,
              timestamp: new Date().toISOString(),
              sharedWithCells: urlGroup.cells.length - 1,
              noChangeMade: true // Đánh dấu là không thay đổi gì trong sheet
            });
          }
          
          continue; // Chuyển sang kết quả tiếp theo
        }
          
        // Cập nhật tất cả các ô trong nhóm
        for (const cellInfo of urlGroup.cells) {
          try {
            console.log(`Cập nhật ô [${cellInfo.rowIndex + 1}:${cellInfo.colIndex + 1}] trong sheet...`);
            console.log(`URL gốc: ${urlGroup.originalUrl}`);
            console.log(`URL mới: ${newUrl}`);
            console.log(`Loại file: ${fileType}, Là folder: ${result.isFolder ? 'Có' : 'Không'}`);
            
            // Lấy thời gian hiện tại để ghi chú
            const currentTime = new Date().toLocaleString('vi-VN');
            
            // Sử dụng batchUpdate để cập nhật cả giá trị và định dạng hyperlink với màu nổi bật
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId: sheet.sheetId,
              requestBody: {
                requests: [
                  {
                    updateCells: {
                      range: {
                        sheetId: actualSheetId, // Sử dụng sheetId thực tế
                        startRowIndex: cellInfo.rowIndex,
                        endRowIndex: cellInfo.rowIndex + 1,
                        startColumnIndex: cellInfo.colIndex,
                        endColumnIndex: cellInfo.colIndex + 1
                      },
                      rows: [
                        {
                          values: [
                            {
                              userEnteredValue: {
                                stringValue: cellInfo.cell // Giữ nguyên text hiển thị
                              },
                              userEnteredFormat: {
                                backgroundColor: {
                                  red: 0.9,
                                  green: 0.6,  // Màu xanh dương nổi bật
                                  blue: 1.0
                                },
                                textFormat: {
                                  link: { uri: newUrl },
                                  foregroundColor: { 
                                    red: 0.0,
                                    green: 0.0,
                                    blue: 0.7  // Chữ màu xanh đậm
                                  },
                                  bold: true  // In đậm text
                                }
                              },
                              note: `Link gốc: ${urlGroup.originalUrl}\nĐã xử lý lúc: ${currentTime}`
                            }
                          ]
                        }
                      ],
                      fields: 'userEnteredValue,userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.link,userEnteredFormat.textFormat.foregroundColor,userEnteredFormat.textFormat.bold,note'
                    }
                  }
                ]
              }
            });
            console.log(`Đã cập nhật ô thành công với batchUpdate`);
          } catch (batchUpdateError) {
            console.error('Lỗi khi sử dụng batchUpdate, thử phương pháp thay thế:', batchUpdateError);
            
            // Phương pháp thay thế sử dụng values.update
            const newCellValue = createHyperlinkFormula(cellInfo.cell, newUrl);
            console.log(`Thử phương pháp thay thế với values.update, giá trị mới: ${newCellValue}`);
            
            // Cập nhật giá trị ô
            await sheets.spreadsheets.values.update({
              spreadsheetId: sheet.sheetId,
              range: `${apiSheetName}!${String.fromCharCode(65 + cellInfo.colIndex)}${cellInfo.rowIndex + 1}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: [[newCellValue]]
              }
            });
            
            // Thêm ghi chú sau khi cập nhật giá trị
            try {
              const currentTime = new Date().toLocaleString('vi-VN');
              await sheets.spreadsheets.batchUpdate({
                spreadsheetId: sheet.sheetId,
                requestBody: {
                  requests: [{
                    updateCells: {
                      range: {
                        sheetId: actualSheetId,
                        startRowIndex: cellInfo.rowIndex,
                        endRowIndex: cellInfo.rowIndex + 1,
                        startColumnIndex: cellInfo.colIndex,
                        endColumnIndex: cellInfo.colIndex + 1
                      },
                      rows: [{
                        values: [{
                          note: `Link gốc: ${urlGroup.originalUrl}\nĐã xử lý lúc: ${currentTime}`
                        }]
                      }],
                      fields: 'note'
                    }
                  }]
                }
              });
              console.log(`Đã thêm ghi chú cho ô`);
            } catch (noteError) {
              console.error(`Không thể thêm ghi chú:`, noteError);
            }
            
            console.log(`Đã cập nhật ô thành công với values.update`);
          }
          
          // Thêm vào mảng kết quả
          processedCells.push({
            rowIndex: cellInfo.rowIndex,
            colIndex: cellInfo.colIndex,
            originalUrl: cellInfo.url,
            newUrl: newUrl,
            duplicatesDeleted: result.processResult?.duplicatesDeleted || 0,
            sharedWithCells: urlGroup.cells.length - 1 // Số ô khác có cùng URL
          });
          
          console.log(`✅ Đã xử lý và cập nhật ô [${cellInfo.rowIndex + 1}:${cellInfo.colIndex + 1}] thành công`);
        }
      }
      
      // Đợi một khoảng thời gian ngắn giữa các batch để tránh quá tải API
      if (i + BATCH_SIZE < urlGroupsArray.length) {
        console.log(`Đợi 3 giây trước khi xử lý batch tiếp theo...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log(`\n===== KẾT QUẢ XỬ LÝ LINK =====`);
    console.log(`Tổng số ô chứa link: ${cellsToProcess.length}`);
    console.log(`Số link duy nhất: ${Object.keys(urlGroups).length}`);
    console.log(`Đã xử lý thành công: ${processedCells.length}`);
    console.log(`Thất bại: ${errors.length}`);
    
    return NextResponse.json({
      success: true,
      totalCells: cellsToProcess.length,
      uniqueLinks: Object.keys(urlGroups).length,
      processed: processedCells.length,
      failed: errors.length,
      processedCells,
      errors,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Lỗi khi xử lý tất cả link trong sheet:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Lỗi khi xử lý tất cả link trong sheet: ${error.message}` 
      },
      { status: 500 }
    );
  }
} 