# Sửa lỗi kết nối MongoDB

## Vấn đề
Hệ thống đã gặp phải vấn đề tạo quá nhiều kết nối MongoDB, gây ra thông báo:
```
🔄 Đang khởi tạo kết nối MongoDB mới...
✅ Kết nối MongoDB thành công và được cache
```
xuất hiện nhiều lần trong log, dẫn đến quá tải MongoDB.

## Nguyên nhân
1. **Biến lưu trữ kết nối ở cấp module**: Biến `cachedConnection` được định nghĩa ở cấp module trong file `mongodb.js`, không phải ở cấp global, nên mỗi lần import lại tạo ra một instance mới.
2. **Worker threads**: Các worker thread trong quá trình xử lý PDF cũng tạo ra các kết nối MongoDB riêng.
3. **Không có cơ chế ngăn chặn rõ ràng** để tránh tạo nhiều kết nối trong các worker thread.

## Giải pháp
1. **Chuyển biến lưu trữ kết nối lên cấp global**:
   - Thay thế `cachedConnection` bằng `global._mongoConnection`
   - Đảm bảo biến này được chia sẻ giữa tất cả các module và worker thread

2. **Ngăn chặn kết nối MongoDB trong worker threads**:
   - Thêm cờ `return` sớm trong worker thread để đảm bảo không chạy code tạo kết nối MongoDB
   - Đặt `shouldConnectDB = false` cố định trong workers.js
   - Thêm cờ `isWorkerThread` để kiểm tra môi trường

3. **Tối ưu hóa quá trình đợi kết nối**:
   - Đảm bảo các tiến trình đợi kết nối hiện có thay vì tạo kết nối mới

## Các file đã sửa
1. `src/lib/mongodb.js`: Chuyển biến lưu trữ kết nối lên cấp global
2. `src/app/api/drive/remove-watermark/route.js`: Thêm return sớm cho worker threads
3. `src/app/api/drive/remove-watermark/lib/workers.js`: Đặt shouldConnectDB là constant
4. `src/app/api/drive/remove-watermark/lib/watermark.js`: Thêm kiểm tra isWorkerThread

## Kiểm tra
Sau khi triển khai các thay đổi, hãy kiểm tra log hệ thống để đảm bảo:
1. Thông báo "Đang khởi tạo kết nối MongoDB mới..." chỉ xuất hiện một lần khi khởi động ứng dụng
2. Không có thông báo kết nối MongoDB từ các worker thread
3. Số lượng kết nối đến MongoDB giảm đáng kể

## Theo dõi
Sử dụng API endpoint `/api/health-check/mongodb` để theo dõi số lượng kết nối và trạng thái kết nối MongoDB. 