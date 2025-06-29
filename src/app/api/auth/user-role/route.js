import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request) {
  try {
    const { uid } = await request.json();
    
    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'UID không được cung cấp' },
        { status: 400 }
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
      { success: false, error: 'Lỗi khi truy vấn MongoDB: ' + error.message },
      { status: 500 }
    );
  }
} 