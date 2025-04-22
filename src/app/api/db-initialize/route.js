import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// Dữ liệu mẫu ban đầu
const sampleCourses = [
  {
    name: 'Khóa học Excel cơ bản',
    description: 'Học cách sử dụng Excel từ cơ bản đến nâng cao',
    price: 500000,
    status: 'active',
    createdAt: new Date(),
    kimvanId: 'excel-basic'
  },
  {
    name: 'Khóa học Word nâng cao',
    description: 'Nâng cao kỹ năng sử dụng Microsoft Word',
    price: 400000,
    status: 'active',
    createdAt: new Date(),
    kimvanId: 'word-advanced'
  },
  {
    name: 'Khóa học PowerPoint',
    description: 'Tạo bài thuyết trình chuyên nghiệp',
    price: 450000,
    status: 'inactive',
    createdAt: new Date(),
    kimvanId: 'powerpoint-basic'
  },
];

export async function GET() {
  try {
    // Kết nối đến MongoDB
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');

    // Kiểm tra xem collection courses đã tồn tại chưa
    const collections = await db.listCollections({ name: 'courses' }).toArray();
    
    let message = '';
    let created = false;

    if (collections.length === 0) {
      // Nếu collection chưa tồn tại, tạo mới và thêm dữ liệu mẫu
      await db.createCollection('courses');
      const result = await db.collection('courses').insertMany(sampleCourses);
      
      message = `Đã tạo collection 'courses' và thêm ${result.insertedCount} khóa học mẫu`;
      created = true;
    } else {
      // Kiểm tra số lượng documents trong collection
      const count = await db.collection('courses').countDocuments();
      
      if (count === 0) {
        // Nếu collection rỗng, thêm dữ liệu mẫu
        const result = await db.collection('courses').insertMany(sampleCourses);
        message = `Collection 'courses' đã tồn tại nhưng trống. Đã thêm ${result.insertedCount} khóa học mẫu`;
        created = true;
      } else {
        message = `Collection 'courses' đã tồn tại và có ${count} khóa học. Không cần khởi tạo lại.`;
      }
    }

    // Trả về thông tin khởi tạo
    return NextResponse.json({ 
      success: true, 
      message,
      created,
      database: 'kimvan',
      uri: process.env.MONGODB_URI
    });
  } catch (error) {
    console.error('Lỗi khi khởi tạo cơ sở dữ liệu:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Đã xảy ra lỗi khi khởi tạo cơ sở dữ liệu', 
      error: error.message 
    }, { status: 500 });
  }
} 