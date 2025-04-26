import * as admin from 'firebase-admin';

// Kiểm tra xem app đã được khởi tạo chưa
let firebaseAdmin;

if (!admin.apps.length) {
  // Lấy biến môi trường với fallback để đảm bảo tính linh hoạt
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY;
  const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

  try {
    // Nếu có cấu hình đầy đủ, khởi tạo Firebase Admin
    if (projectId && clientEmail && privateKey) {
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          // Thay thế ký tự xuống dòng trong private key
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        databaseURL: databaseURL || `https://${projectId}.firebaseio.com`,
      });
      console.log('Firebase Admin SDK đã được khởi tạo thành công');
    } else {
      throw new Error('Thiếu thông tin cấu hình Firebase Admin. Sử dụng giả lập cho môi trường phát triển.');
    }
  } catch (error) {
    console.warn('Sử dụng Firebase Admin giả lập cho môi trường phát triển:', error.message);
    
    // Mock Firebase Admin API cho môi trường phát triển
    firebaseAdmin = {
      auth: () => ({
        listUsers: async () => ({
          users: [
            {
              uid: 'user1',
              email: 'user1@example.com',
              displayName: 'Người dùng 1',
              phoneNumber: '+84123456789',
              photoURL: 'https://example.com/photo.jpg',
              emailVerified: true,
              disabled: false,
              metadata: {
                creationTime: '2023-01-01T00:00:00.000Z',
                lastSignInTime: '2023-06-01T00:00:00.000Z',
              },
            },
            {
              uid: 'user2',
              email: 'user2@example.com',
              displayName: 'Người dùng 2',
              phoneNumber: null,
              photoURL: null,
              emailVerified: false,
              disabled: false,
              metadata: {
                creationTime: '2023-02-01T00:00:00.000Z',
                lastSignInTime: '2023-05-01T00:00:00.000Z',
              },
            },
            {
              uid: 'admin1',
              email: 'admin@example.com',
              displayName: 'Quản trị viên',
              phoneNumber: '+84987654321',
              photoURL: 'https://example.com/admin.jpg',
              emailVerified: true,
              disabled: false,
              metadata: {
                creationTime: '2022-12-01T00:00:00.000Z',
                lastSignInTime: '2023-06-10T00:00:00.000Z',
              },
            },
          ],
        }),
        getUserByEmail: async (email) => {
          if (email === 'admin@example.com') {
            return {
              uid: 'admin1',
              email: 'admin@example.com',
              displayName: 'Quản trị viên',
              emailVerified: true,
            };
          } else if (email === 'user1@example.com') {
            return {
              uid: 'user1',
              email: 'user1@example.com',
              displayName: 'Người dùng 1',
              emailVerified: true,
            };
          }
          throw new Error('User not found');
        },
        createUser: async (userData) => ({
          uid: 'new-user-' + Date.now(),
          ...userData,
          metadata: {
            creationTime: new Date().toISOString(),
            lastSignInTime: null,
          },
        }),
        updateUser: async (uid, userData) => ({
          uid,
          ...userData,
        }),
        getUser: async (uid) => {
          if (uid.startsWith('user') || uid.startsWith('admin') || uid.startsWith('new-user')) {
            return {
              uid,
              email: `${uid}@example.com`,
              displayName: uid.startsWith('admin') ? 'Quản trị viên' : 'Người dùng',
              phoneNumber: null,
              photoURL: null,
              emailVerified: true,
              disabled: false,
              metadata: {
                creationTime: new Date().toISOString(),
                lastSignInTime: new Date().toISOString(),
              },
            };
          }
          throw new Error('User not found');
        },
        deleteUser: async (uid) => true,
      }),
    };
  }
} else {
  firebaseAdmin = admin;
}

export default firebaseAdmin; 