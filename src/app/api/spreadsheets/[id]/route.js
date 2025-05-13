import { NextResponse } from 'next/server';
import { getKimVanAuthHeaders } from '../../helpers/kimvan-token';

export async function GET(request, { params }) {
  try {
    // Await params trước khi sử dụng - FIX lỗi
    const paramsData = await params;
    const id = paramsData.id;
    
    if (!id) {
      return NextResponse.json({ error: 'ID không được cung cấp' }, { status: 400 });
    }
    
    console.log('Đang gọi API kimvan với ID:', id);
    
    // Sử dụng biến môi trường cho URL API
    const kimvanApiUrl = process.env.KIMVAN_API_URL || 'https://kimvan.id.vn/api/spreadsheets/';
    const kimvanUrl = `${kimvanApiUrl}${id}`;
    
    console.log('URL đích:', kimvanUrl);
    
    // Lấy header với token Authorization
    const headers = getKimVanAuthHeaders();
    
    const response = await fetch(kimvanUrl, {
      method: 'GET',
      headers: headers
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