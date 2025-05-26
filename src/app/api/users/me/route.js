import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { cookies } from 'next/headers';
import { verifyServerAuthToken } from '@/utils/server-auth';
import { cookieConfig } from '@/config/env-config';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    // Lấy token từ cookie
    const cookieStore = await cookies();
    const token = cookieStore.get(cookieConfig.authCookieName)?.value;

    console.log('🔍 Token từ cookie:', token ? 'Có token' : 'Không có token');

    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Không tìm thấy token xác thực' 
      }, { status: 401 });
    }

    // Xác thực token với Firebase
    const user = await verifyServerAuthToken(token);
    console.log('👤 Thông tin user sau khi xác thực:', {
      uid: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Token không hợp lệ hoặc đã hết hạn' 
      }, { status: 401 });
    }

    // Kết nối MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'kimvan');

    // Lấy thông tin người dùng từ MongoDB
    console.log('🔍 Tìm user với firebaseId:', user.uid);
    
    // Thử tìm trực tiếp bằng ID đã biết để debug
    const knownUserId = '681ddfb11217d8b57a4ecd5a';
    const userByKnownId = await db.collection('users').findOne({ _id: new ObjectId(knownUserId) });
    console.log('🔍 User tìm bằng _id:', userByKnownId ? 'Tìm thấy' : 'Không tìm thấy');
    
    // Tìm user bằng firebaseId
    const userData = await db.collection('users').findOne({ firebaseId: user.uid });
    console.log('📄 Dữ liệu user từ MongoDB:', {
      _id: userData?._id?.toString(),
      firebaseId: userData?.firebaseId,
      email: userData?.email,
      displayName: userData?.displayName,
      role: userData?.role,
      status: userData?.status
    });

    if (!userData) {
      console.log('❌ Không tìm thấy user trong MongoDB');
      // Thử query trực tiếp để debug
      const allUsers = await db.collection('users').find({}).toArray();
      console.log('📊 Tổng số users trong DB:', allUsers.length);
      console.log('📊 Mẫu firebaseIds:', allUsers.slice(0, 3).map(u => u.firebaseId));
      
      return NextResponse.json({ 
        success: false, 
        error: 'Không tìm thấy thông tin người dùng' 
      }, { status: 404 });
    }

    // Lấy thông tin khóa học đã đăng ký từ collection enrollments
    const enrolledCourses = await db.collection('enrollments')
      .aggregate([
        { $match: { userId: user.uid } },
        { $lookup: {
          from: 'courses',
          localField: 'courseId',
          foreignField: '_id',
          as: 'courseDetails'
        }},
        { $unwind: '$courseDetails' }
      ]).toArray();
    console.log('📚 Số khóa học đã đăng ký:', enrolledCourses.length);

    // Lấy chứng chỉ
    const certificates = await db.collection('certificates')
      .find({ userId: user.uid })
      .toArray();
    console.log('🎓 Số chứng chỉ:', certificates.length);

    // Lấy hoạt động gần đây
    const recentActivities = await db.collection('activities')
      .find({ userId: user.uid })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    console.log('📝 Số hoạt động gần đây:', recentActivities.length);

    // Tính toán các thống kê
    const totalHours = enrolledCourses.reduce((acc, course) => acc + (course.totalTimeSpent || 0), 0);
    const totalProgress = enrolledCourses.length > 0 
      ? enrolledCourses.reduce((acc, course) => acc + (course.progress || 0), 0) / enrolledCourses.length 
      : 0;

    const response = {
      success: true,
      data: {
        ...userData,
        enrolledCourses: enrolledCourses.map(course => ({
          id: course._id,
          courseId: course.courseDetails._id,
          name: course.courseDetails.name,
          progress: course.progress || 0,
          lastAccessed: course.lastAccessedAt,
          image: course.courseDetails.image,
          instructor: course.courseDetails.instructor,
          completedLessons: course.completedLessons || 0,
          totalLessons: course.courseDetails.totalLessons || 0,
          status: course.status || 'active'
        })),
        certificates: certificates.map(cert => ({
          id: cert._id,
          name: cert.name,
          date: cert.issueDate,
          issuer: cert.issuer,
          image: cert.image
        })),
        recentActivities: recentActivities.map(activity => ({
          id: activity._id,
          action: activity.type,
          subject: activity.subject,
          course: activity.courseName,
          time: activity.createdAt,
          score: activity.score
        })),
        stats: {
          courses: enrolledCourses.length,
          certificates: certificates.length,
          totalHours,
          progress: Math.round(totalProgress)
        }
      }
    };
    
    console.log('✅ API thành công, trả về dữ liệu cho user:', userData.email);
    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Lỗi khi lấy thông tin người dùng:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi lấy thông tin người dùng' 
    }, { status: 500 });
  }
} 