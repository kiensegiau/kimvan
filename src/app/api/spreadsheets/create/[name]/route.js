import { NextResponse } from 'next/server';
import { getKimVanAuthHeaders } from '../../../helpers/kimvan-token';

export async function GET(request, { params }) {
  try {
    // Đảm bảo await params trước khi sử dụng
    const paramsData = await params;
    const name = paramsData.name;
    
    if (!name) {
      return NextResponse.json({ error: 'Tên không được cung cấp' }, { status: 400 });
    }
    
    console.log('==============================================');
    console.log(`🔍 Đang gọi API KimVan Create với name: ${name}`);
    console.log('==============================================');
    
    // Sử dụng biến môi trường cho URL API
    const kimvanApiUrl = process.env.KIMVAN_API_URL || 'https://kimvan.id.vn/api/spreadsheets/';
    const kimvanUrl = `${kimvanApiUrl}create/${name}`;
    
    // Lấy headers chứa thông tin xác thực
    const headers = getKimVanAuthHeaders();
    console.log('Headers để gọi API:', {
      hasAuthorization: !!headers.Authorization,
      hasCookie: !!headers.cookie,
      headerCount: Object.keys(headers).length,
      method: 'GET'
    });
    
    // Log thêm thông tin về token sử dụng
    if (headers.Authorization) {
      console.log('Sử dụng JWT Authorization Bearer token');
      const tokenPreview = headers.Authorization.substring(0, 30) + '...';
      console.log(`Bearer token (một phần): ${tokenPreview}`);
    } else if (headers.cookie) {
      console.log('Sử dụng Session token với Cookie');
      const cookiePreview = headers.cookie.substring(0, 30) + '...';
      console.log(`Cookie (một phần): ${cookiePreview}`);
    } else {
      console.log('CẢNH BÁO: Không tìm thấy token để xác thực!');
    }
    
    // Gọi API KimVan với các header đã thiết lập
    const response = await fetch(kimvanUrl, {
      method: 'GET',
      headers: headers,
      next: { revalidate: 60 } // Sử dụng cache trong 60 giây
    });
    
    // Log thông tin response
    console.log(`Kết quả từ API KimVan: Status ${response.status}`);
    
    // Nếu API trả về lỗi
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Lỗi từ API KimVan: ${errorText}`);
      
      // Nếu là lỗi xác thực
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: 'Lỗi xác thực với KimVan. Token có thể đã hết hạn.' }, 
          { status: response.status }
        );
      }
      
      // Nếu vượt quá rate limit
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Đã vượt quá giới hạn yêu cầu. Vui lòng thử lại sau.' }, 
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: `Lỗi từ API KimVan: ${errorText}` },
        { status: response.status }
      );
    }
    
    // Trả về kết quả từ API KimVan
    const data = await response.json();
    console.log('Dữ liệu trả về từ API KimVan:', data);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Lỗi khi gọi API KimVan:', error);
    return NextResponse.json(
      { error: `Lỗi khi gọi API KimVan: ${error.message}` }, 
      { status: 500 }
    );
  }
} 