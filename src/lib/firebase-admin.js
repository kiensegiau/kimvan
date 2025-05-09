import * as admin from 'firebase-admin';
import { firebaseAdminConfig, isDevelopment } from '@/config/env-config';

// Kiểm tra xem app đã được khởi tạo chưa
let firebaseAdmin;

if (!admin.apps.length) {
  try {
    // Log thông tin cấu hình để debug
    console.log('Firebase Admin Config:', {
      projectId: firebaseAdminConfig.projectId,
      clientEmail: firebaseAdminConfig.clientEmail,
      hasPrivateKey: !!firebaseAdminConfig.privateKey,
      privateKeyLength: firebaseAdminConfig.privateKey?.length,
      databaseURL: firebaseAdminConfig.databaseURL,
    });
    
    // Nếu có cấu hình đầy đủ, khởi tạo Firebase Admin
    if (firebaseAdminConfig.projectId && firebaseAdminConfig.clientEmail && firebaseAdminConfig.privateKey) {
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: firebaseAdminConfig.projectId,
          clientEmail: firebaseAdminConfig.clientEmail,
          // Thay thế ký tự xuống dòng trong private key
          privateKey: firebaseAdminConfig.privateKey,
        }),
        databaseURL: firebaseAdminConfig.databaseURL || `https://${firebaseAdminConfig.projectId}.firebaseio.com`,
      });
      console.log('Firebase Admin SDK đã được khởi tạo thành công');
    } else {
      // Log chi tiết về các giá trị bị thiếu
      const missingFields = [];
      if (!firebaseAdminConfig.projectId) missingFields.push('projectId');
      if (!firebaseAdminConfig.clientEmail) missingFields.push('clientEmail');
      if (!firebaseAdminConfig.privateKey) missingFields.push('privateKey');
      
      throw new Error(`Thiếu thông tin cấu hình Firebase Admin: ${missingFields.join(', ')}. Sử dụng giả lập cho môi trường phát triển.`);
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
        verifyIdToken: async (token) => {
          // Giả lập trả về thông tin token nếu là môi trường phát triển
          if (!token) throw new Error('Token không hợp lệ');
          
          if (token === 'test-admin-token') {
            return {
              uid: 'admin1',
              email: 'admin@example.com',
              email_verified: true,
              name: 'Quản trị viên',
              picture: 'https://example.com/admin.jpg',
              role: 'admin',
            };
          } else if (token === 'test-user-token') {
            return {
              uid: 'user1',
              email: 'user1@example.com',
              email_verified: true,
              name: 'Người dùng 1',
              picture: 'https://example.com/photo.jpg',
              role: 'user',
            };
          }
          
          // Mặc định trả về token hợp lệ cho môi trường phát triển
          return {
            uid: 'dev-user',
            email: 'dev@example.com',
            email_verified: true,
            name: 'Người dùng phát triển',
            picture: null,
            role: 'user',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
          };
        },
        
        // Thêm chức năng createCustomToken
        createCustomToken: async (uid, claims = {}) => {
          console.log(`Tạo custom token giả lập cho uid: ${uid}`);
          // Trả về một token giả lập cho môi trường phát triển
          return `dev-custom-token-${uid}-${Date.now()}`;
        },
        
        // Thêm chức năng generatePasswordResetLink
        generatePasswordResetLink: async (email) => {
          console.log(`Tạo link đặt lại mật khẩu giả lập cho email: ${email}`);
          // Trả về một link giả lập cho môi trường phát triển
          return `https://example.com/reset-password?email=${encodeURIComponent(email)}&token=dev-reset-token-${Date.now()}`;
        }
      }),
    };
  }
} else {
  firebaseAdmin = admin;
}

export default firebaseAdmin; 