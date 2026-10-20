# Địa bạ số — WebGIS tra cứu thửa đất và quy hoạch, xã Thạnh Phước (Vĩnh Long)

Trang web tra cứu thông tin địa chính, hiện trạng sử dụng đất và quy hoạch 2021 – 2030 của **17.820 thửa đất, 100 tờ bản đồ** xã Thạnh Phước, tỉnh Vĩnh Long, hiển thị trên một bản đồ tương tác.

**Xem trực tuyến:** https://hunxdan.github.io/webgis_thanhphuoc/

| Trang | Địa chỉ |
|---|---|
| Tra cứu (bản đồ) | https://hunxdan.github.io/webgis_thanhphuoc/ |
| Giới thiệu | https://hunxdan.github.io/webgis_thanhphuoc/landing.html |

> Thông tin trên trang chỉ mang tính tham khảo, không có giá trị pháp lý.

## Tính năng

**Tìm kiếm**
- Theo **số tờ · số thửa**, có gợi ý ngay khi gõ.
- Theo **tọa độ VN-2000** (X Bắc, Y Đông).
- **Ngẫu nhiên**: bản đồ chạy qua các thửa, chậm dần rồi dừng ở một thửa.

**Bản đồ**
- Ba lớp: **Thửa đất** (tô màu theo mã loại đất), **Địa chính** (ranh giới và số thửa), **Quy hoạch**; mỗi lớp có thanh độ trong suốt.
- Nền **Giấy** hoặc **Vệ tinh**; khung tọa độ VN-2000 với lưới và nhãn X/Y.
- Chọn thửa để xem thẻ thông tin: tờ, thửa, diện tích, diện tích pháp lý, hiện trạng, địa chỉ, tỷ lệ quy hoạch và từng loại quy hoạch (mã, tên, diện tích, tỷ lệ). Khi bật lớp Quy hoạch vẫn chọn được thửa bên dưới, thẻ vùng quy hoạch hiện kèm theo.
- Điểm có nhiều thửa chồng nhau sẽ hiện hộp chọn nhanh.
- Công cụ đo khoảng cách và diện tích, định vị GPS (chỉ khi bấm), sao chép thông tin, chỉ đường qua Google Maps.
- Dùng được trên điện thoại.

## Dữ liệu

- Dữ liệu địa chính và quy hoạch do **UBND xã Thạnh Phước** cung cấp, được số hóa và chuẩn hóa phục vụ nghiên cứu.
- Hệ tọa độ VN-2000, kinh tuyến trục 105°45′. Kỳ quy hoạch 2021 – 2030.
- Mọi thông tin hiển thị lấy nguyên từ các trường của dữ liệu. Dữ liệu không có trường tên chủ sử dụng.
- Nền vệ tinh: Esri World Imagery (cần internet).

## Công nghệ

Trang web tĩnh (HTML, CSS, JavaScript), **không dùng thư viện bên thứ ba**: bản đồ vẽ bằng WebGL2 thuần, engine chuyển động và bộ máy bản đồ tự viết. Toàn bộ thửa được chia tam giác sẵn khi dựng dữ liệu và nạp một lần lên GPU nên kéo, phóng to mượt kể cả trên điện thoại.

## Chạy trên máy

Mở trực tiếp `index.html` hoặc `landing.html` bằng trình duyệt (không cần server). Khi mở bằng `file://`, dữ liệu được nạp từ `data/offline.js`.

Hoặc chạy bằng server cục bộ:

```bash
node dev/tools/serve.mjs
```

## Cấu trúc

```
index.html, landing.html   trang tra cứu và trang giới thiệu
config.js                  thông tin dự án: tên, mô tả, thống kê, FAQ, lời cảm ơn, màu loại đất
assets/                    CSS, JS đã đóng gói, phông chữ, hình ảnh
data/                      dữ liệu đã dựng (parcels, qh, ct, attrs, offline.js)
dev/src/js/                mã nguồn (ES module)
dev/tools/                 công cụ dựng
dev/source-data/           dữ liệu gốc xuất từ qgis2web
```

## Dựng lại mã và dữ liệu

Cần Node.js.

```bash
npm i esbuild
node dev/tools/bundle.mjs        # gộp dev/src/js -> assets/js
node dev/tools/build-data.mjs    # dựng data/ từ dev/source-data
node dev/tools/pack-offline.mjs  # cập nhật data/offline.js (bắt buộc sau khi dựng lại dữ liệu)
```

Dữ liệu gốc gồm 4 file qgis2web trong `dev/source-data/`: `THUA_DAT_2.js`, `QH_THUA_1.js`, `QH_CHI_TIET_0.js`, `QH_Clean_v3_3.js`.

## Bảo mật và quyền riêng tư

- Chính sách bảo mật nội dung (CSP) chặt bằng thẻ `<meta>`; chỉ tải thêm ô nền từ `server.arcgisonline.com` ở trang bản đồ.
- Không dùng `innerHTML`, `eval`; nội dung hiển thị qua `textContent`.
- Không gửi nội dung tìm kiếm hay vị trí GPS đi đâu; không cookie, không theo dõi. `localStorage` chỉ lưu nền bản đồ và độ trong suốt các lớp.

## Tác giả

Khóa luận tốt nghiệp, Viện Khoa học Công nghệ và Quản lý Môi trường, Đại học Công nghiệp TP. Hồ Chí Minh.

- Nhóm thực hiện: Đặng Lê Như Ý, Nguyễn Văn Mạnh
- Giảng viên hướng dẫn: TS. Bùi Đăng Hưng
- Cơ quan hỗ trợ dữ liệu: UBND xã Thạnh Phước

## Giấy phép và ghi công

Xem [LICENSE](LICENSE). Phông Lora, Inter: SIL Open Font License 1.1. Ô nền bản đồ: © Esri, Maxar, Earthstar Geographics và các nguồn khác theo điều khoản của Esri. Logo các đơn vị thuộc quyền của chủ sở hữu tương ứng.
