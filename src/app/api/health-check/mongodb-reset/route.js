import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

/**
 * API endpoint để reset kết nối MongoDB trong trường hợp khẩn cấp
 * CẢNH BÁO: Chỉ sử dụng khi có quá nhiều kết nối
 */
export async function POST(request) {
  try {
    // Xác thực yêu cầu - bạn nên thêm xác thực admin ở đây
    const body = await request.json();
    if (body.admin_key !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json({
        success: false,
        message: 'Không đủ quyền để thực hiện thao tác này'
      }, { status: 403 });
    }
    
    // Đóng tất cả kết nối Mongoose hiện tại
    await mongoose.connection.close();
    console.log('Đã đóng tất cả kết nối Mongoose hiện tại');
    
    // Xóa các biến global cache nếu cần
    if (global._mongoClientPromise) {
      delete global._mongoClientPromise;
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Đã reset kết nối MongoDB, kết nối mới sẽ được thiết lập cho request tiếp theo',
      mongooseState: mongoose.connection.readyState
    });
  } catch (error) {
    console.error("Lỗi khi reset kết nối MongoDB:", error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 