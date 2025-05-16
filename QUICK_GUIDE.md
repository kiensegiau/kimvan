# Hướng dẫn nhanh khắc phục lỗi 429 Rate Limit

## Sơ lược

Khi bạn gặp lỗi 429 (Rate Limit) khi truy cập API KimVan, giải pháp là:
1. Sử dụng trình duyệt Chrome để lấy dữ liệu
2. Lưu dữ liệu vào máy local 
3. Xử lý dữ liệu đã lưu
4. Truy cập dữ liệu thông qua API route local

## Các bước thực hiện

### Bước 1: Lấy danh sách sheet

```bash
# Mở trình duyệt để lấy danh sách sheet
node src/scripts/open-browser.js <tên_sheet>

# Ví dụ:
node src/scripts/open-browser.js fullcombokhoa2k8
```

Khi trình duyệt mở với URL API KimVan:
1. Bấm chuột phải vào trang > "Save as..." > Lưu file JSON vào thư mục `results`
2. Đặt tên theo gợi ý: `<tên_sheet>-list.json`

### Bước 2: Lấy chi tiết sheet

Từ file danh sách, lấy các ID sheet (VD: `4tKFsUi5Wf`)

```bash
# Mở trình duyệt để lấy dữ liệu chi tiết sheet
node src/scripts/open-browser.js <tên_sheet> "<id1>,<id2>,<id3>"

# Ví dụ:
node src/scripts/open-browser.js fullcombokhoa2k8 "4tKFsUi5Wf,5gJhLnO7Pq"

# Với thời gian chờ dài hơn (60 giây) để tránh rate limit:
node src/scripts/open-browser.js fullcombokhoa2k8 "4tKFsUi5Wf,5gJhLnO7Pq" --wait=60
```

Với mỗi sheet mở ra:
1. Bấm chuột phải vào trang > "Save as..." > Lưu file JSON vào thư mục `results`
2. Đặt tên theo gợi ý: `<tên_sheet>-<id>-detail.json`

### Bước 3: Xử lý dữ liệu đã lưu

```bash
# Xử lý các file JSON trong thư mục results
node src/scripts/process-results.js
```

### Bước 4: Khởi động server và truy cập dữ liệu

```bash
# Khởi động server
npm run dev
```

Truy cập dữ liệu qua các API route:
- Danh sách sheet: `/api/spreadsheets/from-offline/<tên_sheet>`
- Chi tiết sheet: `/api/spreadsheets/from-offline/detail/<id_sheet>`

## Ghi chú

- Thời gian chờ mặc định giữa các request là 30 giây, có thể tăng lên bằng option `--wait=<số_giây>`
- Nếu đã lưu file trước đó, script sẽ tự động bỏ qua. Để lấy lại, thêm option `--force`
- Không cần đăng nhập vào trang KimVan trước khi chạy script 