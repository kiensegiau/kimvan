import * as admin from 'firebase-admin';

// Kiểm tra xem app đã được khởi tạo chưa
let firebaseAdmin;

if (!admin.apps.length) {
  // Nếu không có service account, sử dụng biến môi trường
  try {
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Thay thế ký tự xuống dòng trong private key
        privateKey: process.env.FIREBASE_PRIVATE_KEY 
          ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          : undefined,
      }),
      // Nếu có cấu hình databaseURL
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    console.log('Firebase Admin SDK đã được khởi tạo thành công');
  } catch (error) {
    console.error('Lỗi khởi tạo Firebase Admin:', error);
    
    // Tạo giả lập nếu không có cấu hình Firebase
    console.warn('Sử dụng Firebase Admin giả lập cho mục đích phát triển');
    
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