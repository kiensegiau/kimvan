# Hướng dẫn thiết lập biến môi trường

Để dự án hoạt động đúng, bạn cần tạo file `.env.local` tại thư mục gốc của dự án với các biến môi trường sau:

```env
# Firebase API Key (cần thiết cho Firebase Auth REST API)
FIREBASE_API_KEY=your-api-key

# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=your-project
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Private Key Here\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-email@your-project.iam.gserviceaccount.com

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/your-database?retryWrites=true&w=majority

# Application
NODE_ENV=development
```

## Lấy Firebase API Key

Mặc dù chúng ta chủ yếu sử dụng Firebase Admin SDK, nhưng vẫn cần Firebase API Key để xác thực người dùng qua Firebase Auth REST API:

1. Đăng nhập vào [Firebase Console](https://console.firebase.google.com/)
2. Chọn dự án của bạn
3. Đi đến "Project settings" (Cài đặt dự án)
4. Trong tab "General" (Chung), cuộn xuống phần "Your apps" (Ứng dụng của bạn)
5. Chọn ứng dụng web của bạn hoặc tạo một ứng dụng mới nếu chưa có
6. Sao chép Web API Key

## Lấy thông tin Firebase Admin SDK

1. Trong Firebase Console, đi đến "Project settings" (Cài đặt dự án)
2. Chọn tab "Service accounts" (Tài khoản dịch vụ)
3. Nhấp vào "Generate new private key" (Tạo khóa riêng tư mới)
4. Tải xuống file JSON
5. Sao chép thông tin từ file JSON vào các biến môi trường tương ứng:
   - `project_id` → FIREBASE_ADMIN_PROJECT_ID
   - `private_key` → FIREBASE_ADMIN_PRIVATE_KEY (giữ nguyên định dạng với \n)
   - `client_email` → FIREBASE_ADMIN_CLIENT_EMAIL

## Lấy thông tin MongoDB

1. Đăng nhập vào [MongoDB Atlas](https://cloud.mongodb.com/)
2. Chọn dự án của bạn
3. Nhấp vào "Connect" (Kết nối) cho cluster của bạn
4. Chọn "Connect your application" (Kết nối ứng dụng của bạn)
5. Sao chép chuỗi kết nối và thay thế `<username>`, `<password>`, và `<dbname>` bằng thông tin của bạn 