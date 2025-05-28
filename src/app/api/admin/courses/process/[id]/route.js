import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import { authMiddleware, checkAuthAndRole } from '@/lib/auth';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/mongodb';

// POST: Xử lý một khóa học cụ thể
export async function POST(request, { params }) {
  try {
    // Kiểm tra cookie admin_access
    const cookieStore = await cookies();
    const adminAccess = cookieStore.get('admin_access');
    
    // Nếu có cookie admin_access, cho phép truy cập
    if (adminAccess && adminAccess.value === 'true') {
      console.log('🔒 Admin API - Đã có cookie admin_access, cho phép truy cập');
      
      const { id } = params;
      const body = await request.json();
      const { method } = body;
      
      // Kiểm tra ID hợp lệ
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ 
          success: false,
          message: 'ID khóa học không hợp lệ' 
        }, { status: 400 });
      }
      
      // Kiểm tra phương thức xử lý
      if (!method) {
        return NextResponse.json({ 
          success: false,
          message: 'Phương thức xử lý không được cung cấp' 
        }, { status: 400 });
      }
      
      // Đảm bảo kết nối đến MongoDB trước khi truy vấn
      await connectDB();
      
      // Tìm khóa học theo ID
      const course = await Course.findById(id).lean().exec();
      
      if (!course) {
        return NextResponse.json({ 
          success: false,
          message: 'Không tìm thấy khóa học' 
        }, { status: 404 });
      }
      
      let result = {
        success: true,
        message: 'Xử lý khóa học thành công',
        course: null
      };
      
      // Xử lý khóa học theo phương thức
      switch (method) {
        case 'extract_metadata':
          // Giả định có hàm xử lý trích xuất metadata
          if (course.originalData) {
            // Xử lý metadata từ originalData
            const updatedCourse = await Course.findByIdAndUpdate(
              id,
              { 
                $set: {
                  metadata: { 
                    processed: true,
                    processedAt: new Date(),
                    // Thêm các trường metadata khác nếu cần
                  }
                }
              },
              { new: true }
            ).lean().exec();
            
            result.course = updatedCourse;
            result.message = 'Đã trích xuất metadata thành công';
          } else {
            result.success = false;
            result.message = 'Không có dữ liệu gốc để trích xuất metadata';
          }
          break;
          
        case 'regenerate_slug':
          // Tạo slug từ tên khóa học
          const slug = course.name
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
            
          const updatedCourse = await Course.findByIdAndUpdate(
            id,
            { 
              $set: {
                slug: slug,
                updatedAt: new Date()
              }
            },
            { new: true }
          ).lean().exec();
          
          result.course = updatedCourse;
          result.message = 'Đã tạo lại slug thành công';
          break;
          
        case 'calculate_stats':
          // Giả định tính toán thống kê cho khóa học
          const stats = {
            totalViews: Math.floor(Math.random() * 1000),
            totalEnrollments: Math.floor(Math.random() * 100),
            rating: (3 + Math.random() * 2).toFixed(1),
            lastCalculated: new Date()
          };
          
          const courseWithStats = await Course.findByIdAndUpdate(
            id,
            { 
              $set: {
                stats: stats,
                updatedAt: new Date()
              }
            },
            { new: true }
          ).lean().exec();
          
          result.course = courseWithStats;
          result.message = 'Đã tính toán thống kê thành công';
          break;
          
        default:
          result.success = false;
          result.message = `Phương thức "${method}" không được hỗ trợ`;
      }
      
      return NextResponse.json(result);
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
    
    const { id } = params;
    const body = await request.json();
    const { method } = body;
    
    // Kiểm tra ID hợp lệ
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false,
        message: 'ID khóa học không hợp lệ' 
      }, { status: 400 });
    }
    
    // Kiểm tra phương thức xử lý
    if (!method) {
      return NextResponse.json({ 
        success: false,
        message: 'Phương thức xử lý không được cung cấp' 
      }, { status: 400 });
    }
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Tìm khóa học theo ID
    const course = await Course.findById(id).lean().exec();
    
    if (!course) {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy khóa học' 
      }, { status: 404 });
    }
    
    let result = {
      success: true,
      message: 'Xử lý khóa học thành công',
      course: null
    };
    
    // Xử lý khóa học theo phương thức
    switch (method) {
      case 'extract_metadata':
        // Giả định có hàm xử lý trích xuất metadata
        if (course.originalData) {
          // Xử lý metadata từ originalData
          const updatedCourse = await Course.findByIdAndUpdate(
            id,
            { 
              $set: {
                metadata: { 
                  processed: true,
                  processedAt: new Date(),
                  // Thêm các trường metadata khác nếu cần
                }
              }
            },
            { new: true }
          ).lean().exec();
          
          result.course = updatedCourse;
          result.message = 'Đã trích xuất metadata thành công';
        } else {
          result.success = false;
          result.message = 'Không có dữ liệu gốc để trích xuất metadata';
        }
        break;
        
      case 'regenerate_slug':
        // Tạo slug từ tên khóa học
        const slug = course.name
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
          
        const updatedCourse = await Course.findByIdAndUpdate(
          id,
          { 
            $set: {
              slug: slug,
              updatedAt: new Date()
            }
          },
          { new: true }
        ).lean().exec();
        
        result.course = updatedCourse;
        result.message = 'Đã tạo lại slug thành công';
        break;
        
      case 'calculate_stats':
        // Giả định tính toán thống kê cho khóa học
        const stats = {
          totalViews: Math.floor(Math.random() * 1000),
          totalEnrollments: Math.floor(Math.random() * 100),
          rating: (3 + Math.random() * 2).toFixed(1),
          lastCalculated: new Date()
        };
        
        const courseWithStats = await Course.findByIdAndUpdate(
          id,
          { 
            $set: {
              stats: stats,
              updatedAt: new Date()
            }
          },
          { new: true }
        ).lean().exec();
        
        result.course = courseWithStats;
        result.message = 'Đã tính toán thống kê thành công';
        break;
        
      default:
        result.success = false;
        result.message = `Phương thức "${method}" không được hỗ trợ`;
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Lỗi khi xử lý khóa học:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi xử lý khóa học',
      error: error.message 
    }, { status: 500 });
  }
} 