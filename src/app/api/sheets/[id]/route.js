import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { connectDB } from '@/lib/mongodb';
import Sheet from '@/models/Sheet';
import { ObjectId } from 'mongodb';
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

// Hàm lọc bỏ các hàng giới thiệu
function filterIntroductoryRows(data) {
  if (!data || !data.values || data.values.length === 0) return data;
  
  // Danh sách các nội dung cần lọc bỏ
  const introTexts = [
    'WEBSITE KHÓA HỌC DUY NHẤT: THANHVIENKHOAHOC.NET',
    'ZALO LIÊN HỆ KHÓA HỌC DUY NHẤT : 0778335643 ( THANHVIENKHOAHOC NET )',
    'FANPAGE FACEBOOK HỖ TRỢ KHÓA HỌC : BẤM VÀO ĐÂY'
  ];
  
  // Các từ khóa cốt lõi cần lọc
  const coreKeywords = [
    'thanhvienkhoahoc',
    'thanh vien khoa hoc',
    'thanhvienkhoahocnet',
    'thanhvien.khoahoc'
  ];
  
  // Thêm các pattern cần lọc
  const filterPatterns = [
    'facebook.com/thanhvienkhoahocnet',
    'thanhvienkhoahoc.net',
    'thanhvienkhoahocnet',
    'FANPAGE FACEBOOK',
    'href="http://thanhvienkhoahoc.net/"'
  ];
  
  // Hàm kiểm tra xem một chuỗi có chứa bất kỳ từ khóa cốt lõi nào không
  const containsCoreKeyword = (text) => {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return coreKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  };
  
  // Không lọc các hàng để hiển thị đầy đủ dữ liệu
  const filteredValues = data.values;
  
  // Log thông tin về số lượng hàng
  console.log(`Số lượng hàng trước khi lọc: ${data.values ? data.values.length : 0}`);
  console.log(`Số lượng hàng sau khi lọc: ${filteredValues ? filteredValues.length : 0}`);
  
  // Cập nhật dữ liệu values
  data.values = filteredValues;
  
  // Không lọc htmlData để giữ nguyên dữ liệu
  if (data.htmlData && data.htmlData.length > 0) {
    console.log(`Số lượng hàng trong htmlData: ${data.htmlData.length}`);
  }
  
  return data;
}

// Hàm loại bỏ cột STT
function removeFirstColumn(data) {
  if (!data || !data.values || data.values.length === 0) return data;
  
  // Loại bỏ cột đầu tiên từ mỗi hàng trong values
  data.values = data.values.map(row => row.slice(1));
  
  // Loại bỏ cột đầu tiên từ mỗi hàng trong htmlData
  if (data.htmlData && data.htmlData.length > 0) {
    data.htmlData.forEach(row => {
      if (row && row.values) {
        row.values = row.values.slice(1);
      }
    });
  }
  
  return data;
}

// GET /api/sheets/[id] - Lấy chi tiết sheet
export async function GET(request, { params }) {
  try {
    const { id } = params;
    await connectDB();
    
    // Kiểm tra xem id có phải là MongoDB ObjectId hay không
    let sheet;
    if (ObjectId.isValid(id)) {
      sheet = await Sheet.findById(id);
    } else {
      // Nếu không phải ObjectId, giả định đó là sheetId
      sheet = await Sheet.findOne({ sheetId: id });
    }
    
    if (!sheet) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy sheet' }, 
        { status: 404 }
      );
    }
    
    // Kiểm tra xem có yêu cầu lấy dữ liệu từ Google Sheets không
    const url = new URL(request.url);
    const fetchData = url.searchParams.get('fetchData') === 'true';
    
    if (fetchData) {
      // Lấy dữ liệu từ Google Sheets
      const sheetData = await fetchSheetData(sheet.sheetId);
      return NextResponse.json({ 
        success: true, 
        sheet: {
          ...sheet.toObject(),
          data: sheetData
        }
      });
    }
    
    return NextResponse.json({ success: true, sheet });
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết sheet:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể lấy chi tiết sheet' }, 
      { status: 500 }
    );
  }
}

// PUT /api/sheets/[id] - Cập nhật sheet
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    await connectDB();
    const data = await request.json();
    
    // Kiểm tra xem sheet có tồn tại không
    const sheet = await Sheet.findById(id);
    if (!sheet) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy sheet' }, 
        { status: 404 }
      );
    }
    
    // Cập nhật sheet
    const updateData = {
      ...data,
    };
    
    // Không cho phép cập nhật sheetId
    delete updateData.sheetId;
    delete updateData._id;
    
    const updatedSheet = await Sheet.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    return NextResponse.json({ 
      success: true, 
      message: 'Đã cập nhật sheet thành công', 
      sheet: updatedSheet 
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật sheet:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể cập nhật sheet' }, 
      { status: 500 }
    );
  }
}

