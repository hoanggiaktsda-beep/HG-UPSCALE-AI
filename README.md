# HG UPSCALE AI · Chuyên gia phục hồi V2.1

Ứng dụng xử lý ảnh ngay trên thiết bị. Giữ phần Upscale, tách nền, tách sản phẩm và hai chế độ xóa dấu hiển thị.

## Chuyên gia phục hồi

Trong **Công cụ AI → Xóa dấu Gemini**:

1. Khoanh vùng dấu, hoặc dùng vùng góc phải ước lượng ở chế độ tự động.
2. Bấm **Phân tích vùng sửa** để đo biến thiên màu và chi tiết biên.
3. Giữ **Chuyên gia đề xuất**, chọn **Lấy mẫu giữ kết cấu**, hoặc **Nội suy nền trơn**.
4. Khi cần, bấm **Chọn mẫu sạch** và chạm tâm một vùng có cùng vân, ánh sáng, hướng nét. Không chọn trùng vùng dấu.
5. Xử lý; xem cặp ảnh phóng to trước/sau và báo cáo khóa chất lượng. Có thể hoàn tác về ảnh gốc.

Lấy mẫu kết cấu tìm một mảng sạch theo độ khớp biên, sao chép ở tỷ lệ 1:1 và chỉ bù màu hằng số ở mức nhỏ. Tùy chọn hòa mép chỉ tác động bên trong vùng sửa. Đây là thuật toán phân tích và sao chép cục bộ, không phải chuyên gia con người hay mô hình AI sinh ảnh.

## Khóa chất lượng

- Giữ kích thước ảnh gốc khi sửa watermark; không thu nhỏ ảnh để xuất.
- So sánh từng điểm ảnh ngoài vùng sửa với ảnh nguồn đã giải mã theo các dải nhỏ để giảm bộ nhớ. Phát hiện khác biệt sẽ chặn tải kết quả.
- Xuất PNG; kiểm tra vùng sửa trước khi tải. Không hứa khôi phục chính xác phần chi tiết bị dấu che.
- Không bảo toàn metadata, EXIF hay hồ sơ màu nhúng của tệp gốc. Khóa điểm ảnh được đánh giá trong không gian màu canvas của trình duyệt.
- Chức năng tách sản phẩm vẫn xuất riêng vùng sản phẩm, vì vậy không áp dụng khóa kích thước toàn ảnh của watermark.

## Kiểm chứng

Chạy:

```sh
node --check image-tools.js
node --check retouch-expert.js
node retouch-expert.test.cjs
```

Kiểm thử họa tiết lặp có ảnh sạch làm chuẩn: lấy mẫu kết cấu khôi phục mẫu thử chính xác khi tắt hòa mép; nội suy nền trơn làm mất họa tiết. Đây là mẫu tổng hợp, không phải bằng chứng cho mọi ảnh thực tế.

Đã kiểm tra trong Chrome: đề xuất phương pháp, lấy mẫu tự động và chọn tay, cảnh báo mẫu khớp thấp, hoàn tác, xuất PNG 4096 × 4096 px và không đổi pixel ngoài vùng sửa. Chưa kiểm thử trực tiếp Safari iPhone.

## Giới hạn

Vùng tự động là ước lượng góc phải, chưa nhận diện logo. Vân không lặp, cạnh phối cảnh, tóc, da hoặc chi tiết độc nhất có thể không có mẫu sạch phù hợp; cần chọn mẫu thủ công và xem lại. Không xử lý SynthID. Tách nền sử dụng U²-NetP và cần tải mô hình ở lần đầu; xem [thành phần bên thứ ba](THIRD_PARTY.md).
