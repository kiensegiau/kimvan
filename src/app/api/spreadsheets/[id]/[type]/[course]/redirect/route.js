import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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

// Mẫu cookie từ request
const REQUEST_COOKIES = '__Host-authjs.csrf-token=b34ccc15c9f6ccc7d384f8fae5d3108080eda357da2d5c05025351e8e28f880a%7C65395ed922567d218434d85e82567304a9a013824836c9d72ddf8f0f65e18854; __Secure-authjs.callback-url=https%3A%2F%2Fkimvan.id.vn%2F; __Secure-authjs.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoibjBVdUpXSWdOZmZYbXU3enliYjFaTHdOWHJNNDQ2bEdTSWNBSDZUSVJZNkktVWdybWd1WGtLczdmTXlPU09xUVhEc2lZSzI3bW5yZmJURGRlUW9ud2cifQ..cB4foHev7uulrSuJAGunsw.jMWS5g6E0ZW3p-XYSeDWWRkBR9OCkZhOJ2YRjcvByym9LblMNqLBxGy_lBk6Bh7-U6QZplVsU46YR58EaHCXTRcLzL76168iR9bblHRgF6PyHC0MJ3Qq05e27rtYkxJMwuRw_gIlUtx1UiCAPftHWj3wHNR_rAPjvz-XSlfIp7gAuUwS8Tnx4_vFyuKJHccZtfkyRrVaCP1e-jFqybdYxkNYhK8B6m-vXU9jSG_8rSAUULr9-Ur2hllcg1DLtMjTwkunpCj38PgLNf73PYwjEG1-j7GUVujR7zPb-ciWBlNSs6jyT1f-vHh4WpeOnN_PYhhMTGrwOiPZ_ZA8VPnBvpScS4vUhEUgs2qSjsykkdTlK4VWDGLOgdv6hCLv87q6.a7Ejf0inXPjHgLQjaUE3SXMV5QQ2FyunxS__4f16glk';

// Mẫu set-cookie từ response
const RESPONSE_COOKIES = '__Secure-authjs.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoibjBVdUpXSWdOZmZYbXU3enliYjFaTHdOWHJNNDQ2bEdTSWNBSDZUSVJZNkktVWdybWd1WGtLczdmTXlPU09xUVhEc2lZSzI3bW5yZmJURGRlUW9ud2cifQ..7guq5IPcmy9HfrYJ8JaeIg.EDsoncG2SqznqRJNRc8B9pVDF2gbcrYErVX9mQrPPqqKNX4gtRrxmoLFeoMAogokMbDcYj9af0PH5gAsh9JCIx1xkBPolgZXN0xebZlJmlTnXVU5FWOsZXRV2LEKZZXj3iEpfgT3NE_vX4rvlZng41ZjgWf9ziENt20AhhXoZzXXSl9dY8Q0yRZecy23agB5vu1htBwOyrUb7pKnr7IJBQzFk6BVGnh3ag_-l42LRJ2Sg1Wkh8DoBJTTZTJ-HgPVnbzAMJQ7a838U-9vumr1AKHlAhZiaYuXEuGIbrPVxnk7CPWBSdoPmBb-EQ_KZjVn5toGwouFHR3r_fE9f5o-fV2_ffefqOOmo4cHm8HJSeyqti9mnWSLcDimy8L3kphr.qL9Pc-n_qjwFVie2OhUYWAgHdj4UGhvC2yhEJitEduc; Path=/; Expires=Thu, 15 May 2025 16:01:28 GMT; HttpOnly; Secure; SameSite=Lax';

// Hàm kết nối đến server kimvan.id.vn để lấy link
async function fetchLinkFromKimvan(id, type, course) {
  try {
    console.log('Đang kết nối đến server kimvan.id.vn...');
    const encodedCourse = encodeURIComponent(course);
    const kimvanUrl = `https://kimvan.id.vn/api/spreadsheets/${id}/${type}/${encodedCourse}/redirect`;
    console.log('URL API:', kimvanUrl);
    
    const response = await fetch(kimvanUrl, {
      method: 'GET',
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'vi',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'cookie': REQUEST_COOKIES,
        'host': 'kimvan.id.vn'
      },
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
    
    // Nếu không có trong cache, kết nối đến server kimvan
    if (!targetUrl) {
      console.log('Không tìm thấy URL trong cache, thử kết nối đến server kimvan...');
      targetUrl = await fetchLinkFromKimvan(id, type, course);
      
      // Nếu lấy được URL từ server, lưu vào cache
      if (targetUrl) {
        linksData[cacheKey] = targetUrl;
        saveLinksData(linksData);
        console.log('Đã lưu liên kết vào cache:', cacheKey, '=>', targetUrl);
      }
    } else {
      console.log('Đã tìm thấy URL trong cache:', targetUrl);
    }
    
    console.log('URL đích cuối cùng:', targetUrl || '/');
    
    // Chuẩn bị các header cơ bản giống mẫu
    const responseHeaders = {
      'Location': targetUrl || '/',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Set-Cookie': RESPONSE_COOKIES,
      'Strict-Transport-Security': 'max-age=63072000',
      'Server': 'Vercel',
      'Age': '0',
      'Date': 'Tue, 15 Apr 2025 16:01:29 GMT',
      'X-Vercel-Cache': 'MISS',
      'X-Vercel-Id': 'hkg1::hkg1::879bc-1744732887199-05d695829dae'
    };
    
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
    return Response.json(
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