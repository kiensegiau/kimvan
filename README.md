# Giải pháp xử lý Rate Limit khi truy cập API KimVan

Repository này chứa các script giúp xử lý vấn đề lỗi 429 (Rate Limit) khi gọi API KimVan bằng cách sử dụng trình duyệt thông thường để lấy dữ liệu, lưu vào local và tạo API để truy cập dữ liệu offline.

## Cách hoạt động

Quy trình làm việc gồm các bước sau:

1. **Bước 1**: Sử dụng script để mở trình duyệt Chrome và truy cập API KimVan
2. **Bước 2**: Lưu kết quả JSON từ trình duyệt vào thư mục `results`
3. **Bước 3**: Xử lý các file JSON đã lưu để tạo dữ liệu trong thư mục `processed` 
4. **Bước 4**: Truy cập dữ liệu đã xử lý qua các API routes

## Cài đặt

1. Clone repository này về máy local
2. Cài đặt các dependencies:
   ```
   npm install
   ```

## Hướng dẫn sử dụng

### 1. Lấy dữ liệu từ API KimVan

Sử dụng script `open-browser.js` để mở trình duyệt Chrome và lấy dữ liệu từ API KimVan:

```bash
# Lấy danh sách sheet
node src/scripts/open-browser.js <tên_sheet>

# Lấy chi tiết các sheet (cung cấp danh sách ID sheet cách nhau bởi dấu phẩy)
node src/scripts/open-browser.js <tên_sheet> "<id1>,<id2>,<id3>"

# Với tùy chọn thời gian chờ (đơn vị: giây) để tránh rate limit
node src/scripts/open-browser.js <tên_sheet> "<id1>,<id2>,<id3>" --wait=60

# Sử dụng --force để lấy lại tất cả dữ liệu, kể cả đã tồn tại
node src/scripts/open-browser.js <tên_sheet> "<id1>,<id2>,<id3>" --force
```

Ví dụ:
```bash
node src/scripts/open-browser.js fullcombokhoa2k8
node src/scripts/open-browser.js fullcombokhoa2k8 "4tKFsUi5Wf,5gJhLnO7Pq,8rTyUiO9Pl" --wait=60
```

### 2. Xử lý dữ liệu đã lưu

Sau khi lưu các file JSON từ trình duyệt vào thư mục `results`, chạy script xử lý để tổ chức dữ liệu:

```bash
node src/scripts/process-results.js
```

Script này sẽ:
- Đọc tất cả các file JSON trong thư mục `results`
- Phân loại dữ liệu thành danh sách sheet và chi tiết sheet
- Tạo file dữ liệu đã xử lý trong thư mục `processed`
- Tạo file `index.json` để dễ dàng truy cập

### 3. Truy cập dữ liệu offline qua API

Sau khi đã xử lý dữ liệu, bạn có thể truy cập dữ liệu offline thông qua các API routes sau:

#### Lấy danh sách sheet:
```
GET /api/spreadsheets/from-offline/{name}
```

#### Lấy chi tiết sheet:
```
GET /api/spreadsheets/from-offline/detail/{id}
```

## Các tính năng

- **Tránh Rate Limit**: Thời gian chờ có thể điều chỉnh giữa các request
- **Lưu trữ offline**: Dữ liệu được lưu local, không cần gọi API liên tục
- **Bỏ qua file đã tồn tại**: Tự động bỏ qua việc lấy lại dữ liệu đã có để tiết kiệm thời gian
- **Thân thiện với người dùng**: Hướng dẫn từng bước và thông báo rõ ràng

## Cấu trúc thư mục

- `src/scripts/`: Chứa các script để lấy và xử lý dữ liệu
  - `open-browser.js`: Script mở trình duyệt để truy cập API KimVan
  - `process-results.js`: Script xử lý các file JSON đã lưu
- `src/app/api/spreadsheets/from-offline/`: Chứa các API route để truy cập dữ liệu offline
- `results/`: Thư mục chứa dữ liệu JSON lưu từ trình duyệt
- `processed/`: Thư mục chứa dữ liệu đã xử lý

## Lưu ý

