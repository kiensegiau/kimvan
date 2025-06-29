# Tối ưu hóa kết nối cơ sở dữ liệu trong KimVan

Tài liệu này mô tả các cải tiến đã được thực hiện để tối ưu hóa kết nối cơ sở dữ liệu MongoDB trong ứng dụng KimVan.

## Vấn đề

Trước đây, mỗi API route đều gọi `await connectDB()` trực tiếp trong mã nguồn, dẫn đến:
- Nhiều lần gọi kết nối không cần thiết
- Mã nguồn trùng lặp
- Khó bảo trì và quản lý

## Giải pháp

Chúng tôi đã triển khai giải pháp middleware kết nối cơ sở dữ liệu tự động, bao gồm:

1. **Middleware toàn cục cho API routes**: Tự động kết nối DB trước khi xử lý API request
2. **Middleware có thể tái sử dụng**: Cho các trường hợp đặc biệt cần kiểm soát kết nối DB
3. **Script tự động cập nhật mã nguồn**: Để loại bỏ các lệnh gọi `connectDB()` trực tiếp

## Các file đã thêm/sửa

1. **src/utils/db-middleware.js**: Middleware có thể tái sử dụng
2. **src/middleware.js**: Cập nhật middleware toàn cục
3. **src/scripts/remove-db-connections.js**: Script để tự động cập nhật mã nguồn

## Cách sử dụng

### Middleware toàn cục (tự động)

Middleware toàn cục đã được cấu hình để tự động kết nối DB cho tất cả các API routes. Bạn không cần làm gì thêm, middleware sẽ tự động:
- Kiểm tra xem route có cần kết nối DB không
- Kết nối DB nếu cần
- Cho phép request tiếp tục xử lý

### Middleware có thể tái sử dụng

Trong các trường hợp đặc biệt, bạn có thể sử dụng middleware có thể tái sử dụng:

```javascript
// Cho API routes trong pages/api
import { withDatabase } from '@/utils/db-middleware';

export default withDatabase(async function handler(req, res) {
  // Xử lý API mà không cần gọi connectDB() nữa
  // DB đã được kết nối bởi middleware
});

// Cho API routes trong App Router
import { dbMiddleware } from '@/utils/db-middleware';

export async function GET(request) {
  // Kết nối DB trước khi xử lý request
  await dbMiddleware(request);
  
  // Xử lý request
  // ...
}
```

### Cập nhật mã nguồn hiện có

Để cập nhật mã nguồn hiện có và loại bỏ các lệnh gọi `connectDB()` trực tiếp:

1. Chạy script tự động:
   ```bash
   node src/scripts/remove-db-connections.js
   ```

2. Script sẽ:
   - Tìm tất cả các file API route có import và gọi `connectDB()`
   - Thay thế import bằng `import { dbMiddleware } from '@/utils/db-middleware'`
   - Thay thế các lệnh gọi `await connectDB()` bằng comment
   - Hiển thị danh sách các file đã được sửa

## Lợi ích

- **Giảm số lần kết nối DB**: Chỉ kết nối khi cần thiết
- **Tái sử dụng kết nối**: Sử dụng cơ chế cache kết nối của Mongoose
- **Mã nguồn gọn gàng hơn**: Loại bỏ mã trùng lặp
- **Dễ bảo trì**: Tập trung logic kết nối DB vào một nơi
- **Hiệu suất tốt hơn**: Giảm thời gian xử lý request

## Lưu ý

- Middleware toàn cục chỉ áp dụng cho các API routes, không áp dụng cho các file khác
- Một số API routes đặc biệt (như xác thực) được loại trừ khỏi middleware kết nối DB
- Nếu bạn thêm API routes mới, không cần gọi `connectDB()` trực tiếp nữa 