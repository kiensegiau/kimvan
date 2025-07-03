# Hướng Dẫn Khắc Phục Lỗi ERR_TOO_MANY_REDIRECTS trên VPS

Vấn đề bạn đang gặp phải là do sự khác biệt giữa môi trường phát triển local (chạy trên máy tính của bạn) và môi trường triển khai (VPS). Trên máy tính local, ứng dụng chạy đúng, nhưng trên VPS gặp lỗi ERR_TOO_MANY_REDIRECTS.

## Nguyên nhân

Vấn đề chính là do:

1. Trên VPS, ứng dụng đang chạy qua HTTP (không phải HTTPS)
2. Hệ thống đang tự động thiết lập cookie với tùy chọn `secure: true` (chỉ hoạt động trên HTTPS)
3. Điều này khiến cookie không được gửi trong các yêu cầu HTTP, dẫn đến vòng lặp chuyển hướng

## Cách khắc phục

### 1. Tạo file `.env.local` trên VPS

Tạo file `.env.local` trong thư mục gốc của dự án trên VPS với nội dung sau:

```
# Cấu hình chung
NODE_ENV=production

# Cấu hình HTTP/HTTPS
# Đặt thành true vì VPS đang chạy HTTP
VPS_HTTP=true

# Hoặc đặt HTTPS_ENABLED=false cũng được
HTTPS_ENABLED=false
```

### 2. Khởi động lại ứng dụng

Sau khi tạo file `.env.local`, khởi động lại ứng dụng Next.js:

```bash
npm run build
npm run start
```

Hoặc nếu bạn đang sử dụng PM2:

```bash
pm2 restart all
```

### 3. Nếu vẫn không hoạt động

Nếu sau khi áp dụng các bước trên vẫn không khắc phục được vấn đề, hãy thử các bước sau:

#### Xóa cookie hiện tại

Trên trình duyệt của bạn, hãy xóa tất cả cookie liên quan đến trang web để bắt đầu lại từ đầu.

#### Kiểm tra cấu hình middleware

Kiểm tra file `src/middleware.js` để đảm bảo rằng đường dẫn `/api/users/me` đã được loại trừ khỏi middleware:

```javascript
// Đường dẫn API đặc biệt cần loại trừ khỏi middleware hoàn toàn
const EXCLUDED_API_PATHS = [
  '/api/users/me',
  '/api/auth/verify',
  '/api/auth/refresh-token',
  '/api/auth/user-role'
];

// Trong hàm middleware
if (EXCLUDED_API_PATHS.some(path => pathname.startsWith(path))) {
  return response;
}
```

#### Sửa đổi cookie trực tiếp trong code

Nếu cách trên vẫn không giải quyết được vấn đề, bạn có thể sửa đổi trực tiếp cấu hình cookie trong `src/config/env-config.js`:

```javascript
// Cấu hình Cookie
export const cookieConfig = {
  authCookieName: 'auth-token',
  defaultMaxAge: 60 * 60 * 24 * 30, // 30 ngày
  extendedMaxAge: 60 * 60 * 24 * 180, // 180 ngày
  // Đặt cứng secure là false khi chạy trên VPS HTTP
  secure: false,
  httpOnly: true,
  sameSite: 'lax'
};
```

## Giải pháp dài hạn

Để giải quyết vấn đề này một cách dài hạn:

1. **Cấu hình HTTPS cho VPS**: Sử dụng Let's Encrypt để cài đặt SSL miễn phí cho VPS.

2. **Sử dụng Nginx hoặc Apache làm reverse proxy**: Cấu hình để chuyển tiếp yêu cầu HTTPS đến ứng dụng Next.js.

3. **Điều chỉnh cảm biến HTTP/HTTPS**: Đảm bảo ứng dụng luôn có thể phát hiện chính xác giao thức được sử dụng.

## Tài liệu tham khảo

- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Tài liệu về Cookies trong Next.js](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [Cấu hình HTTPS cho VPS](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-20-04) 