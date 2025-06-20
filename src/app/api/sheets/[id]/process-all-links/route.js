import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { connectDB } from '@/lib/mongodb';
import Sheet from '@/models/Sheet';
import { ObjectId } from 'mongodb';

// Function to get stored token from file
function getStoredToken(tokenPath) {
  try {
    if (fs.existsSync(tokenPath)) {
      const tokenContent = fs.readFileSync(tokenPath, 'utf8');
      
      try {
        const parsedToken = JSON.parse(tokenContent);
        return parsedToken;
      } catch (parseError) {
        console.error('Lỗi phân tích JSON token:', parseError);
        return null;
      }
    } else {
      console.error('File token không tồn tại tại đường dẫn:', tokenPath);
    }
  } catch (error) {
    console.error(`Lỗi đọc file token:`, error);
  }
  return null;
}

// Extract Drive file ID from URL
function extractDriveFileId(url) {
  if (!url) return null;
  
  console.log('Extracting Drive ID from URL:', url);
  
  // Mẫu URL Google Drive
  const patterns = [
    /\/d\/([a-zA-Z0-9-_]+)/,                // Format: /d/FILE_ID
    /id=([a-zA-Z0-9-_]+)/,                  // Format: id=FILE_ID
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/,  // Format: drive.google.com/file/d/FILE_ID
    /drive\.google\.com\/open\?id=([a-zA-Z0-9-_]+)/,  // Format: drive.google.com/open?id=FILE_ID
    /docs\.google\.com\/(?:document|presentation|spreadsheets)\/d\/([a-zA-Z0-9-_]+)/, // Google Docs/Slides/Sheets
    /^([a-zA-Z0-9-_]+)$/                    // Direct ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      console.log('Found Drive ID:', match[1], 'using pattern:', pattern);
      return match[1];
    }
  }
  
  console.log('No Drive ID found in URL');
  return null;
}

// Extract URL from cell content
function extractUrlFromCell(cell) {
  if (!cell || typeof cell !== 'string') return null;
  
  // Check for HYPERLINK formula
  const hyperlinkRegex = /=HYPERLINK\("([^"]+)"(?:,\s*"([^"]+)")?\)/i;
  const hyperlinkMatch = cell.match(hyperlinkRegex);
  if (hyperlinkMatch) {
    return hyperlinkMatch[1];
  }
  
  // Check if cell content is a URL
  const urlRegex = /(https?:\/\/[^\s"]+)/g;
  const urlMatch = cell.match(urlRegex);
  if (urlMatch) {
    return urlMatch[0];
  }
  
  return null;
}

// Check if a URL is a Google Drive URL
function isDriveUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  const driveDomains = [
    'drive.google.com',
    'docs.google.com',
    'sheets.google.com',
    'slides.google.com'
  ];
  
  // Check if URL contains any of the Google domains
  const containsDriveDomain = driveDomains.some(domain => url.includes(domain));
  
  // Check if URL contains file ID pattern
  const hasFileIdPattern = url.includes('/d/') || 
                          url.includes('id=') || 
                          url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
  
  return containsDriveDomain || hasFileIdPattern;
}

// Create HYPERLINK formula with the same text but new URL
function createHyperlinkFormula(originalCell, newUrl) {
  if (!originalCell || typeof originalCell !== 'string') return newUrl;
  
  const hyperlinkRegex = /=HYPERLINK\("([^"]+)"(?:,\s*"([^"]+)")?\)/i;
  const hyperlinkMatch = originalCell.match(hyperlinkRegex);
  
  if (hyperlinkMatch) {
    const displayText = hyperlinkMatch[2] || newUrl;
    return `=HYPERLINK("${newUrl}","${displayText}")`;
  }
  
  // If it was just a URL, return the new URL
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  if (originalCell.trim().match(urlRegex) && originalCell.trim().match(urlRegex)[0] === originalCell.trim()) {
    return newUrl;
  }
  
  // Otherwise create a new HYPERLINK formula
  return `=HYPERLINK("${newUrl}","${originalCell}")`;
}

