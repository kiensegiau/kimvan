# Hướng dẫn làm mới token Google Drive tự động

Hệ thống được thiết kế để tự động làm mới token Google Drive, giúp tránh tình trạng token hết hạn và làm gián đoạn hoạt động tải lên/tải xuống.

## Cơ chế làm mới token

### 1. Tự động làm mới token

Hệ thống sử dụng một service chạy trong Node.js để tự động làm mới token:

- **Tần suất kiểm tra**: Mỗi 30 phút một lần
- **Buffer thời gian**: Làm mới nếu token sắp hết hạn trong vòng 5 phút
- **Khởi động tự động**: Service tự khởi động khi server chạy thông qua middleware

### 2. Hoạt động của service

Service hoạt động như sau:

1. Tự động khởi động khi server bắt đầu chạy (thông qua middleware)
2. Kiểm tra token mỗi 30 phút
3. Nếu token sắp hết hạn, tự động làm mới và lưu lại

### 3. Token Storage

Token được lưu trữ trong các file sau:

- **Tài khoản tải lên**: `drive_token_upload.json`
- **Tài khoản tải xuống**: `drive_token_download.json`

## Các thành phần chính

### Service làm mới token

Mã nguồn chính của service nằm trong các file:

- **token-refresh-service.js**: Logic chính để làm mới token
- **start-refresh-service.js**: Khởi động service
- **middleware.js**: Middleware của Next.js, đảm bảo service tự khởi động khi server bắt đầu chạy

### Cách service khởi động

Service được khởi động theo cách sau:

1. **Bằng middleware**: Khi server khởi động, middleware.js được thực thi, tự động import và khởi động service
2. **Tự khởi động**: Không cần gọi API hay thiết lập cron job
3. **Áp dụng cho tất cả đường dẫn**: Middleware được cấu hình để đảm bảo luôn được thực thi

### Ưu điểm của phương pháp này

- **Hoàn toàn tự động**: Không cần cron job, không cần cấu hình thêm
- **Độc lập với hosting**: Hoạt động trên mọi loại hosting
- **Khởi động ngay**: Service bắt đầu ngay khi server khởi động

## Kiểm tra thủ công

Bạn có thể kiểm tra việc làm mới token thủ công bằng cách:

1. Truy cập trang thiết lập Google Drive trong admin.
2. Nhấn nút "Làm mới token ngay bây giờ".
3. Kiểm tra kết quả trên giao diện và trong log server.

## Xử lý sự cố

Nếu token không được làm mới tự động:

1. Kiểm tra log để tìm lỗi.
2. Đảm bảo refresh_token tồn tại trong file token.
3. Khởi động lại server (service sẽ tự khởi động lại).
4. Xác thực lại tài khoản nếu cần.

---

**Lưu ý**: Để token luôn có thể được làm mới, đảm bảo rằng khi xác thực với Google:
- Sử dụng `access_type: 'offline'`
- Sử dụng `prompt: 'consent'`

Cả hai tùy chọn này đã được thiết lập sẵn trong code. 