- Thời gian chờ mặc định giữa các request là 30 giây, có thể tăng lên nếu vẫn gặp lỗi rate limit
- Nếu gặp vấn đề khi mở Chrome, script sẽ thử mở với trình duyệt mặc định
- Không cần đăng nhập trước khi sử dụng, script sẽ trực tiếp truy cập URLs API

# API Documentation

## Spreadsheets API

### Danh sách Spreadsheets

```
GET /api/spreadsheets/create/{name}
```

Ví dụ:
```
GET /api/spreadsheets/create/fullcombokhoa2k8
```

#### Response

- Status: 200 OK
- Type: application/json
- Server: Vercel

#### Response Data

```json
[
    {
        "id": "4tKFsUi5Wf8eFN0_CZjARkxWHgSTvzvlIncwx4HGKJZltzAbm0CKFwliyBrlTIqbOVRWKAgJiGdaYOpoh9wGoLHUF_34BBgF",
        "name": "2K8 XPS | VẬT LÝ - VŨ NGỌC ANH"
    },
    {
        "id": "9auMxdPb_HFgfX6eFr4xGAjmqKWFUC911kyWNwHapcKQXdXyZqZWGwlSMk8cJr9gbWbICeQi-0zZLGwDQZKIGe3Gew95X8Wi",
        "name": "2K8 XPS | HÓA - PHẠM VĂN TRỌNG"
    },
    {
        "id": "WRn91SKHWM2l1OsMD6K5wVlYK9uVf6-ciycBBRQxZbaUrTjm_9z_txWiTRCIPegFXzc0FqKqadKt0xRVbEVQpo8jKjdUyqsF",
        "name": "2K8 XPS | TOÁN - ĐỖ VĂN ĐỨC"
    }
]
```

> API trả về danh sách các spreadsheet dựa trên tên đã cung cấp. Thường trả về 10 spreadsheet với các môn học khác nhau (Vật lý, Hóa, Toán, Tiếng Anh).

### Chi tiết Spreadsheet

```
GET /api/spreadsheets/{id}
```

Ví dụ:
```
GET /api/spreadsheets/4tKFsUi5Wf8eFN0_CZjARkxWHgSTvzvlIncwx4HGKJZltzAbm0CKFwliyBrlTIqbOVRWKAgJiGdaYOpoh9wGoLHUF_34BBgF
```

#### Response

- Status: 200 OK
- Type: application/json
- Server: Vercel

#### Response Data

```json
{
    "sheets": [
        {
            "data": [
                {
                    "rowData": [
                        {
                            "values": [
                                {
                                    "formattedValue": "STT",
                                    "userEnteredFormat": {
                                        "numberFormat": {
                                            "type": "TEXT"
                                        },
                                        "backgroundColor": {
                                            "red": 1,
                                            "green": 0.9764706,
                                            "blue": 0.8627451
                                        },
                                        "borders": {
                                            "top": {
                                                "style": "SOLID",
                                                "width": 1
                                            },
                                            "bottom": {
                                                "style": "SOLID",
                                                "width": 1
                                            },
                                            "left": {
                                                "style": "SOLID",
                                                "width": 1
                                            },
                                            "right": {
                                                "style": "SOLID",
                                                "width": 1
                                            }
                                        },
                                        "horizontalAlignment": "CENTER",
                                        "verticalAlignment": "MIDDLE",
                                        "textFormat": {
                                            "foregroundColor": {
                                                "blue": 1
                                            },
                                            "fontFamily": "Palatino Linotype",
                                            "fontSize": 12,
                                            "bold": true
                                        }
                                    }
                                },
                                {
                                    "formattedValue": "NGÀY HỌC",
                                    "userEnteredFormat": {
                                        "numberFormat": {
                                            "type": "DATE",
                                            "pattern": "dd/m/yyyy"
                                        }
                                    }
                                },
                                {
                                    "formattedValue": "TÊN BÀI"
                                },
                                {
                                    "formattedValue": "LIVE"
                                },
                                {
                                    "formattedValue": "TÀI LIỆU"
                                },
                                {
                                    "formattedValue": "BTVN"
                                }
                            ]
                        }
                        // ... Các dòng khác
                    ]
                }
            ]
        }
    ]
}
```

