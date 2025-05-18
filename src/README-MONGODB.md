# Tối ưu hóa kết nối MongoDB trong ứng dụng Next.js

## Vấn đề
Trong quá trình phát triển và vận hành API, chúng ta gặp phải hiện tượng *"Kết nối MongoDB thành công"* xuất hiện nhiều lần trong log hệ thống. Nguyên nhân là do mỗi lần gọi API, ứng dụng lại tạo một kết nối mới đến MongoDB, dẫn đến:

1. **Lãng phí tài nguyên**: Mỗi kết nối sẽ tiêu tốn bộ nhớ và CPU
2. **Hiệu suất kém**: Phải chờ thiết lập kết nối mới cho từng request
3. **Rủi ro quá tải**: Có thể vượt quá giới hạn kết nối của MongoDB (mặc định là 100 kết nối)

## Giải pháp

Áp dụng các kỹ thuật tối ưu kết nối sau:

### 1. Tối ưu hóa kết nối Native MongoDB
- Cải tiến file `src/lib/mongodb.js`
- Thực hiện caching kết nối trong biến global
- Thêm cờ trạng thái kiểm soát quá trình kết nối
- Tránh log không cần thiết cho mỗi lần kết nối

### 2. Tạo kết nối Mongoose được chia sẻ toàn ứng dụng
- Tạo file `src/lib/mongoose.js` mới
- Cung cấp hàm `dbConnect()` sử dụng caching và theo dõi trạng thái
- Đảm bảo chỉ một kết nối Mongoose cho toàn ứng dụng

### 3. Cập nhật các API Route
- Thay thế các hàm kết nối tự tạo (`connectDB`) bằng hàm `dbConnect()` mới
- Đảm bảo nhất quán trong toàn hệ thống

## Lợi ích
- **Giảm tài nguyên sử dụng**: Dùng lại kết nối sẵn có
- **Tăng hiệu năng API**: Không phải chờ thiết lập kết nối mới
- **Đảm bảo ổn định**: Không vượt quá giới hạn kết nối khi lưu lượng tăng cao
- **Dễ bảo trì**: Mã nguồn đồng nhất, dễ quản lý

## Cách sử dụng
```javascript
// Import hàm kết nối
import dbConnect from '@/lib/mongoose';

// Trong API Route handler:
export async function GET(request) {
  try {
    // Kết nối đến MongoDB - tự động sử dụng kết nối cache
    await dbConnect();
    
    // Thực hiện truy vấn với Mongoose models
    const data = await Model.find();
    
    return NextResponse.json(data);
  } catch (error) {
    // Xử lý lỗi
  }
}
```

## Theo dõi hiệu năng
Sau khi triển khai cải tiến, không còn hiện tượng lặp lại nhiều dòng *"Kết nối MongoDB thành công"* trong log hệ thống nữa, đồng thời giảm thời gian phản hồi của API và giảm tải tài nguyên server. 