import { NextResponse } from 'next/server';

// Ánh xạ ID sang URL đích 
const urlMapping = {
  // Các ID video bài giảng
  "QD3nU2uI047DjsbKVicmy1MbGbRM-10_HGXU_YzD0yi62TIaHL2W7mlF7AVKM4Ad0PGbhBwJXz0": "https://youtu.be/rQp-pUVW0yI",
  "aWCW01oXbDdysV2mmMLt1rRVU_IbkvVAUleijSLjcIVUo8yR7VwM10KMcvMkD0zPA6XDMNr-KAs": "https://youtu.be/example2",
  "tRRGu8lmGu-F0dPVVvwZOGvezbC70fL2zGLDgM0tLX8BzvDQTNmes1DHDMgdK0ZNB_FbWDHHDHo": "https://youtu.be/example3",
  "Yt5u8cGdPLgGQ141Kxq1hV51ggiUGFwesql2_WShTeCkX8U7GW13N-dWdH80H7uzHAKLgDjkkbo": "https://youtu.be/example4",
  "7sOnYAymXAiGgKMCoNRAkXoab3UIhDGPkzSkc9rQrJgDN6QMuoqHOxKw5tDIU4mBYrBILp90waU": "https://youtu.be/example5",
  "yASSKTrW6zZWm0FXOyLDgz96EAkjL8xSq5oFufhI-aaWRoQxE7kUnFGuTwaCuloBhiWQB2mOhAY": "https://youtu.be/example-live",
  "9a5qeH95RRzW0T9I49MMYy8KGQHoI6RpXrOiiVPP1SAXmu3X6isi74g_zinVgp4jcAj8Y8ca7Us": "https://youtu.be/example-live-2",
  "RY-cPGQlhWXtmnTbKAiLPXQG3r0JTTILbwXxYLcHi4NebYv-h6DHrSclArNIRLJ1hTSTvlNuVDA": "https://youtu.be/custom-example",
  
  // Các ID tài liệu bài giảng
  "nYbfTPzLOKS8wzw2JICdXg3WYpGWt6l2lMx4AzQgcD973Qwa3ma0eH_VymrZG-eWuuNkfAoNvpsK32SpU1yM7RwAOXavDT4A-uFgRD9yvfzNJwlwHrsmoUXSw1QNC8mqBlAlU0VRY_Bg0MtjLw": "https://docs.google.com/document/d/example1",
  "UzC0eWldQn1PnsLYD75Yd3levq6fP3TWkHKH9mkcn65OACh_5qos4Zz1iQqpc9CVcBukMLjriBgVHYc9GJTz13OrtlHCynq78Bik6_VpAaZjS-mDuaz742G8RwprYWC_EKwgHIwIqWCtuYZ3WA": "https://docs.google.com/document/d/example2",
  
  // Tự động trả về YouTube nếu không tìm thấy ID cụ thể
  "default": "https://www.youtube.com"
};

// GET handler cho route - Next.js 15.3.0 API Route Handler
export async function GET(request, { params }) {
  console.log('------- BẮT ĐẦU XỬ LÝ API ROUTE REDIRECT -------');
  console.log('Request URL:', request.url);
  console.log('Params nhận được:', JSON.stringify(params, null, 2));
  
  try {
    // Trích xuất tham số từ URL params
    const { id, type, course } = params;
    console.log('ID:', id);
    console.log('Type:', type);
    console.log('Course:', course);
    
    // Kiểm tra xem ID có tồn tại trong mapping
    const hasInMapping = urlMapping.hasOwnProperty(id);
    console.log('ID có tồn tại trong mapping:', hasInMapping);
    
    // Lấy URL đích từ mapping hoặc sử dụng default
    const targetUrl = urlMapping[id] || urlMapping["default"];
    console.log('URL đích:', targetUrl);
    
    // Tạo response chuyển hướng
    console.log('Chuyển hướng đến:', targetUrl);
    
    // Trả về response với header Location
    return new Response(null, {
      status: 302,
      headers: {
        'Location': targetUrl,
        'Cache-Control': 'public, max-age=0, must-revalidate'
      }
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