> API trả về dữ liệu chi tiết của spreadsheet được chỉ định bởi ID, bao gồm định dạng và nội dung các ô trong bảng tính. Dữ liệu bao gồm các cột: STT, NGÀY HỌC, TÊN BÀI, LIVE, TÀI LIỆU và BTVN.

### API Bổ sung

Hệ thống cũng hỗ trợ các API bổ sung sau (hiện chưa sử dụng trong tài liệu):

```
GET /api/spreadsheets/{id}/{mode}/{title}
GET /api/spreadsheets/{id}/{category}/{name}
GET /api/spreadsheets/{id}/{type}/{course}
GET /api/cache
GET /api/redirect
```

# Google Sheets API Integration

Ứng dụng này cho phép truy cập và hiển thị dữ liệu từ Google Sheets riêng tư thông qua Google Sheets API.

## Cài đặt

1. Clone repository:
```bash
git clone <repository-url>
cd <repository-folder>
```

2. Cài đặt các dependencies:
```bash
npm install
```

3. Tạo file `.env.local` trong thư mục gốc với nội dung sau:
```
# Google Sheets API credentials
GOOGLE_CLIENT_EMAIL=your-service-account-email@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Private Key Here\n-----END PRIVATE KEY-----\n"
```

## Hướng dẫn Setup Google Cloud và Google Sheets API

### 1. Tạo Google Cloud Project
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới bằng cách nhấp vào dropdown menu ở góc trên bên trái và chọn "New Project"
3. Đặt tên cho project và nhấp "Create"

### 2. Bật Google Sheets API
1. Từ Google Cloud Console, mở menu bên trái và chọn "APIs & Services" > "Library"
2. Tìm kiếm "Google Sheets API" và chọn nó
3. Nhấp vào "Enable"

### 3. Tạo Service Account và Key
1. Từ Google Cloud Console, mở menu bên trái và chọn "APIs & Services" > "Credentials"
2. Nhấp vào "Create Credentials" và chọn "Service Account"
3. Điền thông tin service account (tên, mô tả) và nhấp "Create"
4. Bạn có thể bỏ qua các bước cấp quyền và nhấp "Done"
5. Trong danh sách Service Accounts, tìm account vừa tạo và nhấp vào nó
6. Chọn tab "Keys", nhấp "Add Key" > "Create new key"
7. Chọn định dạng JSON và nhấp "Create"
8. File JSON sẽ được tải về máy của bạn

### 4. Cấu hình dự án
1. Tạo thư mục `config` trong thư mục gốc của dự án
2. Tạo file `.env.local` trong thư mục gốc với nội dung:
```
GOOGLE_APPLICATION_CREDENTIALS="./config/credentials.json"
```
3. Sao chép file JSON credentials vào thư mục `config` và đổi tên thành `credentials.json`
4. Thêm `/config` vào file `.gitignore` để không đẩy credentials lên git

### 5. Chia sẻ Google Sheet
1. Mở Google Sheet bạn muốn truy cập
2. Nhấp vào nút "Share" ở góc trên bên phải
3. Thêm email của service account (có trong file JSON, trường `client_email`) với quyền Viewer
4. Nhấp "Done"

Sau khi hoàn thành các bước trên, API của bạn sẽ có thể truy cập Google Sheets.

## Chạy ứng dụng

```bash
npm run dev
```

Truy cập http://localhost:3000/preview để sử dụng ứng dụng.

## Cách sử dụng

1. Nhập URL của Google Sheet vào ô input (ví dụ: https://docs.google.com/spreadsheets/d/1A-MW6L9JKAmHfaibkB6OTheoOwUwQtAFOXdmMbeZ5Ao/edit)
2. Nhấn nút "Lấy dữ liệu từ Sheet"
3. Dữ liệu từ Google Sheet sẽ được hiển thị dưới dạng bảng

## API Endpoints

### GET /api/sheets/[id]

Lấy dữ liệu từ Google Sheet theo ID.

- **URL Params**: `id` - ID của Google Sheet
- **Response**: Dữ liệu từ Google Sheet hoặc thông báo lỗi
