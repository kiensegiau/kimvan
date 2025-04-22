import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    // Await params trước khi sử dụng - FIX lỗi
    const paramsData = await params;
    const id = paramsData.id;
    
    if (!id) {
      return NextResponse.json({ error: 'ID không được cung cấp' }, { status: 400 });
    }
    
    console.log('Đang gọi API kimvan với ID:', id);
    
    // Sử dụng biến môi trường cho URL API và cookie
    const kimvanApiUrl = process.env.KIMVAN_API_URL || 'https://kimvan.id.vn/api/spreadsheets/';
    const kimvanCookie = process.env.KIMVAN_COOKIE || '';
    const kimvanUrl = `${kimvanApiUrl}${id}`;
    
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
    console.log('Đã nhận dữ liệu từ kimvan API thành công!');
    
    // Trả về với các headers tương tự như kimvan API
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Content-Type': 'application/json',
        'Strict-Transport-Security': 'max-age=63072000'
      }
    });
    
  } catch (error) {
    console.error('Lỗi khi gọi API kimvan:', error);
    return NextResponse.json(
      { error: 'Lỗi khi gọi API', message: error.message },
      { status: 500 }
    );
  }
} 