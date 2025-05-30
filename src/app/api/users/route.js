import { NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';
import clientPromise from '@/lib/mongodb';

// Hàm kiểm tra quyền quản trị
async function checkAdminPermission(req) {
  try {
    // Lấy token từ header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.split(' ')[1];
    // Xác thực token với Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Kiểm tra xem người dùng có vai trò admin không
    // Nếu có custom claims trong token
    if (decodedToken.role === 'admin') {
      return true;
    }
    
    // Nếu không có trong token, kiểm tra trong MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'kimvan');
    const userDoc = await db.collection('users').findOne({ firebaseId: decodedToken.uid });
    
    return userDoc && userDoc.role === 'admin';
  } catch (error) {
    console.error('Lỗi kiểm tra quyền admin:', error);
    return false;
  }
}

// Hàm xử lý lỗi Firebase Auth
function handleFirebaseError(error) {
  const errorCode = error.code || 'unknown-error';
  let message = 'Đã xảy ra lỗi không xác định';
  let status = 500;
  
  switch (errorCode) {
    case 'auth/email-already-exists':
      message = 'Email này đã được sử dụng';
      status = 409;
      break;
    case 'auth/invalid-email':
      message = 'Email không hợp lệ';
      status = 400;
      break;
    case 'auth/invalid-password':
      message = 'Mật khẩu phải có ít nhất 6 ký tự';
      status = 400;
      break;
    case 'auth/phone-number-already-exists':
      message = 'Số điện thoại này đã được sử dụng';
      status = 409;
      break;
    case 'auth/uid-already-exists':
      message = 'ID người dùng đã tồn tại';
      status = 409;
      break;
    case 'auth/user-not-found':
      message = 'Không tìm thấy người dùng';
      status = 404;
      break;
    default:
      message = error.message || 'Lỗi máy chủ nội bộ';
  }
  
  return { message, status };
}

// GET /api/users - Lấy danh sách người dùng
export async function GET(request) {
  try {
    // Kiểm tra quyền admin (bỏ comment nếu muốn bật)
    // if (!(await checkAdminPermission(request))) {
    //   return NextResponse.json({ 
    //     success: false, 
    //     error: 'Không có quyền truy cập' 
    //   }, { status: 403 });
    // }
    
    // Kết nối đến MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'kimvan');
    
    // Lấy danh sách người dùng từ Firebase Auth
    const { users } = await admin.auth().listUsers();
    
    // Lấy thông tin bổ sung từ MongoDB
    const userIds = users.map(user => user.uid);
    const userDetails = await db.collection('users').find({
      firebaseId: { $in: userIds }
    }).toArray();
    
    // Kết hợp dữ liệu từ cả hai nguồn
    const combinedUsers = users.map(firebaseUser => {
      const mongoUser = userDetails.find(u => u.firebaseId === firebaseUser.uid) || {};
      
      return {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || '',
        phoneNumber: firebaseUser.phoneNumber || '',
        photoURL: firebaseUser.photoURL || '',
        emailVerified: firebaseUser.emailVerified,
        disabled: firebaseUser.disabled,
        createdAt: firebaseUser.metadata.creationTime,
        lastLoginAt: firebaseUser.metadata.lastSignInTime,
        // Thông tin bổ sung từ MongoDB
        role: mongoUser.role || 'user',
        status: mongoUser.status || 'active',
        additionalInfo: mongoUser.additionalInfo || {},
        // Các thông tin khác từ MongoDB nếu có
        ...mongoUser
      };
    });
    
    return NextResponse.json({ 
      success: true,
      data: combinedUsers
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi lấy danh sách người dùng: ' + error.message 
    }, { status: 500 });
  }
}

// POST /api/users - Tạo người dùng mới
export async function POST(request) {
  try {
    // Kiểm tra quyền admin (bỏ comment nếu muốn bật)
    // if (!(await checkAdminPermission(request))) {
    //   return NextResponse.json({ 
    //     success: false, 
    //     error: 'Không có quyền truy cập' 
    //   }, { status: 403 });
    // }
    
    // Lấy dữ liệu từ request
    const body = await request.json();
    const { email, password, accountType, trialEndsAt, canViewAllCourses } = body;
    
    // Kiểm tra các trường bắt buộc
    if (!email || !password) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email và mật khẩu là bắt buộc' 
      }, { status: 400 });
    }
    
    // Kiểm tra độ dài mật khẩu
    if (password.length < 6) {
      return NextResponse.json({ 
        success: false, 
        error: 'Mật khẩu phải có ít nhất 6 ký tự' 
      }, { status: 400 });
    }
    
    // Kết nối đến MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'kimvan');
    
    try {
      // Tạo người dùng mới trong Firebase Auth
      const userRecord = await admin.auth().createUser({
        email,
        password
      });
      
      // Xác định loại tài khoản và quyền xem khóa học
      const userAccountType = accountType || 'regular';
      // Tài khoản dùng thử luôn có quyền xem tất cả khóa học
      const userCanViewAllCourses = userAccountType === 'trial' ? true : (canViewAllCourses || false);
      
      // Lưu thông tin bổ sung vào MongoDB
      await db.collection('users').insertOne({
        firebaseId: userRecord.uid,
        email,
        displayName: null,
        phoneNumber: null,
        role: 'user',
        status: 'active',
        emailVerified: false,
        additionalInfo: {},
        accountType: userAccountType,
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
        canViewAllCourses: userCanViewAllCourses, // Đảm bảo tài khoản dùng thử luôn có quyền xem tất cả khóa học
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return NextResponse.json({ 
        success: true,
        data: { id: userRecord.uid }
      });
    } catch (error) {
      console.error('Firebase error:', error);
      // Xử lý lỗi Firebase Auth
      const { message, status } = handleFirebaseError(error);
      return NextResponse.json({ 
        success: false, 
        error: message 
      }, { status });
    }
  } catch (error) {
    console.error('Lỗi khi tạo người dùng:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi tạo người dùng: ' + error.message 
    }, { status: 500 });
  }
}

