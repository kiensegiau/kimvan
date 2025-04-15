import fs from 'fs';
import path from 'path';

// Đường dẫn đến file JSON lưu trữ các liên kết
const LINKS_FILE = path.join(process.cwd(), 'link-cache.json');

// Hàm đọc dữ liệu từ file JSON
function readLinksData() {
  try {
    if (!fs.existsSync(LINKS_FILE)) {
      return {};
    }
    const data = fs.readFileSync(LINKS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Lỗi khi đọc file link-cache.json:', error);
    return {};
  }
}

// Hàm lưu dữ liệu vào file JSON
function saveLinksData(data) {
  try {
    fs.writeFileSync(LINKS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Lỗi khi lưu dữ liệu vào file link-cache.json:', error);
    return false;
  }
}

// GET - Lấy danh sách các liên kết đã lưu
export async function GET() {
  try {
    const linksData = readLinksData();
    const count = Object.keys(linksData).length;
    
    return Response.json({
      success: true,
      count,
      data: linksData
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: 'Lỗi khi đọc dữ liệu cache',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// DELETE - Xóa một hoặc tất cả các liên kết
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    
    if (key) {
      // Xóa một liên kết cụ thể
      const linksData = readLinksData();
      if (linksData[key]) {
        delete linksData[key];
        saveLinksData(linksData);
        return Response.json({ 
          success: true, 
          message: `Đã xóa liên kết: ${key}` 
        });
      } else {
        return Response.json({ 
          success: false, 
          error: 'Không tìm thấy liên kết' 
        }, { status: 404 });
      }
    } else {
      // Xóa tất cả các liên kết
      saveLinksData({});
      return Response.json({ 
        success: true, 
        message: 'Đã xóa tất cả các liên kết' 
      });
    }
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: 'Lỗi khi xóa dữ liệu cache',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// POST - Thêm một liên kết mới
export async function POST(request) {
  try {
    const body = await request.json();
    
    if (!body.key || !body.url) {
      return Response.json(
        {
          success: false,
          error: 'Thiếu key hoặc url'
        },
        { status: 400 }
      );
    }
    
    const linksData = readLinksData();
    linksData[body.key] = body.url;
    saveLinksData(linksData);
    
    return Response.json({
      success: true,
      message: `Đã thêm liên kết: ${body.key}`,
      data: { key: body.key, url: body.url }
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: 'Lỗi khi thêm liên kết',
        message: error.message
      },
      { status: 500 }
    );
  }
} 