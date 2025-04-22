import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET /api/admin - Lấy danh sách admin
export async function GET(request) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    
    const admins = await db.collection('admins').find({}).toArray();
    
    return NextResponse.json({ 
      success: true,
      data: admins 
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách admin:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi lấy danh sách admin' 
    }, { status: 500 });
  }
}

// POST /api/admin - Tạo admin mới
export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    
    const body = await request.json();
    const { username, password, email, role } = body;

    // Kiểm tra thông tin bắt buộc
    if (!username || !password || !email || !role) {
      return NextResponse.json({ 
        success: false, 
        error: 'Thiếu thông tin bắt buộc' 
      }, { status: 400 });
    }

    // Kiểm tra username đã tồn tại
    const existingAdmin = await db.collection('admins').findOne({ username });
    if (existingAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Username đã tồn tại' 
      }, { status: 400 });
    }

    // Tạo admin mới
    const result = await db.collection('admins').insertOne({
      username,
      password, // Trong thực tế nên mã hóa password
      email,
      role,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return NextResponse.json({ 
      success: true,
      data: {
        id: result.insertedId,
        username,
        email,
        role
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Lỗi khi tạo admin:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi tạo admin' 
    }, { status: 500 });
  }
}

// PUT /api/admin - Cập nhật thông tin admin
export async function PUT(request) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    
    const body = await request.json();
    const { id, username, email, role } = body;

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Thiếu ID admin' 
      }, { status: 400 });
    }

    // Kiểm tra admin có tồn tại
    const existingAdmin = await db.collection('admins').findOne({ _id: id });
    if (!existingAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Admin không tồn tại' 
      }, { status: 404 });
    }

    // Cập nhật thông tin admin
    const updateData = {
      updatedAt: new Date()
    };

    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.role = role;

    await db.collection('admins').updateOne(
      { _id: id },
      { $set: updateData }
    );

    return NextResponse.json({ 
      success: true,
      message: 'Cập nhật admin thành công'
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật admin:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi cập nhật admin' 
    }, { status: 500 });
  }
}

// DELETE /api/admin - Xóa admin
export async function DELETE(request) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Thiếu ID admin' 
      }, { status: 400 });
    }

    // Kiểm tra admin có tồn tại
    const existingAdmin = await db.collection('admins').findOne({ _id: id });
    if (!existingAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Admin không tồn tại' 
      }, { status: 404 });
    }

    // Xóa admin
    await db.collection('admins').deleteOne({ _id: id });

    return NextResponse.json({ 
      success: true,
      message: 'Xóa admin thành công'
    });
  } catch (error) {
    console.error('Lỗi khi xóa admin:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi xóa admin' 
    }, { status: 500 });
  }
} 