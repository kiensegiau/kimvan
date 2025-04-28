import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    // Lấy form data từ request
    const formData = await request.formData();
    const file = formData.get('pdf');
    const courseId = formData.get('courseId');
    
    // Kiểm tra dữ liệu cần thiết
    if (!file) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy file PDF' },
        { status: 400 }
      );
    }
    
    if (!courseId) {
      return NextResponse.json(
        { success: false, message: 'Thiếu ID khóa học' },
        { status: 400 }
      );
    }
    
    // Kiểm tra loại file
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, message: 'Chỉ hỗ trợ tải lên file PDF' },
        { status: 400 }
      );
    }
    
    // Giới hạn kích thước file (10MB)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, message: 'Kích thước file quá lớn, tối đa 10MB' },
        { status: 400 }
      );
    }
    
    // Kết nối với cơ sở dữ liệu MongoDB
    const { db } = await connectToDatabase();
    
    // Kiểm tra khóa học tồn tại
    const course = await db.collection('courses').findOne({ 
      _id: new ObjectId(courseId) 
    });
    
    if (!course) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy khóa học' },
        { status: 404 }
      );
    }
    
    // Tạo tên file duy nhất
    const uniqueId = uuidv4();
    const filename = `${course.name.replace(/[^a-zA-Z0-9]/g, '_')}_${uniqueId}.pdf`;
    
    // Tạo thư mục uploads nếu chưa tồn tại
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'pdf');
    
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }
    
    // Đường dẫn đầy đủ đến file
    const filePath = join(uploadDir, filename);
    
    // Đường dẫn URL tương đối
    const fileUrl = `/uploads/pdf/${filename}`;
    
    // Lưu file
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, fileBuffer);
    
    // Cập nhật thông tin file vào khóa học
    const updateResult = await db.collection('courses').updateOne(
      { _id: new ObjectId(courseId) },
      { 
        $push: {
          files: {
            id: uniqueId,
            type: 'pdf',
            name: file.name,
            filename: filename,
            url: fileUrl,
            size: file.size,
            uploadedAt: new Date()
          }
        },
        $set: {
          updatedAt: new Date()
        }
      }
    );
    
    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Không thể cập nhật thông tin file trong khóa học' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Tải lên file PDF thành công',
      url: fileUrl,
      filename: file.name,
      id: uniqueId
    });
  } catch (error) {
    console.error('Lỗi khi tải lên file PDF:', error);
    return NextResponse.json(
      { success: false, message: `Đã xảy ra lỗi: ${error.message}` },
      { status: 500 }
    );
  }
}

// Tùy chọn cấu hình cho việc xử lý dữ liệu
export const config = {
  api: {
    // Tắt bodyParser mặc định vì chúng ta xử lý formData
    bodyParser: false,
  },
}; 