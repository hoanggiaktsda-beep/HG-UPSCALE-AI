# Thành phần bên thứ ba

Ảnh được xử lý trên thiết bị. Lần đầu sử dụng, trình duyệt tải mã xử lý và mô hình từ những nguồn sau:

- ONNX Runtime Web 1.20.1 — Microsoft, giấy phép MIT. Mã và WebAssembly từ jsDelivr: https://github.com/microsoft/onnxruntime
- U²-NetP — Xuebin Qin và cộng sự, Apache-2.0: https://github.com/xuebinqin/U-2-Net . Bản ONNX do rembg phân phối, tải từ bản ghim cd3a3d6767a7859efea31ef0f2f373582cf06d82 của https://huggingface.co/tomjackson2023/rembg .

Các thành phần không bị sửa đổi. Giấy phép và thông báo bản quyền gốc được giữ trong các gói phân phối. Những kết nối tải thư viện có thể cung cấp địa chỉ IP và thông tin kết nối cho nhà cung cấp; không gửi nội dung ảnh.

## Mẫu logo hiển thị

Các bản đồ alpha 36-v2, 48, 96 và 96-20260520 được trích từ src/core/embeddedAlphaMaps.js của GargantuaX/gemini-watermark-remover, giấy phép MIT. Giữ thông báo bản quyền tại [licenses/gemini-templates-MIT.txt](licenses/gemini-templates-MIT.txt). Thuật toán nhận dạng, lựa chọn cường độ và giao diện tích hợp được viết riêng cho HG. Nguồn: https://github.com/GargantuaX/gemini-watermark-remover .

Ba ảnh kiểm thử công khai trong gemini-fixtures.json lấy từ thư mục tests/fixtures của cùng dự án, kèm SHA của blob nguồn. Chúng phục vụ kiểm thử, không phải ảnh của người dùng. Giấy phép và ghi công nguồn được giữ cùng dự án.

## Giới hạn

Chỉ xử lý logo Gemini hiển thị, không xử lý SynthID. Không phải mô hình AI nhận diện tổng quát. Chế độ tự động dò mẫu trong 640 px ở góc dưới phải; chọn vùng logo để tìm ở vị trí khác. Ảnh bị nén, đổi kích thước, logo khác mẫu hoặc nền trùng hình dấu có thể thất bại; kiểm tra trước/sau vẫn cần thiết. Công cụ chặn xuất khi mức nhận dạng thấp hoặc kiểm tra khử dấu không đạt. Không thể bảo đảm khôi phục chính xác mọi chi tiết bị che.

Tách nền vẫn dùng mô hình nhẹ U²-NetP; mép tóc, kính và vật thể mảnh có thể sai. Tách sản phẩm chỉ phân tích vùng người dùng khoanh, không dựng lại phần bị che.
