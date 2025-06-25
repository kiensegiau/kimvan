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

# Kimvan Project Deployment Guide

## Triển khai lên VPS Ubuntu (2 vCPU, 2GB RAM)

### Bước 1: Kết nối SSH vào VPS
```
ssh root@149.28.151.17
```

### Bước 2: Cài đặt các phần mềm cần thiết
```
# Cập nhật hệ thống
apt update

# Cài đặt Node.js và npm
apt install -y nodejs npm

# Cài đặt Nginx
apt install -y nginx

# Cài đặt Git
apt install -y git
```

### Bước 3: Cấu hình DNS (nếu gặp lỗi không kết nối được GitHub)
```
# Chỉnh sửa file resolv.conf
nano /etc/resolv.conf

# Thêm các dòng sau vào file
nameserver 8.8.8.8
nameserver 8.8.4.4

# Hoặc sử dụng DNS của Cloudflare
nameserver 1.1.1.1
nameserver 1.0.0.1

# Lưu file (Ctrl+O, sau đó Enter, rồi Ctrl+X để thoát)
```

### Bước 4: Tạo thư mục và clone dự án
```
# Tạo thư mục
mkdir -p /var/www/kimvan

# Di chuyển vào thư mục
cd /var/www/kimvan

# Clone dự án từ GitHub
git clone https://github.com/kiensegiau/kimvan.git .
```

### Bước 5: Cài đặt dependencies và build dự án
```
# Di chuyển vào thư mục dự án (nếu chưa ở trong đó)
cd /var/www/kimvan

# Cài đặt dependencies
npm install

# Tạo file .env từ file mẫu
cp env.example .env

# Chỉnh sửa file .env để cấu hình
nano .env

# Build dự án
npm run build
```

### Bước 6: Cài đặt và cấu hình PM2
```
# Cài đặt PM2 toàn cục
npm install -g pm2

# Tạo file cấu hình ecosystem.config.js
nano ecosystem.config.js
```

Nội dung file `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'kimvan',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0'  // Quan trọng: Đảm bảo ứng dụng lắng nghe trên tất cả các địa chỉ IP
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0'  // Quan trọng: Đảm bảo ứng dụng lắng nghe trên tất cả các địa chỉ IP
      }
    }
  ]
};
```

```
# Chạy ứng dụng với PM2
pm2 start ecosystem.config.js --env production

# Cấu hình PM2 tự động khởi động khi server khởi động lại
pm2 startup

# Lưu cấu hình hiện tại của PM2
pm2 save

# Kiểm tra trạng thái của ứng dụng
pm2 status

# Xem logs của ứng dụng
pm2 logs kimvan
```

### Bước 7: Mở cổng trên tường lửa
```
# Mở cổng 3000 để kiểm tra ứng dụng trực tiếp
sudo ufw allow 3000

# Mở cổng 80 (HTTP) và 443 (HTTPS) cho Nginx
sudo ufw allow 80
sudo ufw allow 443

# Kiểm tra trạng thái tường lửa
sudo ufw status
```

### Bước 8: Cấu hình Nginx
```
# Tạo file cấu hình Nginx
sudo nano /etc/nginx/sites-available/kimvan
```

Nội dung file cấu hình Nginx:
```
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Tăng kích thước tối đa cho upload file
    client_max_body_size 100M;

    # Tối ưu cho Next.js static assets
    location /_next/static/ {
        alias /var/www/kimvan/.next/static/;
        expires 365d;
        access_log off;
    }

    # Tối ưu cho public assets
    location /public/ {
        alias /var/www/kimvan/public/;
        expires 365d;
        access_log off;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
}
```

```
# Thay thế your-domain.com bằng tên miền thực tế của bạn
# Lưu file (Ctrl+O, sau đó Enter, rồi Ctrl+X để thoát)

# Tạo symbolic link để kích hoạt cấu hình
sudo ln -s /etc/nginx/sites-available/kimvan /etc/nginx/sites-enabled/

# Kiểm tra cấu hình Nginx
sudo nginx -t

# Khởi động lại Nginx
sudo systemctl restart nginx

# Kiểm tra trạng thái Nginx
sudo systemctl status nginx
```