// PATCH /api/users/[id] - Cập nhật thông tin người dùng
export async function PATCH(request) {
  try {
    // Kiểm tra quyền admin (bỏ comment nếu muốn bật)
    // if (!(await checkAdminPermission(request))) {
    //   return NextResponse.json({ 
    //     success: false, 
    //     error: 'Không có quyền truy cập' 
    //   }, { status: 403 });
    // }
    
    // Lấy id từ query parameter
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID người dùng là bắt buộc' 
      }, { status: 400 });
    }
    
    // Lấy dữ liệu từ request
    const body = await request.json();
    const { displayName, phoneNumber, role, status, additionalInfo, canViewAllCourses, accountType, trialEndsAt } = body;
    
    // Kết nối đến MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'kimvan');
    
    // Cập nhật trong Firebase Auth
    try {
      const updateData = {};
      if (displayName !== undefined) updateData.displayName = displayName || null;
      
      // Xử lý phoneNumber
      if (phoneNumber !== undefined) {
        if (phoneNumber === null || phoneNumber === '') {
          // Nếu phoneNumber là null hoặc chuỗi rỗng, không thêm vào updateData
          // Firebase không chấp nhận null/empty cho phoneNumber
        } else {
          // Kiểm tra định dạng E.164
          if (phoneNumber.startsWith('+') && phoneNumber.length >= 8) {
            updateData.phoneNumber = phoneNumber;
          } else {
            // Nếu số điện thoại không đúng định dạng, trả về lỗi
            return NextResponse.json({
              success: false,
              error: 'Số điện thoại phải theo định dạng E.164 (ví dụ: +84xxxxxxxxx)'
            }, { status: 400 });
          }
        }
      }
      
      if (status !== undefined) updateData.disabled = status === 'inactive';
      
      // Chỉ cập nhật Firebase nếu có thông tin cần cập nhật
      if (Object.keys(updateData).length > 0) {
        await admin.auth().updateUser(id, updateData);
      }
      
      // Cập nhật trong MongoDB
      const mongoUpdateData = {
        updatedAt: new Date()
      };
      
      if (displayName !== undefined) mongoUpdateData.displayName = displayName;
      if (phoneNumber !== undefined) mongoUpdateData.phoneNumber = phoneNumber;
      if (role !== undefined) mongoUpdateData.role = role;
      if (status !== undefined) mongoUpdateData.status = status;
      if (additionalInfo !== undefined) mongoUpdateData.additionalInfo = additionalInfo;
      
      // Xác định loại tài khoản và quyền xem khóa học
      let userAccountType = accountType;
      let userCanViewAllCourses = canViewAllCourses;
      
      // Nếu đang cập nhật loại tài khoản
      if (userAccountType !== undefined) {
        mongoUpdateData.accountType = userAccountType;
        
        // Nếu chuyển sang tài khoản dùng thử, luôn bật quyền xem tất cả khóa học
        if (userAccountType === 'trial') {
          mongoUpdateData.canViewAllCourses = true;
        } 
        // Nếu không phải chuyển sang tài khoản dùng thử và có cập nhật quyền xem khóa học
        else if (userCanViewAllCourses !== undefined) {
          mongoUpdateData.canViewAllCourses = userCanViewAllCourses;
        }
      } 
      // Nếu không cập nhật loại tài khoản nhưng có cập nhật quyền xem khóa học
      else if (userCanViewAllCourses !== undefined) {
        // Lấy thông tin người dùng hiện tại để kiểm tra loại tài khoản
        const existingUser = await db.collection('users').findOne({ firebaseId: id });
        
        // Nếu là tài khoản dùng thử, không cho phép tắt quyền xem khóa học
        if (existingUser && existingUser.accountType === 'trial') {
          mongoUpdateData.canViewAllCourses = true;
        } else {
          mongoUpdateData.canViewAllCourses = userCanViewAllCourses;
        }
      }
      
      if (trialEndsAt !== undefined) mongoUpdateData.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : null;
      
      // Kiểm tra xem bản ghi đã tồn tại trong MongoDB chưa
      const existingUser = await db.collection('users').findOne({ firebaseId: id });
      
      if (existingUser) {
        // Cập nhật bản ghi hiện có
        await db.collection('users').updateOne(
          { firebaseId: id },
          { $set: mongoUpdateData }
        );
      } else {
        // Tạo bản ghi mới nếu chưa tồn tại
        const userRecord = await admin.auth().getUser(id);
        
        // Xác định loại tài khoản và quyền xem khóa học cho bản ghi mới
        const newUserAccountType = accountType || 'regular';
        const newUserCanViewAllCourses = newUserAccountType === 'trial' ? true : (canViewAllCourses || false);
        
        await db.collection('users').insertOne({
          firebaseId: id,
          email: userRecord.email,
          displayName: userRecord.displayName || displayName || null,
          phoneNumber: userRecord.phoneNumber || phoneNumber || null,
          role: role || 'user',
          status: status || 'active',
          emailVerified: userRecord.emailVerified || false,
          additionalInfo: additionalInfo || {},
          accountType: newUserAccountType,
          trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
          canViewAllCourses: newUserCanViewAllCourses,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      return NextResponse.json({ 
        success: true,
        data: { id }
      });
    } catch (error) {
      console.error('Firebase error:', error);
      // Xử lý lỗi Firebase Auth
      const { message, status } = handleFirebaseError(error);
      return NextResponse.json({ 
        success: false, 
        error: message 
      }, { status });
    }
  } catch (error) {
    console.error('Lỗi khi cập nhật người dùng:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi cập nhật người dùng: ' + error.message 
    }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Xóa người dùng
export async function DELETE(request) {
  try {
    // Kiểm tra quyền admin (bỏ comment nếu muốn bật)
    // if (!(await checkAdminPermission(request))) {
    //   return NextResponse.json({ 
    //     success: false, 
    //     error: 'Không có quyền truy cập' 
    //   }, { status: 403 });
    // }
    
    // Lấy ID người dùng từ URL
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    console.log(`[DELETE] Đang xóa người dùng với ID: ${id}`);

    if (!id) {
      console.log('[DELETE] Lỗi: Thiếu ID người dùng');
      return NextResponse.json({ 
        success: false, 
        error: 'Thiếu ID người dùng' 
      }, { status: 400 });
    }

    // Kết nối đến MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'kimvan');
    
    try {
      console.log(`[DELETE] Đang xóa người dùng trong Firebase Auth: ${id}`);
      // Xóa người dùng trong Firebase Auth
      await admin.auth().deleteUser(id);
      console.log(`[DELETE] Đã xóa người dùng trong Firebase Auth thành công: ${id}`);
      
      console.log(`[DELETE] Đang xóa thông tin người dùng trong MongoDB: ${id}`);
      // Xóa thông tin trong MongoDB
      const deleteResult = await db.collection('users').deleteOne({ firebaseId: id });
      console.log(`[DELETE] Kết quả xóa trong MongoDB:`, deleteResult);

      return NextResponse.json({ 
        success: true,
        message: 'Xóa người dùng thành công'
      });
    } catch (error) {
      console.error(`[DELETE] Lỗi khi xóa người dùng: ${error.code || 'unknown'}`, error);
      
      // Xử lý lỗi Firebase Auth
      if (error.code === 'auth/user-not-found') {
        console.log(`[DELETE] Người dùng không tồn tại trong Firebase, tiếp tục xóa trong MongoDB: ${id}`);
        // Nếu không tìm thấy trong Firebase, vẫn xóa trong MongoDB
        const deleteResult = await db.collection('users').deleteOne({ firebaseId: id });
        console.log(`[DELETE] Kết quả xóa trong MongoDB (sau lỗi Firebase):`, deleteResult);
        
        return NextResponse.json({ 
          success: true,
          message: 'Xóa thông tin người dùng thành công'
        });
      }
      
      const { message, status } = handleFirebaseError(error);
      return NextResponse.json({ 
        success: false, 
        error: message 
      }, { status });
    }
  } catch (error) {
    console.error('Lỗi khi xóa người dùng:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi xóa người dùng: ' + error.message 
    }, { status: 500 });
  }
}

// PUT /api/users/[id]/reset-password - Đặt lại mật khẩu
export async function PUT(request) {
  try {
    // Kiểm tra quyền admin (bỏ comment nếu muốn bật)
    // if (!(await checkAdminPermission(request))) {
    //   return NextResponse.json({ 
    //     success: false, 
    //     error: 'Không có quyền truy cập' 
    //   }, { status: 403 });
    // }
    
    // Lấy ID người dùng từ URL
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Thiếu ID người dùng' 
      }, { status: 400 });
    }

    // Xử lý các hành động khác nhau
    if (action === 'reset-password') {
      // Lấy dữ liệu từ request
      const body = await request.json();
      const { newPassword } = body;

      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ 
          success: false, 
          error: 'Mật khẩu mới phải có ít nhất 6 ký tự' 
        }, { status: 400 });
      }

      try {
        // Cập nhật mật khẩu
        await admin.auth().updateUser(id, {
          password: newPassword
        });

        return NextResponse.json({ 
          success: true,
          message: 'Đặt lại mật khẩu thành công'
        });
      } catch (error) {
        const { message, status } = handleFirebaseError(error);
        return NextResponse.json({ 
          success: false, 
          error: message 
        }, { status });
      }
    } else if (action === 'verify-email') {
      try {
        // Đánh dấu email đã xác thực
        await admin.auth().updateUser(id, {
          emailVerified: true
        });

        return NextResponse.json({ 
          success: true,
          message: 'Đánh dấu email đã xác thực thành công'
        });
      } catch (error) {
        const { message, status } = handleFirebaseError(error);
        return NextResponse.json({ 
          success: false, 
          error: message 
        }, { status });
      }
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Hành động không hợp lệ' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Lỗi khi xử lý yêu cầu:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi xử lý yêu cầu: ' + error.message 
    }, { status: 500 });
  }
} 