// POST /api/sheets/[id]/related - Thêm sheet liên quan
export async function POST(request, { params }) {
  try {
    const { id } = params;
    await connectDB();
    const data = await request.json();
    
    // Kiểm tra xem sheet có tồn tại không
    const sheet = await Sheet.findById(id);
    if (!sheet) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy sheet' }, 
        { status: 404 }
      );
    }
    
    // Kiểm tra dữ liệu đầu vào
    if (!data.name || !data.sheetId || !data.sheetUrl) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc (tên, ID hoặc URL sheet)' }, 
        { status: 400 }
      );
    }
    
    // Thêm sheet liên quan
    const relatedSheet = {
      name: data.name,
      sheetId: data.sheetId,
      sheetUrl: data.sheetUrl,
      description: data.description || ''
    };
    
    // Khởi tạo mảng relatedSheets nếu chưa có
    if (!sheet.relatedSheets) {
      sheet.relatedSheets = [];
    }
    
    // Thêm vào mảng
    sheet.relatedSheets.push(relatedSheet);
    
    // Lưu thay đổi
    await sheet.save();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Đã thêm sheet liên quan thành công', 
      sheet: sheet 
    });
  } catch (error) {
    console.error('Lỗi khi thêm sheet liên quan:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể thêm sheet liên quan' }, 
      { status: 500 }
    );
  }
}

// DELETE /api/sheets/[id]/related/[relatedId] - Xóa sheet liên quan
export async function DELETE(request, { params, nextUrl }) {
  try {
    const { id } = params;
    await connectDB();
    
    // Lấy relatedId từ URL
    const url = new URL(request.url);
    const relatedId = url.searchParams.get('relatedId');
    
    if (!relatedId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu ID của sheet liên quan' }, 
        { status: 400 }
      );
    }
    
    // Kiểm tra xem sheet có tồn tại không
    const sheet = await Sheet.findById(id);
    if (!sheet) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy sheet' }, 
        { status: 404 }
      );
    }
    
    // Kiểm tra xem relatedSheets có tồn tại không
    if (!sheet.relatedSheets || sheet.relatedSheets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sheet này không có sheet liên quan nào' }, 
        { status: 404 }
      );
    }
    
    // Tìm và xóa sheet liên quan
    const relatedIndex = sheet.relatedSheets.findIndex(
      related => related._id.toString() === relatedId
    );
    
    if (relatedIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy sheet liên quan với ID đã cho' }, 
        { status: 404 }
      );
    }
    
    // Xóa sheet liên quan
    sheet.relatedSheets.splice(relatedIndex, 1);
    
    // Lưu thay đổi
    await sheet.save();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Đã xóa sheet liên quan thành công',
      sheet: sheet
    });
  } catch (error) {
    console.error('Lỗi khi xóa sheet liên quan:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể xóa sheet liên quan' }, 
      { status: 500 }
    );
  }
}

// Hàm lấy dữ liệu từ Google Sheets
async function fetchSheetData(sheetId) {
  try {
    console.log('Bắt đầu lấy dữ liệu từ Google Sheets, ID:', sheetId);
    
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
      spreadsheetId: sheetId,
      includeGridData: true
    });
    
    // Lấy tên sheet đầu tiên hoặc sử dụng 'Sheet1' nếu không tìm thấy
    const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';
    console.log('Tên sheet đầu tiên:', firstSheetName);
    
    // Lấy dữ liệu từ sheet với định dạng HTML
    console.log('Lấy dữ liệu từ sheet...');
    
    // Lấy dữ liệu với định dạng công thức
    const formulaResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: firstSheetName,
      valueRenderOption: 'FORMULA', // Lấy công thức thay vì giá trị đã tính toán
    });
    
    // Lấy dữ liệu với định dạng HTML
    const htmlResponse = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      ranges: [firstSheetName],
      includeGridData: true,
    });
    
    // Kết hợp dữ liệu từ cả hai phản hồi
    const combinedData = {
      values: formulaResponse.data.values,
      htmlData: htmlResponse.data.sheets?.[0]?.data?.[0]?.rowData || [],
      range: formulaResponse.data.range,
      majorDimension: formulaResponse.data.majorDimension,
      merges: htmlResponse.data.sheets?.[0]?.merges || []
    };
    
    // Log thông tin về số lượng hàng
    console.log(`Số lượng hàng trong values: ${formulaResponse.data.values?.length || 0}`);
    console.log(`Số lượng hàng trong htmlData: ${htmlResponse.data.sheets?.[0]?.data?.[0]?.rowData?.length || 0}`);
    
    // Xử lý các URL trong dữ liệu
    const processedData = processHyperlinks(combinedData);
    
    // Lọc bỏ các hàng giới thiệu
    const filteredData = filterIntroductoryRows(processedData);
    
    // Loại bỏ cột STT
    const finalData = removeFirstColumn(filteredData);
    
    // Kiểm tra dữ liệu sau khi lọc
    console.log(`Sau khi lọc - Số lượng hàng trong values: ${finalData.values?.length || 0}`);
    console.log(`Sau khi lọc - Số lượng hàng trong htmlData: ${finalData.htmlData?.length || 0}`);
    
    console.log('Lấy dữ liệu thành công!');
    return finalData;
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu từ Google Sheets:', error);
    throw new Error('Không thể lấy dữ liệu từ Google Sheets: ' + error.message);
  }
} 