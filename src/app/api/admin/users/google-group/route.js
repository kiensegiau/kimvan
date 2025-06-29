import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { adminAuthMiddleware } from '../../middleware';
import fs from 'fs';
import path from 'path';

// Đường dẫn đến file token
const TOKEN_PATH = path.join(process.cwd(), 'drive_token_upload.json');

// Tạo OAuth2 client
function createOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  // Đọc token từ file
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenContent = fs.readFileSync(TOKEN_PATH, 'utf8');
      const token = JSON.parse(tokenContent);
      oauth2Client.setCredentials(token);
      return oauth2Client;
    }
  } catch (error) {
    console.error('Lỗi khi đọc token file:', error);
  }
  
  return null;
}

// API để thêm thành viên vào Google Group
export async function POST(request) {
  // Kiểm tra xác thực admin
  const authResult = await adminAuthMiddleware(request);
  
  // Nếu kết quả là Response, có nghĩa là middleware đã trả về lỗi
  if (authResult instanceof Response) {
    return authResult;
  }
  
  try {
    const body = await request.json();
    
    // Kiểm tra dữ liệu đầu vào
    if (!body.email || !body.groupEmail) {
      return NextResponse.json({
        success: false,
        error: 'Thiếu thông tin email người dùng hoặc email nhóm'
      }, { status: 400 });
    }
    
    const userEmail = body.email;
    const groupEmail = body.groupEmail;
    const role = body.role || 'MEMBER'; // Mặc định là MEMBER nếu không cung cấp
    
    // Tạo OAuth2 client
    const oauth2Client = createOAuth2Client();
    if (!oauth2Client) {
      return NextResponse.json({
        success: false,
        error: 'Không thể tạo OAuth2 client, token không tồn tại hoặc không hợp lệ'
      }, { status: 401 });
    }
    
    // Khởi tạo Admin SDK Directory API
    const admin = google.admin({
      version: 'directory_v1',
      auth: oauth2Client
    });
    
    // Thêm thành viên vào nhóm
    const result = await admin.members.insert({
      groupKey: groupEmail,
      requestBody: {
        email: userEmail,
        role: role // OWNER, MANAGER, MEMBER
      }
    });
    
    return NextResponse.json({
      success: true,
      data: result.data,
      message: `Đã thêm ${userEmail} vào nhóm ${groupEmail} thành công`
    });
    
  } catch (error) {
    console.error('Lỗi khi thêm thành viên vào nhóm:', error);
    
    // Xử lý lỗi cụ thể
    if (error.code === 409) {
      return NextResponse.json({
        success: false,
        error: 'Thành viên đã tồn tại trong nhóm'
      }, { status: 409 });
    }
    
    if (error.code === 404) {
      return NextResponse.json({
        success: false,
        error: 'Không tìm thấy nhóm hoặc người dùng'
      }, { status: 404 });
    }
    
    if (error.code === 403) {
      return NextResponse.json({
        success: false,
        error: 'Không có quyền thêm thành viên vào nhóm này'
      }, { status: 403 });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Lỗi khi thêm thành viên vào nhóm: ' + error.message
    }, { status: 500 });
  }
}

// API để lấy danh sách thành viên trong nhóm
export async function GET(request) {
  // Kiểm tra xác thực admin
  const authResult = await adminAuthMiddleware(request);
  
  // Nếu kết quả là Response, có nghĩa là middleware đã trả về lỗi
  if (authResult instanceof Response) {
    return authResult;
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const groupEmail = searchParams.get('groupEmail');
    
    // Kiểm tra dữ liệu đầu vào
    if (!groupEmail) {
      return NextResponse.json({
        success: false,
        error: 'Thiếu thông tin email nhóm'
      }, { status: 400 });
    }
    
    // Tạo OAuth2 client
    const oauth2Client = createOAuth2Client();
    if (!oauth2Client) {
      return NextResponse.json({
        success: false,
        error: 'Không thể tạo OAuth2 client, token không tồn tại hoặc không hợp lệ'
      }, { status: 401 });
    }
    
    // Khởi tạo Admin SDK Directory API
    const admin = google.admin({
      version: 'directory_v1',
      auth: oauth2Client
    });
    
    // Lấy danh sách thành viên trong nhóm
    const result = await admin.members.list({
      groupKey: groupEmail
    });
    
    return NextResponse.json({
      success: true,
      data: result.data.members || [],
      message: `Đã lấy danh sách thành viên của nhóm ${groupEmail} thành công`
    });
    
  } catch (error) {
    console.error('Lỗi khi lấy danh sách thành viên nhóm:', error);
    
    // Xử lý lỗi cụ thể
    if (error.code === 404) {
      return NextResponse.json({
        success: false,
        error: 'Không tìm thấy nhóm'
      }, { status: 404 });
    }
    
    if (error.code === 403) {
      return NextResponse.json({
        success: false,
        error: 'Không có quyền truy cập nhóm này'
      }, { status: 403 });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Lỗi khi lấy danh sách thành viên nhóm: ' + error.message
    }, { status: 500 });
  }
}

// API để xóa thành viên khỏi nhóm
export async function DELETE(request) {
  // Kiểm tra xác thực admin
  const authResult = await adminAuthMiddleware(request);
  
  // Nếu kết quả là Response, có nghĩa là middleware đã trả về lỗi
  if (authResult instanceof Response) {
    return authResult;
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email');
    const groupEmail = searchParams.get('groupEmail');
    
    // Kiểm tra dữ liệu đầu vào
    if (!userEmail || !groupEmail) {
      return NextResponse.json({
        success: false,
        error: 'Thiếu thông tin email người dùng hoặc email nhóm'
      }, { status: 400 });
    }
    
    // Tạo OAuth2 client
    const oauth2Client = createOAuth2Client();
    if (!oauth2Client) {
      return NextResponse.json({
        success: false,
        error: 'Không thể tạo OAuth2 client, token không tồn tại hoặc không hợp lệ'
      }, { status: 401 });
    }
    
    // Khởi tạo Admin SDK Directory API
    const admin = google.admin({
      version: 'directory_v1',
      auth: oauth2Client
    });
    
    // Xóa thành viên khỏi nhóm
    await admin.members.delete({
      groupKey: groupEmail,
      memberKey: userEmail
    });
    
    return NextResponse.json({
      success: true,
      message: `Đã xóa ${userEmail} khỏi nhóm ${groupEmail} thành công`
    });
    
  } catch (error) {
    console.error('Lỗi khi xóa thành viên khỏi nhóm:', error);
    
    // Xử lý lỗi cụ thể
    if (error.code === 404) {
      return NextResponse.json({
        success: false,
        error: 'Không tìm thấy nhóm hoặc thành viên trong nhóm'
      }, { status: 404 });
    }
    
    if (error.code === 403) {
      return NextResponse.json({
        success: false,
        error: 'Không có quyền xóa thành viên khỏi nhóm này'
      }, { status: 403 });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Lỗi khi xóa thành viên khỏi nhóm: ' + error.message
    }, { status: 500 });
  }
} 