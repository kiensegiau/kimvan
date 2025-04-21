import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    // Lấy tham số name từ đường dẫn
    const name = params.name;
    
    if (!name) {
      return NextResponse.json({ error: 'Tên không được cung cấp' }, { status: 400 });
    }
    
    console.log('Đang gọi API kimvan create với name:', name);
    
    // Sử dụng biến môi trường cho URL API và cookie
    const kimvanApiUrl = process.env.KIMVAN_API_URL || 'https://kimvan.id.vn/api/spreadsheets/';
    const kimvanCookie = process.env.KIMVAN_COOKIE || '';
    const kimvanUrl = `${kimvanApiUrl}create/${name}`;
    
    console.log('URL đích:', kimvanUrl);
    
    const response = await fetch(kimvanUrl, {
      method: 'GET',
      headers: {
        'accept': '*/*',
        'accept-language': 'vi',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'priority': 'u=1, i',
        'referer': 'https://kimvan.id.vn/',
        'cookie': kimvanCookie
      }
    });
    
    if (!response.ok) {
      throw new Error(`Lỗi API: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Log thành công
    console.log('Đã nhận dữ liệu từ kimvan API create thành công!');
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Lỗi khi gọi API kimvan create:', error);
    return NextResponse.json(
      { error: 'Lỗi khi gọi API', message: error.message },
      { status: 500 }
    );
  }
} 