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
  processLink 
} from '@/utils/drive-utils';

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
        // Instead of using the spreadsheets API that opens Chrome,
        // we'll use the Sheets API to get hyperlinks directly
        const spreadsheetData = await sheets.spreadsheets.get({
          spreadsheetId: sheet.sheetId,
          ranges: [`${firstSheetName}!A:Z`],
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
    
    // Xử lý tuần tự từng nhóm link thay vì từng ô riêng lẻ
    console.log(`Bắt đầu xử lý tuần tự ${Object.keys(urlGroups).length} link duy nhất...`);
    
    for (const fileId of Object.keys(urlGroups)) {
      const urlGroup = urlGroups[fileId];
      const firstCell = urlGroup.cells[0]; // Lấy ô đầu tiên để hiển thị thông tin
      
      try {
        console.log(`\n===== Đang xử lý URL: ${urlGroup.originalUrl} (${urlGroup.cells.length} ô) =====`);
        
        // Sử dụng hàm processLink với retry và timeout
        const processResult = await processLink(baseUrl, urlGroup.originalUrl, cookie, 2, 90000); // 90 giây timeout, 2 lần retry
        
        // Tạo giá trị mới cho ô
        const newUrl = processResult.processedLink;
        console.log(`Đã xử lý thành công, URL mới: ${newUrl}`);
        
        // Cập nhật tất cả các ô trong nhóm
        for (const cellInfo of urlGroup.cells) {
          try {
            console.log(`Cập nhật ô [${cellInfo.rowIndex + 1}:${cellInfo.colIndex + 1}] trong sheet...`);
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
              range: `${firstSheetName}!${String.fromCharCode(65 + cellInfo.colIndex)}${cellInfo.rowIndex + 1}`,
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
        
        // Đợi một khoảng thời gian ngắn giữa các yêu cầu để tránh quá tải API
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Lỗi khi xử lý URL: ${urlGroup.originalUrl}:`, error);
        
        // Xử lý lỗi cho tất cả các ô trong nhóm
        for (const cellInfo of urlGroup.cells) {
          // Kiểm tra loại lỗi để hiển thị thông báo phù hợp
          let errorMessage = error.message;
          
          // Thêm thông tin về vị trí ô vào thông báo lỗi
          errorMessage = `Ô [${cellInfo.rowIndex + 1}:${cellInfo.colIndex + 1}]: ${errorMessage}`;
          
          // Xử lý các loại lỗi phổ biến
          if (error.message.includes('Không có quyền truy cập') || error.message.includes('Không có quyền tải xuống')) {
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
        
        // Đợi một khoảng thời gian ngắn trước khi tiếp tục sau lỗi
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