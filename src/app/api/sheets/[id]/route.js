import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Hàm làm sạch URL từ Google Sheets
function cleanGoogleUrl(url) {
  if (!url) return url;
  
  // Xử lý URL chuyển hướng từ Google
  if (url.startsWith('https://www.google.com/url?q=')) {
    try {
      // Trích xuất URL từ tham số q
      const urlObj = new URL(url);
      const redirectUrl = urlObj.searchParams.get('q');
      if (redirectUrl) {
        // Giải mã URL (Google thường mã hóa URL hai lần)
        let decodedUrl = redirectUrl;
        try {
          decodedUrl = decodeURIComponent(redirectUrl);
        } catch (e) {
          console.error('Lỗi khi giải mã URL:', e);
        }
        
        // Xóa các tham số không cần thiết từ Google
        const cleanUrlObj = new URL(decodedUrl);
        ['sa', 'source', 'usg', 'ust'].forEach(param => {
          cleanUrlObj.searchParams.delete(param);
        });
        
        return cleanUrlObj.toString();
      }
    } catch (err) {
      console.error('Lỗi khi xử lý URL chuyển hướng:', err);
    }
  }
  
  // Xử lý các URL đặc biệt khác
  try {
    const urlObj = new URL(url);
    
    // Xử lý YouTube
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      // Giữ lại chỉ các tham số cần thiết cho YouTube
      const videoId = urlObj.searchParams.get('v') || 
                     (urlObj.hostname === 'youtu.be' ? urlObj.pathname.substring(1) : null);
      
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    }
    
    // Xử lý Google Drive
    if (urlObj.hostname.includes('drive.google.com')) {
      // Làm sạch URL Google Drive
      let fileId = null;
      
      // Trích xuất ID từ URL Google Drive
      if (url.includes('file/d/')) {
        const match = url.match(/\/file\/d\/([^/]+)/);
        if (match && match[1]) fileId = match[1];
      } else if (url.includes('open?id=')) {
        fileId = urlObj.searchParams.get('id');
      }
      
      if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/view`;
      }
    }
  } catch (err) {
    console.error('Lỗi khi xử lý URL:', err);
  }
  
  return url;
}

// Hàm xử lý dữ liệu hyperlink từ Google Sheets
function processHyperlinks(data) {
  if (!data || !data.htmlData) return data;
  
  // Xử lý các hyperlink trong dữ liệu HTML
  data.htmlData.forEach(row => {
    if (row && row.values) {
      row.values.forEach(cell => {
        if (cell && cell.hyperlink) {
          cell.hyperlink = cleanGoogleUrl(cell.hyperlink);
        }
      });
    }
  });
  
  return data;
}

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const url = new URL(request.url);
    const debug = url.searchParams.get('debug') === 'true';
    
    console.log('Bắt đầu lấy dữ liệu từ Google Sheets, ID:', id);
    
    let auth;
    
    // Kiểm tra xem có file credentials không
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    console.log('Đường dẫn credentials:', credentialsPath);
    
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      // Xác thực với file credentials
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
      console.log('Sử dụng xác thực từ file credentials');
    } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      // Xác thực với biến môi trường
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
      console.log('Sử dụng xác thực từ biến môi trường');
    } else {
      console.error('Không tìm thấy thông tin xác thực Google API');
      throw new Error('Không tìm thấy thông tin xác thực Google API');
    }

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Lấy thông tin về spreadsheet để biết tên của các sheet
    console.log('Lấy thông tin spreadsheet...');
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: id,
      includeGridData: true
    });
    
    // Lấy tên sheet đầu tiên hoặc sử dụng 'Sheet1' nếu không tìm thấy
    const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';
    console.log('Tên sheet đầu tiên:', firstSheetName);
    
    // Lấy dữ liệu từ sheet với định dạng HTML
    console.log('Lấy dữ liệu từ sheet...');
    
    // Lấy dữ liệu với định dạng công thức
    const formulaResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: firstSheetName,
      valueRenderOption: 'FORMULA', // Lấy công thức thay vì giá trị đã tính toán
    });
    
    // Lấy dữ liệu với định dạng HTML
    const htmlResponse = await sheets.spreadsheets.get({
      spreadsheetId: id,
      ranges: [firstSheetName],
      includeGridData: true,
    });
    
    // Kết hợp dữ liệu từ cả hai phản hồi
    const combinedData = {
      values: formulaResponse.data.values,
      htmlData: htmlResponse.data.sheets?.[0]?.data?.[0]?.rowData || [],
      range: formulaResponse.data.range,
      majorDimension: formulaResponse.data.majorDimension
    };
    
    // Xử lý các URL trong dữ liệu
    const processedData = processHyperlinks(combinedData);
    
    // Thêm thông tin debug nếu được yêu cầu
    if (debug) {
      console.log('Debug info:', {
        spreadsheetId: id,
        sheetName: firstSheetName,
        credentialsPath,
        hasClientEmail: !!process.env.GOOGLE_CLIENT_EMAIL,
        hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
        formulaResponseSample: formulaResponse.data.values?.slice(0, 2),
        htmlResponseSample: htmlResponse.data.sheets?.[0]?.data?.[0]?.rowData?.slice(0, 2)
      });
    }
    
    console.log('Lấy dữ liệu thành công!');
    return NextResponse.json(processedData);
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu từ Google Sheets:', error);
    return NextResponse.json(
      { error: error.message || 'Không thể lấy dữ liệu từ Google Sheets' }, 
      { status: 500 }
    );
  }
} 