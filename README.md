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
