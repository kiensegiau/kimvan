import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request) {
  try {
    // Safely parse the request body with error handling
    let uid;
    try {
      // Check if request has content before trying to parse
      const contentType = request.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const text = await request.text();
        if (text.trim()) {
          const data = JSON.parse(text);
          uid = data.uid;
        }
      }
    } catch (parseError) {
      console.error('❌ API User Role - Lỗi khi parse request body:', parseError);
    }
    
    if (!uid) {
      return NextResponse.json(
        { 
          success: true, 
          message: 'UID không được cung cấp, sử dụng vai trò mặc định',
          role: 'user' 
        }
      );
    }
    
    // Kết nối MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'kimvan');
    
    // Tìm user trong MongoDB
    const userFromDB = await db.collection('users').findOne({ firebaseId: uid });
    
    if (!userFromDB) {
      return NextResponse.json({
        success: true,
        role: null
      });
    }
    
    return NextResponse.json({
      success: true,
      role: userFromDB.role || 'user'
    });
    
  } catch (error) {
    console.error('❌ API User Role - Lỗi khi truy vấn MongoDB:', error);
    return NextResponse.json(
      { 
        success: true, 
        error: 'Lỗi khi truy vấn MongoDB: ' + error.message,
        role: 'user' // Return a default role even on error
      }
    );
  }
} 