### Bước 9: Cấu hình Cloudflare

1. Đăng nhập vào tài khoản Cloudflare
2. Thêm tên miền của bạn (nếu chưa có)
3. Cập nhật nameservers của tên miền sang nameservers của Cloudflare (nếu chưa làm)
4. Vào phần DNS và thêm bản ghi A:
   - Type: A
   - Name: @ (hoặc subdomain như "www" hoặc "app")
   - Content: 149.28.151.17 (IP của VPS)
   - Proxy status: Proxied
   - TTL: Auto
5. Vào phần SSL/TLS và đặt chế độ mã hóa thành "Full" hoặc "Full (strict)"

## Cập nhật dự án

### Cập nhật từ Git
```
# Di chuyển vào thư mục dự án
cd /var/www/kimvan

# Lưu các thay đổi cục bộ (nếu có)
git stash

# Cập nhật code từ Git
git pull

# Cài đặt lại dependencies (nếu có thay đổi)
npm install

# Build lại ứng dụng
npm run build

# Khởi động lại ứng dụng với PM2
pm2 reload ecosystem.config.js --env production

# Kiểm tra trạng thái ứng dụng
pm2 status

# Xem logs để đảm bảo không có lỗi
pm2 logs kimvan
```

## Các lệnh PM2 hữu ích

```
# Xem danh sách ứng dụng đang chạy
pm2 list

# Giám sát tài nguyên sử dụng
pm2 monit

# Xem logs
pm2 logs kimvan

# Khởi động lại ứng dụng
pm2 restart kimvan

# Dừng ứng dụng
pm2 stop kimvan

# Xóa ứng dụng khỏi PM2
pm2 delete kimvan
```

## Xử lý sự cố

### Lỗi không kết nối được GitHub
Nếu gặp lỗi "Could not resolve host: github.com", hãy cấu hình DNS như trong Bước 3.

### Lỗi không thể truy cập website qua cổng 3000
1. Kiểm tra xem ứng dụng có đang lắng nghe trên tất cả các địa chỉ IP không:
```
netstat -tulpn | grep 3000
```

2. Đảm bảo HOST được cấu hình là '0.0.0.0' trong ecosystem.config.js:
```
env: {
  NODE_ENV: 'production',
  PORT: 3000,
  HOST: '0.0.0.0'
}
```

3. Kiểm tra tường lửa đã mở cổng 3000 chưa:
```
sudo ufw status
```

4. Khởi động lại ứng dụng với HOST rõ ràng:
```
pm2 stop kimvan
HOST=0.0.0.0 PORT=3000 pm2 start ecosystem.config.js --env production
```

5. Kiểm tra xem có thể truy cập localhost trên chính server không:
```
curl http://localhost:3000
```

### Lỗi không thể truy cập website qua Nginx
1. Kiểm tra trạng thái Nginx:
```
systemctl status nginx
```

2. Kiểm tra logs của Nginx:
```
tail -n 50 /var/log/nginx/error.log
```

3. Kiểm tra cấu hình Nginx:
```
nginx -t
```

4. Đảm bảo symbolic link đã được tạo:
```
ls -la /etc/nginx/sites-enabled/
```

### Lỗi Permission Denied
```
# Cấp quyền cho thư mục dự án
chown -R www-data:www-data /var/www/kimvan
```

### Lỗi "sites-available" không tồn tại
Nếu thư mục sites-available không tồn tại, hãy tạo nó:
```
sudo mkdir -p /etc/nginx/sites-available
sudo mkdir -p /etc/nginx/sites-enabled
```

Hoặc tạo cấu hình trực tiếp trong thư mục conf.d:
```
sudo nano /etc/nginx/conf.d/kimvan.conf
```