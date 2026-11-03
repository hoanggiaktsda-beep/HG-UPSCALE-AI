# Thành phần bên thứ ba

Ảnh được xử lý trên thiết bị. Lần đầu sử dụng, trình duyệt tải mã xử lý và mô hình từ những nguồn sau:

- ONNX Runtime Web 1.20.1 — Microsoft, giấy phép MIT. Mã và WebAssembly từ jsDelivr: https://github.com/microsoft/onnxruntime
- U²-NetP — Xuebin Qin và cộng sự, Apache-2.0: https://github.com/xuebinqin/U-2-Net . Bản ONNX do rembg phân phối, tải từ bản ghim cd3a3d6767a7859efea31ef0f2f373582cf06d82 của https://huggingface.co/tomjackson2023/rembg .

Các thành phần không bị sửa đổi. Giấy phép và thông báo bản quyền gốc được giữ trong các gói phân phối. Những kết nối tải thư viện có thể cung cấp địa chỉ IP và thông tin kết nối cho nhà cung cấp; không gửi nội dung ảnh.

## Giới hạn

Tách nền là dự đoán mặt nạ của mô hình nhẹ, không bảo đảm giữ đủ tóc, kính, chi tiết mảnh hoặc vật thể cùng màu nền. Tách sản phẩm phân tích vùng chữ nhật do người dùng chọn, không tự nhận diện mọi vật thể trong căn phòng, không khôi phục phần bị che khuất. Chức năng xóa dấu không tự phát hiện Gemini và không xóa SynthID; thuật toán nội suy màu từ bốn biên vùng chọn chỉ phù hợp vùng nhỏ và có thể để lại vệt trên nền phức tạp.
