# Hướng dẫn sử dụng Token KimVan

## Giới thiệu

Tài liệu này hướng dẫn cách lấy và sử dụng token từ KimVan để xác thực các yêu cầu API. Hệ thống đã được cập nhật để hỗ trợ cả JWT token (thông qua Authorization Bearer) và session token (thông qua cookie).

## Cách thức hoạt động

Token KimVan được sử dụng để xác thực yêu cầu đến API của KimVan và cho phép truy cập vào các tài nguyên mà không cần đăng nhập lại mỗi lần. Token được lưu trữ an toàn trong một file JSON trên máy chủ, và được sử dụng tự động cho các yêu cầu API.

### Quá trình tự động

1. Người dùng đăng nhập vào KimVan thông qua trình duyệt
2. Sau khi đăng nhập thành công, hệ thống tự động truy xuất token từ localStorage hoặc cookie của trình duyệt
3. Token được gửi đến máy chủ và lưu trữ an toàn để sử dụng cho các yêu cầu API tương lai

## Cách lấy token

### Phương pháp 1: Sử dụng giao diện quản trị (khuyến nghị)

1. Đăng nhập vào hệ thống quản trị
2. Điều hướng đến phần "Thiết lập YouTube" > "Cập nhật Token KimVan"
3. Nhấp vào nút "Mở trang KimVan" để mở trang KimVan trong tab mới
4. Đăng nhập vào tài khoản KimVan của bạn
5. Quay lại tab trước và nhấp vào nút "Kiểm tra token" màu xanh
6. Hệ thống sẽ tự động phát hiện và lưu token của bạn

### Phương pháp 2: Lấy token thủ công

Nếu phương pháp tự động không hoạt động, bạn có thể lấy token thủ công:

1. Đăng nhập vào KimVan (https://kimvan.id.vn)
2. Mở DevTools (F12) trong trình duyệt
3. Đi đến tab "Application" > "Storage" > "Local Storage"
4. Tìm key có tên `accessToken` và sao chép giá trị
5. Dán giá trị vào ô nhập token trong trang "Cập nhật Token KimVan"

## Các loại token được hỗ trợ

Hệ thống sẽ tự động phát hiện loại token và sử dụng phương thức xác thực phù hợp:

### 1. JWT Token (Authorization Bearer)

```
eyJhbGciOiJIUzI1NiJ9.eyJ1aWQiOiJlUkdaeWw3TVU4WTBROGptblRsZnA2THdYQW4xIiwiZW1haWwiOiJraWVuQGdtYWlsLmNvbSIsImV4cCI6MTc0NDkwNTQ3MH0.YBWZmoZ0n8PY6QC5OIS9A9SmxRwKK7WGdfHOFMLWhQQ
```

JWT token được gửi trong header `Authorization: Bearer <token>`.

### 2. Session Token (Cookie)

```
eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoibjBVdUpXSWdOZmZYbXU3enliYjFaTHdOWHJNNDQ2bEdTSWNBSDZUSVJZNkktVWdybWd1WGtLczdmTXlPU09xUVhEc2lZSzI3bW5yZmJURGRlUW9ud2cifQ..Bl6rIRsZyxO9aben5pzy-Q.E5PGDdwOUSfR0W6k-1igZ6Ni7W5MDWbpRnjuEMf8UTt9pBqouRJaoBx87GwBt-AAHxck9KBWWUbd7NjXvhkViryCPzf1vd-uXLCU22B2oKxdESRXndk-Goxixyehu7Ry7nKNmElIc0uHbPXVzCOtR5GbYi5S2rz-6v63XtSCWm08WVK_o0A3sM0-T09nL_kENtYRBxFiIeRJPtVPEhasV5xbwmQSyo5eKOkMlZZ6XOm32cc63ETwPA9MN4KtOw_T1D_hKPFTJHpDU-28vfIoKoVG_z29VCHjjoQ5x4_kO8NtXtsGoyQjmjyZpCwZPv2OSwubp1ikhxv1PY8vd9HWPO1zBPQKD1Jpsr-4qwb7dLQegBfZMmALRAvcToxLlPnx.ldyRynfzEwGb5lDPU4lvpaXkROE8_RjcRt9-m4PWr9k
```

Session token được gửi trong cookie theo định dạng:
```
__Host-authjs.csrf-token=255bd05b44d8c546476d3294676d36836f397de559807dcdd55957d6296b7b49%7Ca69e1a22b47f43c851e93ab3c667111509b145d72b0ac1907c3060c63e1dfa73; __Secure-authjs.callback-url=https%3A%2F%2Fkimvan.id.vn%2F; __Secure-authjs.session-token=<token>
```

## Xử lý lỗi phổ biến

### Rate Limiting (429 Too Many Requests)

Nếu bạn gặp lỗi 429, hãy chờ vài phút trước khi thử lại. Hệ thống đã được cập nhật để tự động xử lý:

1. Thêm delay giữa các request
2. Tự động retry khi gặp lỗi rate limit
3. Cache kết quả để giảm số lượng request

### Token không hợp lệ

Nếu token không hợp lệ, hãy thử các bước sau:

1. Đăng xuất và đăng nhập lại vào KimVan
2. Lấy token mới theo các phương pháp ở trên
3. Xóa token cũ và cập nhật token mới

## Khắc phục sự cố

Nếu vẫn gặp vấn đề khi sử dụng token:

1. Kiểm tra logs trong giao diện quản trị để xem lỗi chi tiết
2. Đảm bảo token chưa hết hạn (hệ thống tự động gia hạn token lưu trữ thêm 30 ngày)
3. Kiểm tra kết nối mạng đến KimVan API

## Cập nhật mới nhất

- Thay thế API endpoint từ `kimvan-cookie` sang `kimvan-token`
- Hỗ trợ cả JWT token và Session token 
- Tự động phát hiện loại token và sử dụng phương thức xác thực phù hợp
- Định dạng cookie chuẩn theo yêu cầu của KimVan API
- Thêm log chi tiết để dễ dàng debug

## Quản lý token

- **Thời hạn token**: Token có thời hạn 30 ngày mặc định.
- **Làm mới token**: Khi token hết hạn, bạn cần lấy token mới bằng cách thực hiện lại các bước trên.
- **Xóa token**: Bạn có thể xóa token hiện tại từ giao diện "Cập nhật Token KimVan" bằng cách nhấp vào nút "Xóa token hiện tại".

## Giải quyết sự cố

Nếu bạn gặp vấn đề khi lấy hoặc sử dụng token:

1. **Token không được phát hiện**: Đảm bảo bạn đã đăng nhập vào KimVan trong tab mới trước khi nhấp vào "Kiểm tra token".
2. **Lỗi xác thực**: Token có thể đã hết hạn. Thử lấy token mới.
3. **Lỗi API**: Kiểm tra logs máy chủ để biết thêm thông tin chi tiết về lỗi.

## Thông tin bổ sung

- Token được lưu trữ trong file `kimvan_token.json` trên máy chủ.
- Hệ thống vẫn hỗ trợ tương thích ngược với việc sử dụng cookie từ biến môi trường `KIMVAN_COOKIE` nếu không tìm thấy token.

---

Cập nhật lần cuối: Tháng 11/2023 