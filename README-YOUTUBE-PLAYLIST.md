# Hướng dẫn sử dụng YouTube Playlist trong ứng dụng

Tính năng xem danh sách phát YouTube đã được tích hợp vào ứng dụng, cho phép hiển thị và xem các video trong playlist trực tiếp trong ứng dụng mà không cần chuyển đến YouTube.

## Cách sử dụng

1. Thêm link danh sách phát YouTube vào trường liên kết trong Google Sheets
2. Khi người dùng nhấp vào liên kết, hệ thống sẽ tự động phát hiện đó là playlist và mở modal danh sách phát
3. Người dùng có thể xem video, điều hướng qua các video trong playlist và xem danh sách đầy đủ

## Cách hoạt động

Hệ thống sử dụng các API công khai để lấy thông tin về playlist YouTube mà không cần API key. Chúng tôi sử dụng nhiều phương pháp khác nhau để đảm bảo tính năng vẫn hoạt động ngay cả khi một số API không khả dụng:

1. Các API Invidious công khai
2. Các API Piped công khai
3. Trích xuất thông tin trực tiếp từ trang YouTube nếu cần

## Các loại URL được hỗ trợ

Tính năng này hỗ trợ các định dạng URL playlist YouTube sau:

- `https://www.youtube.com/playlist?list=PLAYLIST_ID`
- `https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID`
- `https://youtu.be/VIDEO_ID?list=PLAYLIST_ID`

## Tính năng

- Hiển thị danh sách các video trong playlist
- Xem thông tin và hình thu nhỏ của mỗi video
- Phát video trực tiếp trong ứng dụng
- Điều hướng giữa các video (trước/sau)
- Hiển thị tiến trình xem (video hiện tại/tổng số video)
- Tự động chọn video đầu tiên khi mở playlist
- Nếu mở URL có cả video ID và playlist ID, video đó sẽ được phát đầu tiên

## Gỡ lỗi

Nếu playlist không hiển thị đúng, thử các cách sau:

1. Kiểm tra xem URL playlist có đúng định dạng không
2. Kiểm tra xem playlist có công khai không (chỉ playlist công khai mới hoạt động)
3. Kiểm tra console trong DevTools để xem lỗi cụ thể
4. Đảm bảo rằng người dùng có kết nối internet ổn định

## Giới hạn

- Chỉ hỗ trợ playlist công khai
- Giới hạn tối đa 50 video trong playlist (do giới hạn của API)
- Không hỗ trợ các tính năng như lưu vị trí xem hoặc đồng bộ với tài khoản YouTube

## Lưu ý

Tính năng này sử dụng các API công khai không chính thức nên có thể có thay đổi theo thời gian. Chúng tôi đã thiết kế hệ thống để tự động chuyển đổi giữa các phương pháp khác nhau để đảm bảo tính khả dụng. 