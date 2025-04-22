import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Lấy thông tin cấu hình từ biến môi trường
    const kimvanApiUrl = process.env.KIMVAN_API_URL || 'https://kimvan.id.vn/api/spreadsheets/';
    const kimvanCookie = process.env.KIMVAN_COOKIE || '';

    // Gọi API để lấy danh sách ID
    const listResponse = await fetch(`${kimvanApiUrl}`, {
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

    if (!listResponse.ok) {
      throw new Error(`Lỗi khi lấy danh sách khóa học: ${listResponse.status} ${listResponse.statusText}`);
    }

    const listData = await listResponse.json();
    
    // Lấy chi tiết cho từng khóa học
    const coursesPromises = listData.data.map(async (item) => {
      const courseResponse = await fetch(`${kimvanApiUrl}${item.id}`, {
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

      if (!courseResponse.ok) {
        console.error(`Không thể lấy thông tin khóa học ID ${item.id}`);
        return null;
      }

      const courseData = await courseResponse.json();
      
      // Định dạng dữ liệu khóa học cho phù hợp với model Course
      return {
        kimvanId: item.id,
        name: courseData.data.name || 'Khóa học không tên',
        description: courseData.data.description || 'Không có mô tả',
        price: parseInt(courseData.data.price || '0'),
        status: 'active',
        createdAt: new Date(),
        originalData: courseData.data
      };
    });

    const coursesResults = await Promise.all(coursesPromises);
    const courses = coursesResults.filter(course => course !== null);

    return NextResponse.json({ 
      success: true, 
      count: courses.length,
      courses 
    });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu khóa học từ Kimvan:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Đã xảy ra lỗi khi lấy dữ liệu khóa học từ Kimvan', 
      error: error.message 
    }, { status: 500 });
  }
} 