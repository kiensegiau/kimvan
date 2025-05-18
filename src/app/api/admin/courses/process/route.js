import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import { authMiddleware, checkAuthAndRole } from '@/lib/auth';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/mongodb';

// POST: Xử lý hàng loạt khóa học
export async function POST(request) {
  try {
    // Kiểm tra cookie admin_access
    const cookieStore = await cookies();
    const adminAccess = cookieStore.get('admin_access');
    
    // Nếu có cookie admin_access, cho phép truy cập
    if (adminAccess && adminAccess.value === 'true') {
      console.log('🔒 Admin API - Đã có cookie admin_access, cho phép truy cập');
      
      const body = await request.json();
      const { courseIds, method, value } = body;
      
      // Kiểm tra dữ liệu đầu vào
      if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
        return NextResponse.json({ 
          success: false,
          message: 'Danh sách ID khóa học không hợp lệ' 
        }, { status: 400 });
      }
      
      if (!method) {
        return NextResponse.json({ 
          success: false,
          message: 'Phương thức xử lý không được cung cấp' 
        }, { status: 400 });
      }
      
      // Đảm bảo kết nối đến MongoDB trước khi truy vấn
      await connectDB();
      
      // Khởi tạo biến theo dõi kết quả
      const results = {
        total: courseIds.length,
        success: 0,
        errors: 0,
        errorDetails: []
      };
      
      // Xử lý từng khóa học
      for (const courseId of courseIds) {
        try {
          // Kiểm tra ID hợp lệ
          if (!mongoose.Types.ObjectId.isValid(courseId)) {
            results.errors++;
            results.errorDetails.push({ id: courseId, error: 'ID không hợp lệ' });
            continue;
          }
          
          let updateData = {};
          
          // Xác định dữ liệu cập nhật dựa trên phương thức
          switch (method) {
            case 'update_prices':
              if (!value || isNaN(Number(value))) {
                results.errors++;
                results.errorDetails.push({ id: courseId, error: 'Giá trị không hợp lệ' });
                continue;
              }
              updateData = { price: Number(value) };
              break;
              
            case 'update_status':
              if (!['active', 'inactive', 'draft'].includes(value)) {
                results.errors++;
                results.errorDetails.push({ id: courseId, error: 'Trạng thái không hợp lệ' });
                continue;
              }
              updateData = { status: value };
              break;
              
            case 'add_tag':
              if (!value) {
                results.errors++;
                results.errorDetails.push({ id: courseId, error: 'Thẻ không được cung cấp' });
                continue;
              }
              updateData = { $addToSet: { tags: value } };
              break;
              
            case 'remove_tag':
              if (!value) {
                results.errors++;
                results.errorDetails.push({ id: courseId, error: 'Thẻ không được cung cấp' });
                continue;
              }
              updateData = { $pull: { tags: value } };
              break;
              
            case 'add_category':
              if (!value) {
                results.errors++;
                results.errorDetails.push({ id: courseId, error: 'Danh mục không được cung cấp' });
                continue;
              }
              updateData = { $addToSet: { categories: value } };
              break;
              
            default:
              results.errors++;
              results.errorDetails.push({ id: courseId, error: 'Phương thức không được hỗ trợ' });
              continue;
          }
          
          // Thêm thời gian cập nhật
          if (!updateData.$set) updateData.$set = {};
          updateData.$set = { ...updateData.$set, updatedAt: new Date() };
          
          // Cập nhật khóa học
          const updatedCourse = await Course.findByIdAndUpdate(
            courseId,
            updateData,
            { new: true }
          );
          
          if (!updatedCourse) {
            results.errors++;
            results.errorDetails.push({ id: courseId, error: 'Không tìm thấy khóa học' });
          } else {
            results.success++;
          }
        } catch (error) {
          console.error(`Lỗi khi xử lý khóa học ${courseId}:`, error);
          results.errors++;
          results.errorDetails.push({ id: courseId, error: error.message });
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `Đã xử lý ${results.success}/${results.total} khóa học thành công`,
        summary: results
      });
    }
    
    // Kiểm tra xác thực người dùng và quyền admin
    const hasAccess = await checkAuthAndRole(request, 'admin');
    
    if (!hasAccess) {
      console.log('❌ Admin API - Không có quyền admin');
      return NextResponse.json({ 
        success: false,
        message: 'Bạn không có quyền thực hiện hành động này' 
      }, { status: 403 });
    }
    
    const body = await request.json();
    const { courseIds, method, value } = body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
      return NextResponse.json({ 
        success: false,
        message: 'Danh sách ID khóa học không hợp lệ' 
      }, { status: 400 });
    }
    
    if (!method) {
      return NextResponse.json({ 
        success: false,
        message: 'Phương thức xử lý không được cung cấp' 
      }, { status: 400 });
    }
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Khởi tạo biến theo dõi kết quả
    const results = {
      total: courseIds.length,
      success: 0,
      errors: 0,
      errorDetails: []
    };
    
    // Xử lý từng khóa học
    for (const courseId of courseIds) {
      try {
        // Kiểm tra ID hợp lệ
        if (!mongoose.Types.ObjectId.isValid(courseId)) {
          results.errors++;
          results.errorDetails.push({ id: courseId, error: 'ID không hợp lệ' });
          continue;
        }
        
        let updateData = {};
        
        // Xác định dữ liệu cập nhật dựa trên phương thức
        switch (method) {
          case 'update_prices':
            if (!value || isNaN(Number(value))) {
              results.errors++;
              results.errorDetails.push({ id: courseId, error: 'Giá trị không hợp lệ' });
              continue;
            }
            updateData = { price: Number(value) };
            break;
            
          case 'update_status':
            if (!['active', 'inactive', 'draft'].includes(value)) {
              results.errors++;
              results.errorDetails.push({ id: courseId, error: 'Trạng thái không hợp lệ' });
              continue;
            }
            updateData = { status: value };
            break;
            
          case 'add_tag':
            if (!value) {
              results.errors++;
              results.errorDetails.push({ id: courseId, error: 'Thẻ không được cung cấp' });
              continue;
            }
            updateData = { $addToSet: { tags: value } };
            break;
            
          case 'remove_tag':
            if (!value) {
              results.errors++;
              results.errorDetails.push({ id: courseId, error: 'Thẻ không được cung cấp' });
              continue;
            }
            updateData = { $pull: { tags: value } };
            break;
            
          case 'add_category':
            if (!value) {
              results.errors++;
              results.errorDetails.push({ id: courseId, error: 'Danh mục không được cung cấp' });
              continue;
            }
            updateData = { $addToSet: { categories: value } };
            break;
            
          default:
            results.errors++;
            results.errorDetails.push({ id: courseId, error: 'Phương thức không được hỗ trợ' });
            continue;
        }
        
        // Thêm thời gian cập nhật
        if (!updateData.$set) updateData.$set = {};
        updateData.$set = { ...updateData.$set, updatedAt: new Date() };
        
        // Cập nhật khóa học
        const updatedCourse = await Course.findByIdAndUpdate(
          courseId,
          updateData,
          { new: true }
        );
        
        if (!updatedCourse) {
          results.errors++;
          results.errorDetails.push({ id: courseId, error: 'Không tìm thấy khóa học' });
        } else {
          results.success++;
        }
      } catch (error) {
        console.error(`Lỗi khi xử lý khóa học ${courseId}:`, error);
        results.errors++;
        results.errorDetails.push({ id: courseId, error: error.message });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Đã xử lý ${results.success}/${results.total} khóa học thành công`,
      summary: results
    });
  } catch (error) {
    console.error('Lỗi khi xử lý hàng loạt khóa học:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi xử lý hàng loạt khóa học',
      error: error.message 
    }, { status: 500 });
  }
} 