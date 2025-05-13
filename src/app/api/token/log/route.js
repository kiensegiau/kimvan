import { NextResponse } from 'next/server';
import { saveTokenLog, getTokenLogs, clearTokenLogs } from '../../helpers/token-log';

// API lưu log token từ trình duyệt
export async function POST(request) {
  try {
    const data = await request.json();
    
    // Thêm thông tin IP từ request headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    
    // Lưu log với IP đã thu thập
    data.ipAddress = ipAddress;
    
    // Lưu log
    const success = saveTokenLog(data);
    
    if (success) {
      return NextResponse.json({ success: true, message: 'Log đã được lưu' });
    } else {
      return NextResponse.json({ success: false, message: 'Không thể lưu log' }, { status: 500 });
    }
  } catch (error) {
    console.error('Lỗi khi xử lý request log:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// API lấy log token
export async function GET(request) {
  try {
    // Kiểm tra xem có yêu cầu xóa log không
    const { searchParams } = new URL(request.url);
    const clearParam = searchParams.get('clear');
    
    if (clearParam === 'true') {
      const cleared = clearTokenLogs();
      if (cleared) {
        return NextResponse.json({ success: true, message: 'Đã xóa tất cả log' });
      } else {
        return NextResponse.json({ success: false, message: 'Không thể xóa log' }, { status: 500 });
      }
    }
    
    // Nếu không phải xóa, trả về danh sách log
    const logs = getTokenLogs();
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('Lỗi khi xử lý request get log:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
} 