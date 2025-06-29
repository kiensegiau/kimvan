import { NextResponse } from 'next/server';

// URL của Google Apps Script web app
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw9zlumlo2hUX411ZdV3-zfV8FVVL8Xmm4duhkeQB1JidSWp8_75D4rNFKeO3m_Gcog/exec';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const groupEmail = searchParams.get('groupEmail');

    if (!groupEmail) {
      return NextResponse.json({ success: false, error: 'Thiếu tham số groupEmail' }, { status: 400 });
    }

    // Gọi đến Google Apps Script để lấy danh sách thành viên
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'list',
        groupEmail
      })
    });
    
    // Kiểm tra kiểu nội dung phản hồi
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // Nếu không phải JSON, lấy text để debug
      const text = await response.text();
      console.error('Phản hồi không phải JSON:', text.substring(0, 200));
      return NextResponse.json({ 
        success: false, 
        error: 'Phản hồi không hợp lệ từ Google Apps Script' 
      }, { status: 500 });
    }
    
    const data = await response.json();
    
    if (data.success) {
      return NextResponse.json({ 
        success: true, 
        data: data.members || [] 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: data.message || 'Không thể lấy danh sách thành viên' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Lỗi khi gọi Google Apps Script:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Đã xảy ra lỗi khi gọi API' 
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, groupEmail, role = 'MEMBER' } = body;

    if (!email || !groupEmail) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin email hoặc groupEmail' }, { status: 400 });
    }

    // Gọi đến Google Apps Script để thêm thành viên
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'add',
        userEmail: email,
        groupEmail,
        role
      })
    });

    const data = await response.json();
    
    if (data.success) {
      return NextResponse.json({ 
        success: true, 
        message: `Đã thêm ${email} vào nhóm ${groupEmail} thành công` 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: data.message || 'Không thể thêm thành viên vào nhóm' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Lỗi khi gọi Google Apps Script:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Đã xảy ra lỗi khi gọi API' 
    }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const groupEmail = searchParams.get('groupEmail');

    if (!email || !groupEmail) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin email hoặc groupEmail' }, { status: 400 });
    }

    // Gọi đến Google Apps Script để xóa thành viên
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'remove',
        userEmail: email,
        groupEmail
      })
    });

    const data = await response.json();
    
    if (data.success) {
      return NextResponse.json({ 
        success: true, 
        message: `Đã xóa ${email} khỏi nhóm ${groupEmail} thành công` 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: data.message || 'Không thể xóa thành viên khỏi nhóm' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Lỗi khi gọi Google Apps Script:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Đã xảy ra lỗi khi gọi API' 
    }, { status: 500 });
  }
} 