import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request, { params }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID khóa học không hợp lệ' }, { status: 400 });
    }

    // Lấy dữ liệu từ request body
    const { processedData, kimvanId } = await request.json();
    
    if (!processedData || !kimvanId) {
      return NextResponse.json({ 
        success: false, 
        message: 'Thiếu dữ liệu cần thiết để đồng bộ' 
      }, { status: 400 });
    }

    console.log('Received sync request:', {
      courseId: id,
      kimvanId,
      processedData
    });

    // Kết nối database
    const client = await connectToDatabase();
    const db = client.db();
    const coursesCollection = db.collection('courses');

    // Tìm khóa học theo ID
    const course = await coursesCollection.findOne({ 
      _id: new ObjectId(id)
    });

    if (!course) {
      return NextResponse.json({ 
        success: false, 
        message: 'Không tìm thấy khóa học' 
      }, { status: 404 });
    }

    // Cập nhật dữ liệu khóa học
    const updateResult = await coursesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          originalData: processedData,
          updatedAt: new Date()
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Không thể cập nhật dữ liệu khóa học' 
      }, { status: 500 });
    }

    // Trả về kết quả thành công
    return NextResponse.json({
      success: true,
      message: 'Đồng bộ dữ liệu thành công',
      data: {
        courseId: id,
        modifiedCount: updateResult.modifiedCount
      }
    });

  } catch (error) {
    console.error('Lỗi khi đồng bộ khóa học:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Có lỗi xảy ra khi đồng bộ dữ liệu' 
    }, { status: 500 });
  }
} 