# Hướng dẫn sử dụng tính năng lấy cookie KimVan từ Chrome

Tính năng này cho phép bạn mở trình duyệt Chrome thật trên máy tính của mình để đăng nhập vào KimVan và lấy cookie xác thực, giúp hệ thống có thể tải video lên YouTube ngay cả khi phương thức xác thực OAuth thông thường gặp vấn đề.

## Cách sử dụng

### 1. Truy cập trang quản lý token

- Đăng nhập vào trang quản trị KimVan
- Truy cập vào menu "YouTube Settings" > "Chrome Token Update"

### 2. Sử dụng tính năng mở trình duyệt Chrome

- Nhấn vào nút "Mở KimVan trong trình duyệt"
- Hệ thống sẽ mở trình duyệt Chrome thật trên máy tính của bạn và điều hướng đến trang KimVan
- Cửa sổ trợ giúp sẽ xuất hiện với hướng dẫn chi tiết

### 3. Lấy cookie từ trình duyệt Chrome

Có hai cách để lấy cookie:

#### Cách 1: Sử dụng đoạn mã JavaScript (Khuyên dùng)

1. Sau khi đăng nhập vào trang KimVan, nhấn F12 hoặc chuột phải và chọn "Inspect" để mở DevTools
2. Chuyển đến tab "Console"
3. Sao chép đoạn mã JavaScript từ cửa sổ trợ giúp
4. Dán vào Console và nhấn Enter
5. Đoạn mã sẽ tự động tìm và sao chép cookie vào clipboard

#### Cách 2: Tìm cookie thủ công

1. Sau khi đăng nhập vào trang KimVan, nhấn F12 hoặc chuột phải và chọn "Inspect" để mở DevTools
2. Chuyển đến tab "Application" (nếu không thấy, hãy nhấp vào >> để tìm)
3. Ở cột bên trái, mở rộng mục "Cookies" và chọn "https://kimvan.id.vn"
4. Tìm cookie có tên "__Secure-authjs.session-token"
5. Sao chép giá trị của cookie

### 4. Cập nhật cookie vào hệ thống

1. Dán cookie đã sao chép vào ô "Nhập token từ Chrome DevTools"
2. Nhấn "Cập nhật Token"
3. Hệ thống sẽ kiểm tra và lưu cookie

## Xử lý sự cố

### Không thể mở trình duyệt Chrome

Nếu hệ thống không thể mở trình duyệt Chrome tự động:

1. Mở Chrome thủ công
2. Truy cập trang https://kimvan.id.vn
3. Đăng nhập và làm theo các bước còn lại như bình thường

### Cookie không hợp lệ

Nếu nhận được thông báo "Cookie không hợp lệ":

1. Đảm bảo bạn đã đăng nhập thành công vào trang KimVan
2. Kiểm tra lại cookie đã sao chép (phải là cookie "__Secure-authjs.session-token")
3. Thử đăng xuất và đăng nhập lại vào trang KimVan

## Thông tin bổ sung

- Cookie KimVan sẽ hết hạn sau khoảng 1 tuần
- Khi hết hạn, bạn cần thực hiện lại các bước trên để cập nhật cookie mới
- Cookie được lưu trong file JSON trên máy chủ (không lưu trong biến môi trường)
- Tính năng này chỉ hoạt động khi bạn có quyền truy cập vào máy chủ và trình duyệt Chrome đã được cài đặt

## Yêu cầu kỹ thuật

- Trình duyệt Chrome đã được cài đặt trên máy chủ
- Quyền truy cập để mở ứng dụng trên máy chủ (child_process)
- Kết nối internet để truy cập trang KimVan

## Lưu ý bảo mật

- Cookie này cho phép truy cập vào tài khoản KimVan của bạn, hãy bảo mật thông tin này
- Chỉ sử dụng tính năng này trên máy chủ an toàn
- Không chia sẻ cookie với người khác 