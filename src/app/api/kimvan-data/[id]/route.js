import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        message: 'ID khóa học không được cung cấp' 
      }, { status: 400 });
    }
    
    // Kết nối MongoDB
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    
    // Tìm dữ liệu gốc từ collection kimvan_data
    const kimvanData = await db.collection('kimvan_data').findOne({ kimvanId: id });
    
    if (!kimvanData) {
      return NextResponse.json({ 
        success: false, 
        message: 'Không tìm thấy dữ liệu gốc cho khóa học này' 
      }, { status: 404 });
    }
    
    // Trả về dữ liệu gốc
    return NextResponse.json(kimvanData, { status: 200 });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu gốc từ Kimvan:', error);
    return NextResponse.json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy dữ liệu gốc từ Kimvan',
      error: error.message
    }, { status: 500 });
  }
} 