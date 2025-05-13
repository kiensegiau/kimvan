import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getKimVanAuthHeaders } from '../../../../../helpers/kimvan-token';

// Đường dẫn đến file JSON lưu trữ các liên kết
const LINKS_FILE = path.join(process.cwd(), 'link-cache.json');

// Hàm khởi tạo file JSON nếu chưa tồn tại
function initLinksFile() {
  try {
    if (!fs.existsSync(LINKS_FILE)) {
      fs.writeFileSync(LINKS_FILE, JSON.stringify({}, null, 2), 'utf8');
      console.log('Đã tạo file link-cache.json mới');
    }
  } catch (error) {
    console.error('Lỗi khi khởi tạo file link-cache.json:', error);
  }
}

// Hàm đọc dữ liệu từ file JSON
function readLinksData() {
  try {
    initLinksFile();
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
    console.log('Đã lưu dữ liệu vào file link-cache.json');
  } catch (error) {
    console.error('Lỗi khi lưu dữ liệu vào file link-cache.json:', error);
  }
}

// Hàm kết nối đến server kimvan.id.vn để lấy link
async function fetchLinkFromKimvan(id, type, course) {
  try {
    console.log('Đang kết nối đến server kimvan.id.vn...');
    const encodedType = encodeURIComponent(type);
    const encodedCourse = encodeURIComponent(course);
    const kimvanUrl = `https://kimvan.id.vn/api/spreadsheets/${id}/${encodedType}/${encodedCourse}/redirect`;
    
    // Lấy header với token Authorization
    const headers = getKimVanAuthHeaders();
    
    // Sửa đổi headers cho redirect
    headers['accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
    headers['sec-fetch-dest'] = 'document';
    headers['sec-fetch-mode'] = 'navigate';
    headers['sec-fetch-user'] = '?1';
    headers['upgrade-insecure-requests'] = '1';
    headers['authority'] = 'kimvan.id.vn';
    
    console.log('URL API:', kimvanUrl);
    
    const response = await fetch(kimvanUrl, {
      method: 'GET',
      headers: headers,
      redirect: 'manual' // Quan trọng: Không tự động follow redirect
    });
    
    console.log('Status code:', response.status);
    
    if (response.status === 302) {
      const location = response.headers.get('location');
      console.log('Đã nhận location từ kimvan:', location);
      return location;
    } else {
      console.log('Không nhận được redirect từ kimvan:', response.statusText);
      return '';
    }
  } catch (error) {
    console.error('Lỗi khi kết nối đến server kimvan:', error.message);
    return '';
  }
}

// GET handler cho route - Next.js 15.3.0 API Route Handler
export async function GET(request, { params }) {
  console.log('------- BẮT ĐẦU XỬ LÝ API ROUTE REDIRECT -------');
  console.log('Request URL:', request.url);
  
  try {
    // Sử dụng await với params - QUAN TRỌNG!
    const paramsData = await params;
    console.log('Params nhận được:', JSON.stringify(paramsData, null, 2));
    
    // Trích xuất tham số từ URL params
    const { id, type, course } = paramsData;
    console.log('ID:', id);
    console.log('Type:', type);
    console.log('Course:', course);
    
    // Tạo key cho cache
    const cacheKey = `${id}:${type}:${course}`;
    
    // Đọc dữ liệu hiện tại
    const linksData = readLinksData();
    
    // Kiểm tra xem cacheKey có tồn tại trong dữ liệu không
    let targetUrl = linksData[cacheKey] || '';
    let needsUpdate = false;
    
    // Kiểm tra xem URL có hết hạn không (7 ngày)
    const now = Date.now();
    if (linksData[cacheKey] && linksData[cacheKey + '_timestamp']) {
      const timestamp = linksData[cacheKey + '_timestamp'];
      const ageInDays = (now - timestamp) / (1000 * 60 * 60 * 24);
      
      if (ageInDays > 7) {
        console.log('URL trong cache đã hết hạn (>7 ngày), cần cập nhật');
        needsUpdate = true;
      }
    } else if (targetUrl) {
      // Nếu có URL nhưng không có timestamp, thêm timestamp
      linksData[cacheKey + '_timestamp'] = now;
      saveLinksData(linksData);
    }
    
    // Nếu không có trong cache hoặc cần cập nhật, kết nối đến server kimvan
    if (!targetUrl || needsUpdate) {
      console.log('Không tìm thấy URL trong cache hoặc URL đã hết hạn, thử kết nối đến server kimvan...');
      const newUrl = await fetchLinkFromKimvan(id, type, course);
      
      // Nếu lấy được URL từ server, lưu vào cache
      if (newUrl) {
        linksData[cacheKey] = newUrl;
        linksData[cacheKey + '_timestamp'] = now;
        saveLinksData(linksData);
        console.log('Đã lưu liên kết vào cache:', cacheKey, '=>', newUrl);
        targetUrl = newUrl;
      }
    } else {
      console.log('Đã tìm thấy URL trong cache:', targetUrl);
    }
    
    // Nếu vẫn không có URL, trả về lỗi
    if (!targetUrl) {
      console.log('Không thể lấy được URL đích, trả về lỗi 404');
      return NextResponse.json(
        { error: 'Không tìm thấy URL đích', message: 'URL không tồn tại hoặc đã hết hạn' },
        { status: 404 }
      );
    }
    
    console.log('URL đích cuối cùng:', targetUrl);
    
    // Chuẩn bị các header cơ bản
    const responseHeaders = new Headers({
      'Location': targetUrl,
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Strict-Transport-Security': 'max-age=63072000',
      'Server': 'Vercel',
      'Age': '0',
      'Content-Type': 'text/plain',
      'X-Vercel-Cache': 'MISS'
    });
    
    // Trả về response với các header
    return new Response(null, {
      status: 302,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('------- LỖI KHI XỬ LÝ -------');
    console.error('Tên lỗi:', error.name);
    console.error('Thông báo lỗi:', error.message);
    
    // Trả về JSON response với mã lỗi 500
    return NextResponse.json(
      { 
        error: 'Có lỗi xảy ra khi xử lý yêu cầu chuyển hướng',
        message: error.message
      },
      { status: 500 }
    );
  } finally {
    console.log('------- KẾT THÚC XỬ LÝ API ROUTE REDIRECT -------');
  }
} 