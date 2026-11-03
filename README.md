# HG UPSCALE AI V2.2

## Xóa logo Gemini

Tải ảnh, chọn **Công cụ AI → Xóa dấu Gemini → Tự động nhận dạng logo**, bấm **XÓA LOGO GEMINI**. Nếu dấu nằm ở vị trí khác, chọn **Chọn vùng logo** và kéo một khung bao quanh dấu.

Bản này thay hoàn toàn phương pháp vá màu/lấy mẫu kết cấu ở luồng watermark. Bộ xử lý tìm mẫu alpha của logo, hiệu chỉnh cường độ rồi tính ngược phép pha trộn lớp trắng. Chỉ những điểm có alpha hoạt động mới được chỉnh. Không xóa một ô chữ nhật bằng nội suy.

Chế độ tự động dò nhiều vị trí và cỡ mẫu trong 640 px góc dưới phải; không mặc định coi một ô cố định là logo. Nhận dạng không chắc, kiểm tra phần dấu còn lại không đạt hoặc tạo quá nhiều điểm bị cắt màu sẽ chặn xuất. Không báo đã xóa chỉ vì đã sửa vùng ảnh.

Giữ nguyên kích thước ảnh gốc, so sánh điểm ảnh ngoài vùng logo theo từng dải và xuất PNG. Chạy nhận dạng trong Web Worker để tránh khóa giao diện. Có so sánh phóng to và hoàn tác.

## Kiểm thử

```sh
node --check image-tools.js
node --check gemini-logo.js
node --check gemini-logo-worker.js
node gemini-logo.test.cjs
```

Kiểm thử tự động có ảnh chụp dấu thực từ dự án công khai: nền tối và mặt tủ gỗ, một ảnh không dấu để kiểm tra không sửa nhầm, bảo toàn điểm ảnh ngoài vùng và sai số lượng tử hóa của phép đảo alpha. Đã kiểm tra bằng mắt thêm mẫu vải có hoa văn. Nguồn và giấy phép nằm trong THIRD_PARTY.md.

## Phạm vi

Không xử lý SynthID. Không phải mô hình AI tổng quát. Một số biến thể hoặc ảnh đã nén/chỉnh sửa sẽ không được nhận dạng. Giảm tương quan mẫu sau xử lý là chỉ báo kỹ thuật, không bảo đảm sạch tuyệt đối bằng thị giác. Chưa có ảnh thất bại riêng của người dùng để đối chiếu và chưa thử trực tiếp Safari iPhone.

Khóa chất lượng so sánh điểm ảnh đã giải mã trong không gian màu canvas; không bảo toàn EXIF hay hồ sơ màu nhúng. Tách sản phẩm vẫn xuất riêng vùng chọn, không áp dụng khóa kích thước toàn ảnh của watermark.
