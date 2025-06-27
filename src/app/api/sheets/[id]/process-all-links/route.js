import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { connectDB } from '@/lib/mongodb';
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
    await connectDB();
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
                  
                  htmlData.values[rowIndex].values[colIndex] = {
                    hyperlink: hyperlink
                  };
                });
              }
            });
          }
          
          console.log('Đã lấy được dữ liệu hyperlink từ Google Sheets API');
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
    const BATCH_SIZE = 10;
    
    // Thay đổi hàm processUrlGroup thành async
    async function processUrlGroup(urlGroup, index) {
      const firstCell = urlGroup.cells[0];
      try {
        console.log(`\n===== Đang xử lý URL: ${urlGroup.originalUrl} (${urlGroup.cells.length} ô) =====`);
        
        // Xác định loại file từ URL hoặc tên file
        let fileType = 'pdf'; // Mặc định là PDF
        let isFolder = false; // Flag để đánh dấu nếu là folder
        
        try {
          // Trích xuất file ID để lấy thông tin file
          let fileId;
          try {
            const extracted = extractDriveFileId(urlGroup.originalUrl);
            if (!extracted || !extracted.fileId) {
              throw new Error('Không thể trích xuất ID file từ URL');
            }
            fileId = extracted.fileId;
            console.log(`Đã trích xuất file ID: ${fileId}`);
          } catch (extractError) {
            console.warn(`Không thể trích xuất ID file: ${extractError.message}`);
            // Nếu không trích xuất được ID, thử xác định loại file từ phần mở rộng
            fileType = determineFileTypeFromExtension(urlGroup.originalUrl);
            console.log(`Xác định loại file từ phần mở rộng: ${fileType}`);
            
            // Nếu URL có dấu hiệu là folder, đánh dấu là folder
            const url = urlGroup.originalUrl.toLowerCase();
            if (url.includes('drive.google.com/drive/folders/') || 
                url.includes('drive.google.com/drive/u/0/folders/') ||
                url.includes('drive.google.com/drive/my-drive/folders/') ||
                url.includes('drive.google.com/folders/')) {
              console.log('Phát hiện link là folder Google Drive từ URL');
              isFolder = true;
              fileType = 'folder';
            }
            
            // Trả về sớm vì không thể sử dụng API
            return continueProcessing();
          }
          
          // Lấy thông tin file từ Drive API để xác định loại file
          // Sử dụng token tải xuống thay vì credentials
          try {
            // Import hàm getTokenByType từ utils
            const { getTokenByType } = await import('@/app/api/drive/remove-watermark/lib/utils.js');
            
            // Lấy token tải xuống
            const downloadToken = getTokenByType('download');
            if (!downloadToken) {
              console.error('Không tìm thấy token Google Drive tải xuống');
              throw new Error('Không tìm thấy token Google Drive tải xuống');
            }
            
            console.log('Sử dụng xác thực từ token tải xuống');
            
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
              fields: 'mimeType,name',
              supportsAllDrives: true,
              includeItemsFromAllDrives: true
            });
            
            if (fileMetadata.data && fileMetadata.data.mimeType) {
              fileType = fileMetadata.data.mimeType;
              
              // Kiểm tra xem có phải là folder không
              if (fileMetadata.data.mimeType === 'application/vnd.google-apps.folder') {
                console.log(`Phát hiện file là folder: ${fileMetadata.data.name || 'không có tên'}`);
                isFolder = true;
                fileType = 'folder';
              } else {
                console.log(`Đã xác định loại file từ Drive API (sử dụng token): ${fileType} (${fileMetadata.data.name || 'không có tên'})`);
              }
            } else {
              console.log('Không thể lấy thông tin MIME type từ Drive API, sử dụng mặc định là PDF');
              fileType = determineFileTypeFromExtension(urlGroup.originalUrl);
            }
          } catch (driveApiError) {
            console.warn(`Lỗi khi truy vấn Drive API: ${driveApiError.message}`);
            console.log('Thử xác định loại file từ phần mở rộng...');
            fileType = determineFileTypeFromExtension(urlGroup.originalUrl);
          }
        } catch (error) {
          console.warn(`Lỗi khi xác định loại file: ${error.message}`);
          console.log('Sử dụng loại file mặc định là PDF');
        }
        
        return continueProcessing();
        
        // Thêm từ khóa async vào hàm continueProcessing
        async function continueProcessing() {
          console.log(`Loại file cuối cùng được xác định: ${fileType}, là folder: ${isFolder}`);
          
          // Nếu là folder, xử lý đệ quy folder
          if (isFolder) {
            console.log(`Phát hiện link là folder, tiến hành xử lý đệ quy: ${urlGroup.originalUrl}`);
            console.log(`Sẽ lưu vào thư mục cha có tên: ${firstSheetName}`);
            
            // Xử lý đệ quy folder, truyền tên sheet làm tên thư mục cha
            return processRecursiveFolder(urlGroup.originalUrl, 3, 0, null, 0.15, firstSheetName)
              .then(folderResult => {
                console.log(`Đã xử lý folder đệ quy thành công: ${urlGroup.originalUrl}`);
                console.log(`Số file đã xử lý: ${folderResult.nestedFilesProcessed}, số folder đã xử lý: ${folderResult.nestedFoldersProcessed}`);
                
                // Lấy link folder đã xử lý
                const processedFolderLink = folderResult.folderStructure.processedFolderLink || urlGroup.originalUrl;
                console.log(`Link folder đã xử lý: ${processedFolderLink}`);
                
                // Trả về kết quả xử lý folder
                return {
                  success: true,
                  urlGroup,
                  newUrl: processedFolderLink, // Đảm bảo sử dụng link folder đã xử lý
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
                console.error(`Lỗi khi xử lý folder đệ quy: ${folderError.message}`);
                // Nếu lỗi, vẫn trả về URL gốc
                return {
                  success: true,
                  urlGroup,
                  newUrl: urlGroup.originalUrl,
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
          
          // Xác định xem có phải là file video không
          const isVideoFile = fileType && (
            fileType.includes('video/') || 
            fileType.includes('mp4') || 
            fileType.includes('avi') || 
            fileType.includes('mov') ||
            fileType.includes('mkv') ||
            fileType.includes('webm')
          );
          
          // Xác định xem có phải là file audio không
          const isAudioFile = fileType && (
            fileType.includes('audio/') || 
            fileType.includes('mp3') || 
            fileType.includes('wav') || 
            fileType.includes('ogg')
          );
          
          // Xác định xem có phải là file hình ảnh không
          const isImageFile = fileType && (
            fileType.includes('image/') || 
            fileType.includes('jpg') || 
            fileType.includes('jpeg') || 
            fileType.includes('png') || 
            fileType.includes('gif')
          );
          
          // Log loại file được phát hiện
          if (isVideoFile) {
            console.log(`Phát hiện file video: ${fileType}`);
          } else if (isAudioFile) {
            console.log(`Phát hiện file audio: ${fileType}`);
          } else if (isImageFile) {
            console.log(`Phát hiện file hình ảnh: ${fileType}`);
          }
          
          // Thay đổi đoạn code gọi API process-and-replace
          try {
            console.log(`Gọi API process-and-replace cho URL: ${urlGroup.originalUrl}`);
            
            // Sử dụng URL đầy đủ cho API endpoint
            const apiUrl = `${protocol}://${host}/api/drive/process-and-replace`;
                          
            console.log(`Sử dụng API URL: ${apiUrl}`);
            
            // Chuẩn bị thông tin để tạo cấu trúc thư mục với tên sheet
            const isSheetDocument = true; // Đánh dấu là tài liệu sheet
            const sheetName = firstSheetName; // Sử dụng tên sheet làm tên thư mục
            
            console.log(`Đang cấu hình để lưu vào thư mục có tên sheet: "${sheetName}"`);
            
            // Thêm logic retry cho fetch
            const MAX_RETRIES = 5; // Tăng số lần retry từ 3 lên 5
            let lastError = null;
            let processResultJson = null;
            
            for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
              try {
                if (retryCount > 0) {
                  console.log(`Thử lại lần ${retryCount}/${MAX_RETRIES} cho URL: ${urlGroup.originalUrl}`);
                  // Tăng thời gian chờ giữa các lần retry (tối thiểu 3 giây, tối đa 30 giây)
                  const delayTime = Math.min(Math.pow(2, retryCount) * 1500, 30000);
                  console.log(`Đợi ${delayTime/1000} giây trước khi thử lại...`);
                  await new Promise(resolve => setTimeout(resolve, delayTime));
                }
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 580000); // Timeout 180 giây (3 phút) cho mỗi request
                
                try {
                  const processResult = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Cookie': cookie // Truyền cookie để duy trì phiên đăng nhập
                    },
                    body: JSON.stringify({
                      driveLink: urlGroup.originalUrl,
                      folderId: "1Lt10aHyWp9VtPaImzInE0DmIcbrjJgpN", // Sử dụng folder mặc định nếu không có folder ID
                      apiKey: requestBody.apiKey || null,
                      courseName: sheetName, // Sử dụng tên sheet trực tiếp làm tên thư mục
                      // Thêm cấu hình cho thư mục
                      isSheetDocument: isSheetDocument,
                      sheetName: sheetName,
                      useSheetNameDirectly: true, // Đánh dấu sử dụng trực tiếp tên sheet làm thư mục
                      // Thêm các thông tin để cập nhật sheet
                      updateSheet: true,
                      sheetId: sheet.sheetId,
                      googleSheetName: apiSheetName, // Sử dụng apiSheetName cho việc cập nhật dữ liệu
                      rowIndex: firstCell.rowIndex,
                      cellIndex: firstCell.colIndex,
                      displayText: firstCell.cell // Giữ nguyên text hiển thị
                    }),
                    signal: controller.signal // Thêm signal để có thể abort request
                  });
                  
                  // Xóa timeout sau khi request hoàn thành
                  clearTimeout(timeoutId);
                  
                  processResultJson = await processResult.json();
                  // Nếu thành công, thoát khỏi vòng lặp retry
                  break;
                } catch (abortError) {
                  // Xóa timeout nếu có lỗi
                  clearTimeout(timeoutId);
                  
                  // Kiểm tra nếu là lỗi abort (timeout)
                  if (abortError.name === 'AbortError') {
                    console.error(`Request timeout sau 180 giây cho URL: ${urlGroup.originalUrl}`);
                    throw new Error('Request timeout sau 180 giây');
                  }
                  
                  // Ném lại lỗi khác
                  throw abortError;
                }
              } catch (fetchError) {
                lastError = fetchError;
                console.error(`Lỗi fetch lần ${retryCount + 1}/${MAX_RETRIES + 1}: ${fetchError.message}`);
                
                // Nếu đã thử lại đủ số lần, ném lỗi
                if (retryCount === MAX_RETRIES) {
                  throw new Error(`Fetch failed sau ${MAX_RETRIES + 1} lần thử: ${fetchError.message}`);
                }
              }
            }
            
            // Kiểm tra kết quả xử lý và cập nhật sheet
            if (!processResultJson || !processResultJson.success) {
              const errorMessage = processResultJson?.error || 'Lỗi không xác định khi xử lý file';
              console.error(`Lỗi khi xử lý URL: ${urlGroup.originalUrl}`, errorMessage);
              errors.push({
                url: urlGroup.originalUrl,
                error: errorMessage
              });
              return {
                success: false,
                urlGroup,
                error: errorMessage
              };
            }

            // Lấy URL mới từ kết quả, kiểm tra xem có phải là folder không
            let newUrl;
            if (processResultJson.isFolder) {
              console.log(`Kết quả là folder, kiểm tra các link có sẵn...`);
              
              // Log chi tiết về kết quả xử lý folder
              console.log('Chi tiết kết quả xử lý folder:', {
                isFolder: processResultJson.isFolder,
                targetFolder: processResultJson.targetFolder,
                processedFile: processResultJson.processedFile,
                filesCount: processResultJson.files?.length || 0
              });
              
              // Kiểm tra cấu trúc thư mục và tìm folder con phù hợp
              if (processResultJson.files && processResultJson.files.length > 0) {
                console.log(`Phát hiện ${processResultJson.files.length} files/folders trong kết quả`);
                
                // Log chi tiết về các files/folders
                processResultJson.files.forEach((item, idx) => {
                  console.log(`File/Folder #${idx}: ${item.name}, type: ${item.type}, link: ${item.link || 'không có link'}, newFileId: ${item.newFileId || 'không có'}`);
                });
                
                // Tìm folder con
                const processedSubfolder = processResultJson.files.find(f => f.type === 'folder');
                if (processedSubfolder && processedSubfolder.link) {
                  console.log(`Phát hiện folder con đã xử lý, sử dụng link folder con: ${processedSubfolder.link}`);
                  newUrl = processedSubfolder.link;
                } else {
                  // Nếu không có folder con, tìm file đầu tiên có link
                  const firstFileWithLink = processResultJson.files.find(f => f.link);
                  if (firstFileWithLink && firstFileWithLink.link) {
                    console.log(`Không tìm thấy folder con, sử dụng link từ file: ${firstFileWithLink.link}`);
                    newUrl = firstFileWithLink.link;
                  } else {
                    // Nếu không có file nào có link, sử dụng link folder đã xử lý
                    console.log(`Không tìm thấy file nào có link, sử dụng link folder đã xử lý: ${processResultJson.processedFile?.link}`);
                    newUrl = processResultJson.processedFile?.link;
                  }
                }
              } 
              // Nếu không có files array hoặc array rỗng
              else {
                // Ưu tiên sử dụng link từ processedFile
                if (processResultJson.processedFile && processResultJson.processedFile.link) {
                  console.log(`Sử dụng link từ processedFile: ${processResultJson.processedFile.link}`);
                  newUrl = processResultJson.processedFile.link;
                }
                // Nếu không có processedFile, tìm kiếm trong targetFolder
                else if (processResultJson.targetFolder && 
                    processResultJson.targetFolder.link && 
                    processResultJson.targetFolder.name && 
                    processResultJson.targetFolder.name !== 'Mặc định') {
                  console.log(`Sử dụng link từ targetFolder: ${processResultJson.targetFolder.link} (${processResultJson.targetFolder.name})`);
                  newUrl = processResultJson.targetFolder.link;
                }
                // Không tìm thấy link nào phù hợp
                else {
                  console.error(`Không tìm thấy link phù hợp trong kết quả xử lý folder`);
                  newUrl = null;
                }
              }
              
              console.log(`URL cuối cùng được chọn: ${newUrl || 'không có URL'}`);
            } else {
              console.log(`Kết quả là file, sử dụng link file đã xử lý: ${processResultJson.processedFile?.link}`);
              newUrl = processResultJson.processedFile?.link;
            }
              
            if (!newUrl) {
              console.error(`Không nhận được URL mới sau khi xử lý: ${urlGroup.originalUrl}`);
              errors.push({
                url: urlGroup.originalUrl,
                error: 'Không nhận được URL mới sau khi xử lý'
              });
              return {
                success: false,
                urlGroup,
                error: 'Không nhận được URL mới sau khi xử lý'
              };
            }

            // Kiểm tra kết quả cập nhật sheet
            if (processResultJson.sheetUpdate) {
              if (processResultJson.sheetUpdate.success) {
                console.log(`✅ Sheet đã được cập nhật tự động qua API`);
              } else {
                console.warn(`⚠️ Cập nhật sheet tự động thất bại: ${processResultJson.sheetUpdate.message}`);
                console.log(`Thử phương pháp thay thế để cập nhật sheet...`);
                
                // Sử dụng phương pháp thay thế nếu API không tự cập nhật được
                try {
                  // Thực hiện cập nhật thủ công nếu cần
                  console.log(`Cập nhật thủ công được bỏ qua vì sheet đã được xử lý bởi API`);
                } catch (manualUpdateError) {
                  console.error(`Không thể cập nhật sheet bằng phương pháp thay thế:`, manualUpdateError);
                  errors.push({
                    url: urlGroup.originalUrl,
                    error: 'Không thể cập nhật sheet bằng phương pháp thay thế'
                  });
                  return {
                    success: false,
                    urlGroup,
                    error: 'Không thể cập nhật sheet bằng phương pháp thay thế'
                  };
                }
              }
            }

            return {
              success: true,
              urlGroup,
              newUrl,
              processResult: processResultJson.processedFile,
              fileType,
              isFolder: false
            };
          } catch (apiError) {
            console.error(`Lỗi khi gọi API process-and-replace: ${apiError.message}`);
            errors.push({
              url: urlGroup.originalUrl,
              error: `Lỗi khi gọi API: ${apiError.message}`
            });
            return {
              success: false,
              urlGroup,
              error: apiError.message
            };
          }
        }
      } catch (error) {
        console.error(`❌ Lỗi khi xử lý URL: ${urlGroup.originalUrl}:`, error);
        return {
          success: false,
          urlGroup,
          error
        };
      }
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
        if (result && result.success) {
          const { urlGroup, newUrl, processResult } = result;
          const fileType = result.fileType || 'pdf'; // Lấy fileType nếu có, mặc định là pdf
          
          console.log(`Xử lý kết quả cho URL: ${urlGroup.originalUrl}, loại file: ${fileType}`);
          
          // Cập nhật tất cả các ô trong nhóm
          for (const cellInfo of urlGroup.cells) {
            try {
              console.log(`Cập nhật ô [${cellInfo.rowIndex + 1}:${cellInfo.colIndex + 1}] trong sheet...`);
              console.log(`URL gốc: ${urlGroup.originalUrl}`);
              console.log(`URL mới: ${newUrl}`);
              console.log(`Loại file: ${fileType}, Là folder: ${result.isFolder ? 'Có' : 'Không'}`);
              
              // Sử dụng batchUpdate để cập nhật cả giá trị và định dạng hyperlink
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
                                  textFormat: {
                                    link: { uri: newUrl }
                                  }
                                }
                              }
                            ]
                          }
                        ],
                        fields: 'userEnteredValue,userEnteredFormat.textFormat.link'
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
              await sheets.spreadsheets.values.update({
                spreadsheetId: sheet.sheetId,
                range: `${apiSheetName}!${String.fromCharCode(65 + cellInfo.colIndex)}${cellInfo.rowIndex + 1}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                  values: [[newCellValue]]
                }
              });
              console.log(`Đã cập nhật ô thành công với values.update`);
            }
            
            processedCells.push({
              rowIndex: cellInfo.rowIndex,
              colIndex: cellInfo.colIndex,
              originalUrl: cellInfo.url,
              newUrl: newUrl,
              duplicatesDeleted: processResult.duplicatesDeleted || 0,
              sharedWithCells: urlGroup.cells.length - 1 // Số ô khác có cùng URL
            });
            
            console.log(`✅ Đã xử lý và cập nhật ô [${cellInfo.rowIndex + 1}:${cellInfo.colIndex + 1}] thành công`);
          }
        } else {
          const { urlGroup, error } = result;
          
          // Xử lý lỗi cho tất cả các ô trong nhóm
          if (urlGroup && urlGroup.cells) {
            for (const cellInfo of urlGroup.cells) {
              // Kiểm tra loại lỗi để hiển thị thông báo phù hợp
              let errorMessage = error && error.message ? error.message : 'Lỗi không xác định';
              
              // Thêm thông tin về vị trí ô vào thông báo lỗi
              errorMessage = `Ô [${cellInfo.rowIndex + 1}:${cellInfo.colIndex + 1}]: ${errorMessage}`;
              
              // Xử lý các loại lỗi phổ biến
              if (error && error.message && (error.message.includes('Không có quyền truy cập') || error.message.includes('Không có quyền tải xuống'))) {
                // Thử cập nhật ô với thông báo lỗi
                try {
                  console.log(`Cập nhật ô với thông báo lỗi quyền truy cập...`);
                  
                  // Thêm comment vào ô để thông báo lỗi
                  await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: sheet.sheetId,
                    requestBody: {
                      requests: [
                        {
                          updateCells: {
                            range: {
                              sheetId: actualSheetId,
                              startRowIndex: cellInfo.rowIndex,
                              endRowIndex: cellInfo.rowIndex + 1,
                              startColumnIndex: cellInfo.colIndex,
                              endColumnIndex: cellInfo.colIndex + 1
                            },
                            rows: [
                              {
                                values: [
                                  {
                                    note: `Lỗi: Không có quyền truy cập file này. Vui lòng kiểm tra quyền chia sẻ của file.`
                                  }
                                ]
                              }
                            ],
                            fields: 'note'
                          }
                        }
                      ]
                    }
                  });
                  
                  console.log(`Đã thêm ghi chú lỗi vào ô [${cellInfo.rowIndex + 1}:${cellInfo.colIndex + 1}]`);
                } catch (commentError) {
                  console.error(`Không thể thêm ghi chú lỗi:`, commentError);
                }
              }
              
              errors.push({
                rowIndex: cellInfo.rowIndex,
                colIndex: cellInfo.colIndex,
                url: cellInfo.url,
                error: errorMessage,
                timestamp: new Date().toISOString(),
                sharedWithCells: urlGroup.cells.length - 1 // Số ô khác có cùng URL
              });
            }
          }
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