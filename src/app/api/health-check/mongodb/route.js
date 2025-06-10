import { NextResponse } from 'next/server';
import { getConnectionStats, connectDB } from '@/lib/mongodb';

export async function GET() {
  try {
    // Kết nối để đảm bảo có kết nối trước khi kiểm tra
    await connectDB();
    
    // Lấy thống kê kết nối
    const stats = await getConnectionStats();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      connectionStats: stats
    });
  } catch (error) {
    console.error("Lỗi khi kiểm tra kết nối MongoDB:", error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 