export async function POST(request, { params }) {
  console.log('============== BẮT ĐẦU XỬ LÝ TẤT CẢ LINK TRONG SHEET ==============');
  
  try {
    await connectDB();
    const { id } = await params;
    const requestBody = await request.json();
    
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
    
    try {
      // First try to get spreadsheet metadata to find sheet names
      const spreadsheetInfo = await sheets.spreadsheets.get({
        spreadsheetId: sheet.sheetId
      });
      
      // Get the first sheet name or default to 'Sheet1'
      firstSheetName = spreadsheetInfo.data.sheets[0]?.properties?.title || 'Sheet1';
      // Lấy sheetId thực tế của sheet đầu tiên
      actualSheetId = spreadsheetInfo.data.sheets[0]?.properties?.sheetId || 0;
      console.log(`Tên sheet đầu tiên: ${firstSheetName}, SheetId: ${actualSheetId}`);
      
      // Now get the values using the actual sheet name
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheet.sheetId,
        range: `${firstSheetName}!A:Z`  // Use the actual sheet name
      });
      
      values = response.data.values;
      
      // Lấy thêm dữ liệu HTML để phát hiện hyperlink
      try {
        const htmlResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/spreadsheets/${sheet.sheetId}`, {
          headers: {
            'Cookie': request.headers.get('cookie') || ''
          }
        });
        
        if (htmlResponse.ok) {
          const htmlResult = await htmlResponse.json();
          if (htmlResult.success && htmlResult.data) {
            htmlData = htmlResult.data;
            console.log('Đã lấy được dữ liệu HTML của sheet');
          }
        }
      } catch (htmlError) {
        console.error('Lỗi khi lấy dữ liệu HTML:', htmlError);
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
    
    // Xử lý từng link
    const processedCells = [];
    const errors = [];
    
    for (const cellInfo of cellsToProcess) {
      try {
        console.log(`Đang xử lý ô [${cellInfo.rowIndex + 1}:${cellInfo.colIndex + 1}]: ${cellInfo.url}`);
        
        // Determine the base URL for API calls
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host');
        const baseUrl = `${protocol}://${host}`;
        
        // Gọi API xử lý và thay thế file
        const processResponse = await fetch(`${baseUrl}/api/drive/process-and-replace`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || ''
          },
          body: JSON.stringify({
            driveLink: cellInfo.url
          })
        });
        
        if (!processResponse.ok) {
          const errorData = await processResponse.json();
          throw new Error(errorData.error || 'Không thể xử lý file');
        }
        
        const processResult = await processResponse.json();
        
        if (!processResult.success) {
          throw new Error(processResult.error || 'Xử lý file thất bại');
        }
        
        // Tạo giá trị mới cho ô
        const newUrl = processResult.processedFile.link;
        
        try {
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
        } catch (batchUpdateError) {
          console.error('Lỗi khi sử dụng batchUpdate, thử phương pháp thay thế:', batchUpdateError);
          
          // Phương pháp thay thế sử dụng values.update
          const newCellValue = createHyperlinkFormula(cellInfo.cell, newUrl);
          await sheets.spreadsheets.values.update({
            spreadsheetId: sheet.sheetId,
            range: `${firstSheetName}!${String.fromCharCode(65 + cellInfo.colIndex)}${cellInfo.rowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[newCellValue]]
            }
          });
        }
        
        processedCells.push({
          rowIndex: cellInfo.rowIndex,
          colIndex: cellInfo.colIndex,
          originalUrl: cellInfo.url,
          newUrl: newUrl
        });
        
        console.log(`Đã xử lý và cập nhật ô [${cellInfo.rowIndex + 1}:${cellInfo.colIndex + 1}]`);
        
      } catch (error) {
        console.error(`Lỗi khi xử lý ô [${cellInfo.rowIndex + 1}:${cellInfo.colIndex + 1}]:`, error);
        errors.push({
          rowIndex: cellInfo.rowIndex,
          colIndex: cellInfo.colIndex,
          url: cellInfo.url,
          error: error.message
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      totalLinks: cellsToProcess.length,
      processed: processedCells.length,
      failed: errors.length,
      processedCells,
      errors
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