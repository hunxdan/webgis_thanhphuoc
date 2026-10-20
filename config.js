/*
 * config.js — TOÀN BỘ thông tin dự án nằm ở đây. Đổi nội dung tại file này, không cần sửa mã nguồn.
 * Không đặt khoá API, token hay mật khẩu vào file này (file chạy phía trình duyệt, ai cũng đọc được).
 */
window.WEBGIS_CONFIG = Object.freeze({
  /* ----- Thông tin dự án ----- */
  TEN_DU_AN: 'WebGIS tra cứu quy hoạch thửa đất',
  TEN_RUT_GON: 'Địa bạ số',
  TEN_XA: 'Thạnh Phước',
  TEN_TINH: 'Vĩnh Long',
  DIA_BAN: 'xã Thạnh Phước, tỉnh Vĩnh Long',
  MO_TA_NGAN: 'Tra cứu trực tuyến thông tin địa chính, hiện trạng sử dụng đất và quy hoạch của từng thửa đất.',
  GIOI_THIEU: 'WebGIS phục vụ tra cứu trực tuyến thông tin quy hoạch thửa đất tại xã Thạnh Phước, tỉnh Vĩnh Long, tích hợp dữ liệu địa chính, hiện trạng sử dụng đất và quy hoạch trong một giao diện duy nhất.',
  KY_QUY_HOACH: '2021 – 2030',
  HE_TOA_DO: 'VN-2000, kinh tuyến trục 105°45′',

  /* ----- Số liệu giới thiệu (Mục "Thống kê & Số liệu") ----- */
  THONG_KE: [
    { so: 17820, nhan: 'thửa đất được số hóa', dinhDang: 'so' },
    { so: 100, nhan: 'tờ bản đồ', dinhDang: 'so' },
    { chu: '2021–2030', nhan: 'cập nhật kỳ quy hoạch' },
    { chu: 'VN-2000', nhan: 'hệ tọa độ · kinh tuyến trục 105°45′' },
  ],

  /* ----- Câu hỏi thường gặp ----- */
  FAQ: [
    {
      h: 'Làm sao để tìm một thửa đất cụ thể?',
      d: 'Mở trang Tra cứu, nhập số tờ và số thửa vào ô tìm kiếm rồi chọn kết quả gợi ý. Bạn cũng có thể tìm theo tọa độ VN-2000, chọn ngẫu nhiên một thửa, hoặc bấm trực tiếp lên thửa đất trên bản đồ để xem thông tin.',
    },
    {
      h: 'Làm thế nào để đo khoảng cách và diện tích?',
      d: 'Bấm nút Đo trên thanh công cụ, chọn Khoảng cách hoặc Diện tích, rồi bấm lần lượt các điểm trên bản đồ. Nhấp đúp (hoặc nhấn Enter) để kết thúc, nhấn Esc để xóa phép đo.',
    },
    {
      h: 'Hệ thống có dùng được trên điện thoại không?',
      d: 'Có. Giao diện tự co giãn theo màn hình; trên điện thoại, bạn có thể chạm để chọn thửa, vuốt để di chuyển bản đồ và chụm hai ngón tay để phóng to, thu nhỏ.',
    },
    {
      h: 'Dữ liệu trên trang có chính xác không?',
      d: 'Dữ liệu do cơ quan quản lý đất đai cung cấp, nhưng không được cập nhật theo thời gian thực nên sau một thời gian có thể không còn đúng với thực tế. Vui lòng liên hệ cơ quan chức năng có thẩm quyền để xác nhận trước khi dùng cho mục đích giao dịch, pháp lý.',
    },
    {
      h: 'Dữ liệu được lấy từ nguồn nào?',
      d: 'Dữ liệu địa chính và quy hoạch do UBND xã Thạnh Phước cung cấp, được số hóa và chuẩn hóa phục vụ nghiên cứu (17.820 thửa đất, 100 tờ bản đồ, kỳ quy hoạch 2021 – 2030).',
    },
  ],

  /* ----- Đối tác (logo) ----- */
  DOI_TAC: [
    { anh: 'assets/img/brand2.svg', ten: 'Đối tác 1' },
    { anh: 'assets/img/brand3.svg', ten: 'Đối tác 2' },
    { anh: 'assets/img/brand4.svg', ten: 'Đối tác 3' },
    { anh: 'assets/img/brand5.svg', ten: 'Đối tác 4' },
    { anh: 'assets/img/brand6.svg', ten: 'Đối tác 5' },
    { anh: 'assets/img/brand7.svg', ten: 'Đối tác 6' },
  ],

  /* ----- Lời cảm ơn ----- */
  LOI_CAM_ON: {
    truong: { ten: 'Đại học Công nghiệp TP. Hồ Chí Minh', anh: 'assets/img/logo-iuh.png' },
    khoa: { ten: 'Viện Khoa học Công nghệ và Quản lý Môi trường', anh: 'assets/img/logo-vien.png' },
    giangVien: { vai: 'Giảng viên hướng dẫn', ten: 'TS. Bùi Đăng Hưng' },
    coQuan: { ten: 'UBND xã Thạnh Phước', vai: 'Cơ quan hỗ trợ dữ liệu' },
  },

  /* ----- Chân trang ----- */
  NHOM_THUC_HIEN: ['Đặng Lê Như Ý', 'Nguyễn Văn Mạnh'],
  BAN_QUYEN: 'Dự án khóa luận tốt nghiệp',

  /* ----- Bản đồ ----- */
  BAN_DO: {
    // Nền vệ tinh (lớp nền hỗ trợ định vị). Đổi/vô hiệu hóa tại đây. Chỉ domain này được CSP cho phép tải ảnh.
    VE_TINH: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ghiCong: 'Ảnh vệ tinh © Esri, Maxar, Earthstar Geographics',
      zoomToiDa: 19,
    },
    ZOOM_NHO_NHAT: 11.5,
    ZOOM_LON_NHAT: 21,
  },

  /* ----- Bảng màu GỐC của dữ liệu (xuất từ QGIS/qgis2web) — không đổi màu. Khoá = mã loại đất (MSDD) / mã quy hoạch (MA_LĐ_QH) ----- */
  MAU_THUA: {"LUC": "#fffc8c", "LUK": "#fffc96", "HNK": "#fff0b4", "BHK": "#fff0b4", "CLN": "#ffd2a0", "RSM": "#b4ffb4", "RPH": "#beff1e", "RPM": "#beff1e", "NTS": "#aaffff", "LMU": "#fffffe", "NKH": "#f5ffb4", "ONT": "#ffd0ff", "TSC": "#ffaaa0", "DVH": "#ffaaa0", "DYT": "#ffaaa0", "DGD": "#ffaaa0", "DTT": "#ffaaa0", "SKC": "#faaaa0", "DGT": "#ffaa32", "DTL": "#aaffff", "DNL": "#ffaaa0", "DBV": "#ffaaa0", "DCH": "#ffaaa0", "DRA": "#cdaacd", "TON": "#ffaaa0", "TIN": "#ffaaa0", "NTD": "#d2d2d2", "SON": "#a0ffff", "MNC": "#b4ffff", "BCS": "#fffffe", "ONT+LUC": "#ffd0ff", "ONT+HNK": "#ffd0ff", "ONT+BHK": "#e1d0ff", "NTS+DNL": "#aaffff", "CLN+NTS": "#ffd2a0", "ONT+NTS": "#ffb4ff", "ONT+LNQ": "#ffb4ff", "RPK": "#beff1e", "SKC+BHK": "#faaaa0", "TON+BHK": "#ffaaa0", "LNC": "#ffd7aa", "NTS+CLN": "#aaffff", "SKC+NTS": "#faaaa0", "ONT+LMU": "#ffb4ff", "NTS+BHK": "#aaffff", "NTS+HNK": "#aaffff", "NTS+LMU": "#46ffff", "LUK+BHK": "#fffc96", "NTS+LUK": "#aaffff", "LUK+CLN": "#fffc96", "CLN+BHK": "#ffd2a0", "RDK": "#6eff64", "LUK+HNK": "#fffc96", "ONT+CLN": "#ffd0ff", "LMU+NTS": "#fffffe", "ONT+NTD": "#ffd0ff", "ONT+LUK": "#ffd0ff"},
  MAU_THUA_MAC_DINH: '#cffff8',
  MAU_QH: {"LUC": "#fffc8c", "CLN": "#ffd2a0", "RPH": "#beff1e", "NTS": "#aaffff", "NKH": "#f5ffb4", "ONT": "#ffd0ff", "TSC": "#ffaaa0", "DVH": "#ffaaa0", "DGD": "#ffaaa0", "SKC": "#faaaa0", "DGT": "#ffaa32", "DNL": "#ffaaa0", "DCH": "#ffaaa0", "DRA": "#cdaacd", "NTD": "#d2d2d2", "ODT": "#ffa0ff", "CQP": "#ff6450", "CAN": "#ff5046", "DSK": "#ffaaa0", "TMD": "#faaaa0", "DKV": "#ffaaa0"},
  MAU_QH_MAC_DINH: '#c8c8c8',
});
