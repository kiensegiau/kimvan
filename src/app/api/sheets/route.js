import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { dbMiddleware } from '@/utils/db-middleware';
import Sheet from '@/models/Sheet';
import { ObjectId } from 'mongodb';

// GET /api/sheets - Lấy danh sách tất cả sheets
export async function GET(request) {
  try {
    await dbMiddleware(request);
    
    // Lấy danh sách sheets từ database sử dụng model
    const sheets = await Sheet.find().sort({ createdAt: -1 });
    
    return NextResponse.json({ success: true, sheets });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách sheets:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể lấy danh sách sheets' }, 
      { status: 500 }
    );
  }
}

// POST /api/sheets - Tạo sheet mới
export async function POST(request) {
  try {
    await dbMiddleware(request);
    const data = await request.json();
    
    // Kiểm tra dữ liệu đầu vào
    if (!data.name || !data.sheetId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc (tên hoặc ID sheet)' }, 
        { status: 400 }
      );
    }
    
    // Kiểm tra xem sheet ID đã tồn tại chưa
    const existingSheet = await Sheet.findOne({ sheetId: data.sheetId });
    if (existingSheet) {
      return NextResponse.json(
        { success: false, error: 'Sheet ID này đã tồn tại trong hệ thống' }, 
        { status: 400 }
      );
    }
    
    // Tạo sheet mới sử dụng model
    const newSheet = new Sheet({
      name: data.name,
      description: data.description || '',
      sheetId: data.sheetId,
      sheetUrl: data.sheetUrl || `https://docs.google.com/spreadsheets/d/${data.sheetId}`,
    });
    
    await newSheet.save();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Đã tạo sheet thành công', 
      sheet: newSheet 
    }, { status: 201 });
  } catch (error) {
    console.error('Lỗi khi tạo sheet mới:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tạo sheet mới' }, 
      { status: 500 }
    );
  }
} 