# Tối ưu hóa kết nối MongoDB trong ứng dụng Next.js

## Vấn đề
Trong quá trình phát triển và vận hành API, chúng ta gặp phải hiện tượng *"Kết nối MongoDB thành công"* xuất hiện nhiều lần trong log hệ thống và quá nhiều kết nối được tạo (hơn 500). Nguyên nhân là do mỗi lần gọi API, ứng dụng lại tạo một kết nối mới đến MongoDB, dẫn đến:

1. **Lãng phí tài nguyên**: Mỗi kết nối sẽ tiêu tốn bộ nhớ và CPU
2. **Hiệu suất kém**: Phải chờ thiết lập kết nối mới cho từng request
3. **Rủi ro quá tải**: Có thể vượt quá giới hạn kết nối của MongoDB (mặc định là 100 kết nối)

## Giải pháp Mới

Triển khai mô hình singleton thực sự cho kết nối MongoDB:

### 1. Hợp nhất các phương thức kết nối 
- Đã hợp nhất các file `src/lib/mongodb.js` và `src/lib/mongodb-connection.js`
- Triển khai cache kết nối ở cấp độ module với theo dõi trạng thái chi tiết
- Sử dụng cơ chế khóa để đảm bảo không có nhiều kết nối được tạo đồng thời

### 2. Tối ưu hóa cấu hình kết nối
- Thiết lập `maxPoolSize` và `minPoolSize` phù hợp
- Thêm tham số `maxIdleTimeMS` để đóng kết nối không sử dụng
- Xử lý đóng kết nối khi ứng dụng tắt

### 3. Giám sát kết nối
- Thêm API endpoint `/api/health-check/mongodb` để theo dõi số lượng kết nối
- Cung cấp API `/api/health-check/mongodb-reset` để reset kết nối trong trường hợp khẩn cấp
- Tính năng đếm số lần sử dụng kết nối từ cache

## Cách sử dụng API

```javascript
// Import hàm kết nối
import { connectDB } from '@/lib/mongodb';

// Trong API Route handler:
export async function GET(request) {
  try {
    // Kết nối đến MongoDB - sử dụng kết nối được cache
    await connectDB();
    
    // Thực hiện truy vấn với Mongoose models
    const data = await Model.find();
    
    return NextResponse.json(data);
  } catch (error) {
    // Xử lý lỗi
  }
}
```

## Theo dõi kết nối

Để kiểm tra số lượng kết nối hiện tại:

```
GET /api/health-check/mongodb
```

Để reset kết nối trong trường hợp khẩn cấp:

```
POST /api/health-check/mongodb-reset
{
  "admin_key": "YOUR_ADMIN_SECRET_KEY"
}
```

## Cấu hình trong .env

Thêm biến môi trường sau để sử dụng API reset:

```
# MongoDB
MONGODB_URI=mongodb://username:password@host:port/database
ADMIN_SECRET_KEY=your_secret_key_here
``` 