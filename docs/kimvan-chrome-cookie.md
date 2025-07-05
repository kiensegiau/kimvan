# Hướng dẫn lấy Cookie từ Chrome

## Bước 1: Cài đặt Extension

1. Mở Chrome Web Store
2. Tìm và cài đặt extension "Cookie Editor" hoặc "EditThisCookie"
3. Sau khi cài đặt, biểu tượng extension sẽ xuất hiện trên thanh công cụ

## Bước 2: Export Cookie

1. Đăng nhập vào Google Drive
2. Click vào biểu tượng extension Cookie Editor
3. Click nút "Export" để xuất cookie ra dạng JSON
4. Copy toàn bộ nội dung JSON

## Bước 3: Lưu Cookie

1. Tạo file `kimvan-cookie.json` trong thư mục gốc của project
2. Dán nội dung JSON vào file theo format:
```json
{
  "cookies": [
    {
      "name": "tên cookie",
      "value": "giá trị cookie",
      "domain": ".google.com"
    },
    ...
  ]
}
```

## Lưu ý

- Cookie có thời hạn sử dụng, cần làm mới khi hết hạn
- Không chia sẻ file cookie với người khác
- Chỉ lấy cookie từ domain `.google.com` và `.drive.google.com` 