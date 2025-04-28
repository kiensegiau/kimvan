import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    const { courseIds, method, value } = await request.json();
    
    if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Danh sách ID khóa học không hợp lệ' },
        { status: 400 }
      );
    }
    
    if (!method) {
      return NextResponse.json(
        { success: false, message: 'Phương thức xử lý không được cung cấp' },
        { status: 400 }
      );
    }
    
    // Kết nối với cơ sở dữ liệu MongoDB
    const { db } = await connectToDatabase();
    
    // Chuyển đổi chuỗi ID thành ObjectId
    const objectIds = courseIds.map(id => new ObjectId(id));
    
    // Kiểm tra xem các khóa học có tồn tại không
    const coursesCount = await db.collection('courses').countDocuments({
      _id: { $in: objectIds }
    });
    
    if (coursesCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy khóa học nào' },
        { status: 404 }
      );
    }
    
    // Xác định cập nhật dựa trên phương thức
    let updateOperation = {};
    let updateFilter = { _id: { $in: objectIds } };
    
    switch (method) {
      case 'update_prices':
        if (!value || isNaN(parseInt(value))) {
          return NextResponse.json(
            { success: false, message: 'Giá trị giá không hợp lệ' },
            { status: 400 }
          );
        }
        updateOperation = { $set: { price: parseInt(value), updatedAt: new Date() } };
        break;
        
      case 'update_status':
        if (!value || !['active', 'inactive', 'draft'].includes(value)) {
          return NextResponse.json(
            { success: false, message: 'Trạng thái không hợp lệ' },
            { status: 400 }
          );
        }
        updateOperation = { $set: { status: value, updatedAt: new Date() } };
        break;
        
      case 'add_tag':
        if (!value) {
          return NextResponse.json(
            { success: false, message: 'Giá trị thẻ không được cung cấp' },
            { status: 400 }
          );
        }
        updateOperation = { 
          $addToSet: { tags: value },
          $set: { updatedAt: new Date() }
        };
        break;
        
      case 'remove_tag':
        if (!value) {
          return NextResponse.json(
            { success: false, message: 'Giá trị thẻ không được cung cấp' },
            { status: 400 }
          );
        }
        updateOperation = { 
          $pull: { tags: value },
          $set: { updatedAt: new Date() }
        };
        break;
        
      case 'add_category':
        if (!value) {
          return NextResponse.json(
            { success: false, message: 'Giá trị danh mục không được cung cấp' },
            { status: 400 }
          );
        }
        updateOperation = { 
          $addToSet: { categories: value },
          $set: { updatedAt: new Date() }
        };
        break;
        
      default:
        return NextResponse.json(
          { success: false, message: 'Phương thức không được hỗ trợ' },
          { status: 400 }
        );
    }
    
    // Thực hiện cập nhật
    const updateResult = await db.collection('courses').updateMany(
      updateFilter,
      updateOperation
    );
    
    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy khóa học nào khớp với điều kiện' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `Đã xử lý ${updateResult.modifiedCount} khóa học thành công`,
      summary: {
        total: coursesCount,
        success: updateResult.modifiedCount,
        errors: coursesCount - updateResult.modifiedCount,
        method,
        value
      }
    });
  } catch (error) {
    console.error('Lỗi khi xử lý dữ liệu khóa học:', error);
    return NextResponse.json(
      { success: false, message: `Đã xảy ra lỗi: ${error.message}` },
      { status: 500 }
    );
  }
} 