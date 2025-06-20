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
  
  const patterns = [
    /\/d\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/,
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/,
    /^([a-zA-Z0-9-_]+)$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Check if a URL is a Google Drive URL
function isDriveUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  return url.includes('drive.google.com') || 
         url.includes('docs.google.com') || 
         extractDriveFileId(url) !== null;
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
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urlMatch = cell.match(urlRegex);
  if (urlMatch) {
    return urlMatch[0];
  }
  
  return null;
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
    const { id } = params;
    const requestBody = await request.json();
    
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
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheet.sheetId,
      range: 'Sheet1'
    });
    
    const values = response.data.values;
    
    if (!values || values.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sheet không có dữ liệu' }, 
        { status: 404 }
      );
    }
    
    // Tìm tất cả các ô chứa link Google Drive
    const cellsToProcess = [];
    
    for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
      const row = values[rowIndex];
      
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const cell = row[colIndex];
        const url = extractUrlFromCell(cell);
        
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
    
    // Xử lý từng link
    const processedCells = [];
    const errors = [];
    
    for (const cellInfo of cellsToProcess) {
      try {
        console.log(`Đang xử lý ô [${cellInfo.rowIndex + 1}:${cellInfo.colIndex + 1}]: ${cellInfo.url}`);
        
        // Gọi API xử lý và thay thế file
        const processResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/drive/process-and-replace`, {
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
        const newCellValue = createHyperlinkFormula(cellInfo.cell, newUrl);
        
        // Cập nhật vào Google Sheets
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheet.sheetId,
          range: `Sheet1!${String.fromCharCode(65 + cellInfo.colIndex)}${cellInfo.rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[newCellValue]]
          }
        });
        
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