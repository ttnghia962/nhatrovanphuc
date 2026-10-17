# Spec: Website quản lý tiền phòng Nhà trọ Vạn Phúc

**Ngày:** 2026-10-17
**Nguồn:** `README.md/readme.md` + 3 ảnh sổ tay (`total0.jpg`, `total1.jpg`, `diennuoc.jpg`)

## 1. Bối cảnh

Hiện chủ trọ ghi sổ tay cho 32 phòng. Ảnh sổ cho thấy:

- `total0.jpg` / `total1.jpg` — bảng TỔNG QUAN theo tháng (ví dụ "Tháng 8/2026"), cột:
  `Phòng | Họ Tên | Tiền phòng | Tiền rác | ĐIỆN(Số cũ, Số mới, TSD, Đơn giá, Thành tiền) | NƯỚC(Số cũ, Số mới, TSD, Đơn giá, Thành tiền) | Tổng tiền (điện + nước + hao hụt 10%)`
- `diennuoc.jpg` — sổ ghi **chỉ số đồng hồ** từng tháng, 2 cột số cho mỗi phòng (điện, nước). Có ghi chú "phòng 26 không ở", "k có".

### Phát hiện quan trọng (README không nêu)

1. Điện/nước **không** nhập số tiêu thụ trực tiếp — nhập **chỉ số đồng hồ**; `TSD = chỉ số mới − chỉ số cũ`. Chỉ số cũ chính là chỉ số mới của tháng trước.
2. Có phòng **trống theo tháng** (phòng 26). Phòng trống vẫn phải giữ chỉ số đồng hồ để tháng sau tính tiếp.
3. **Tiền phòng khác nhau giữa các phòng** — hầu hết 800,000 nhưng có phòng 300,000 (`total1.jpg`, dòng "C.Nguyên", "Khang"). Nên đơn giá tiền phòng cần hỗ trợ override theo phòng.
4. Tổng tiền được **làm tròn tới 1,000đ**.

### Công thức (đã đối chiếu với dòng 1 của `total1.jpg`)

```
tiềnĐiện = (chỉSốĐiệnMới − chỉSốĐiệnCũ) × đơnGiáĐiện
tiềnNước = (chỉSốNướcMới − chỉSốNướcCũ) × đơnGiáNước
haoHụt   = round((tiềnĐiện + tiềnNước) × 0.10)
tổng     = roundTo1000(tiềnPhòng + tiềnRác + tiềnĐiện + tiềnNước + haoHụt)
```

Kiểm chứng dòng 1 (Huyền, phòng 01, tháng 8/2026):
`điện 18,852 − 18,708 = 144 × 3,500 = 504,000`;
`nước 1,500 − 1,495 = 5 × 7,000 = 35,000`;
`haoHụt = (504,000 + 35,000) × 0.1 = 53,900`;
`tổng = 800,000 + 20,000 + 504,000 + 35,000 + 53,900 = 1,412,900 → 1,413,000` ✓ khớp sổ.

## 2. Quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Stack | Next.js (App Router, TypeScript) + Prisma + SQLite (schema tương thích Postgres) |
| Nhập liệu điện/nước | Nhập **chỉ số đồng hồ**, hệ thống tự trừ ra TSD |
| Ai nhập gì | **Khách thuê** nhập chỉ số **nước** của phòng mình. **Admin** nhập chỉ số điện, tiền phòng, tiền rác, đơn giá, trạng thái ở/trống |
| Phòng trống | Đánh dấu theo **từng tháng**; phòng trống ⇒ mọi khoản = 0, vẫn lưu chỉ số đồng hồ |
| Hạn nhập nước | Khách thuê nhập chỉ số nước của kỳ `T` đến hết ngày 9 của tháng `T+1`; **00:00 ngày 10 tháng `T+1` là khóa**. Ví dụ: kỳ 9/2026 khóa lúc 00:00 ngày 10/10/2026 |
| Đăng nhập | Không mật khẩu — khách chọn số phòng. Admin dùng **mã PIN 6 chữ số lưu trong DB**, mặc định `000000`, admin tự đổi được trong trang quản lý |
| Làm tròn | Hao hụt làm tròn tới 1đ; tổng làm tròn tới 1,000đ |
| Tiền tệ | VND, lưu dưới dạng số nguyên (không có phần thập phân) |

## 3. Yêu cầu chức năng

### FR-1 — Danh mục phòng
32 phòng, số phòng 1..32 là khoá chính. Mỗi phòng có tên người thuê mặc định; tên thực tế được chụp lại (snapshot) theo từng tháng vì người thuê có thể đổi.

### FR-2 — Đơn giá theo mốc thời gian
Bảng đơn giá cho 4 loại: `ROOM`, `TRASH`, `ELECTRIC`, `WATER`. Mỗi bản ghi có `(loại, phòng?, năm hiệu lực, tháng hiệu lực, đơn giá)`.
`phòng = null` ⇒ áp dụng chung. Khi tra cứu cho `(loại, phòng, năm, tháng)`:
1. Ưu tiên bản ghi có `phòng` khớp; nếu không có bản ghi nào của phòng đó có hiệu lực ≤ kỳ đang xét thì dùng bản ghi chung.
2. Trong cùng phạm vi, lấy bản ghi có mốc hiệu lực **lớn nhất mà vẫn ≤ kỳ đang xét**.
3. Không tìm thấy ⇒ lỗi rõ ràng, không được âm thầm dùng 0.

### FR-3 — Chỉ số đồng hồ
Mỗi `(phòng, loại đồng hồ, năm, tháng)` có tối đa 1 chỉ số. Ghi nhận ai nhập (`ADMIN` / `TENANT`).
Chỉ số cũ = chỉ số của tháng liền trước. Nếu không có tháng trước ⇒ TSD = `null`, báo "Thiếu chỉ số tháng trước".
Nếu chỉ số mới < chỉ số cũ ⇒ TSD = `null`, báo "Chỉ số mới nhỏ hơn chỉ số cũ".

### FR-4 — Bảng TỔNG QUAN (bảng chính)
Theo `(năm, tháng)`, mỗi phòng một dòng:
`Số phòng | Họ và tên | Tiền phòng | Tiền rác | Số cũ/mới/TSD/ĐG/Thành tiền điện | … nước | Tiền hao hụt 10% | Tổng`
Dòng tổng cộng cuối bảng. Các dòng thiếu dữ liệu hiển thị cảnh báo thay vì số sai.

### FR-5 — Bảng phụ (pivot 12 tháng)
Cho mỗi phòng và một năm, 4 bảng phụ:
- **Phòng**: thành tiền từng tháng + tổng năm
- **Rác**: thành tiền từng tháng + tổng năm
- **Điện**: 2 hàng — thành tiền từng tháng, và đơn giá áp dụng từng tháng
- **Nước**: 2 hàng — thành tiền từng tháng, và đơn giá áp dụng từng tháng

### FR-6 — Trang khách thuê (user)
- Chọn số phòng ⇒ vào thẳng dashboard TỔNG QUAN của phòng đó.
- Xem bảng tổng quan tháng hiện tại + 4 bảng phụ theo năm.
- **Nhập chỉ số nước** của phòng mình cho kỳ hiện tại, chỉ khi kỳ chưa khoá.

### FR-6b — Hạn nhập chỉ số nước
- Cửa nhập của kỳ `(năm, tháng)` **đóng lúc 00:00 ngày 10 của tháng kế tiếp**. Kỳ 12/2026 đóng lúc 00:00 ngày 10/01/2027.
- Đúng thời điểm 00:00 ngày 10 được tính là **đã đóng**.
- Khi đã đóng: form nhập của khách thuê bị vô hiệu hoá và hiển thị lý do; Server Action cũng từ chối, không chỉ ẩn nút.
- **Admin vẫn sửa được sau hạn** (giả định bổ sung): chủ trọ là người phải sửa sai sót sau khi chốt, nên hạn này chỉ chặn khách thuê. Hạn này độc lập với cờ `locked` của khoá sổ — khoá sổ chặn cả hai.
- Múi giờ: tính theo giờ hệ thống của server. Khi deploy phải đặt `TZ=Asia/Ho_Chi_Minh`, nếu không ngày khóa sẽ lệch.

### FR-7 — Trang admin
- Lưới nhập theo tháng: tên người thuê, ở/trống, chỉ số điện của cả 32 phòng.
- Quản lý đơn giá theo mốc thời gian (thêm/sửa/xoá).
- Dashboard tổng quát: doanh thu theo tháng trong năm, cơ cấu theo loại phí, số phòng có người ở.
- **Khoá sổ** một kỳ: đóng băng kết quả tính (snapshot) để số liệu quá khứ không đổi khi sửa đơn giá sau này.
- **Xuất Excel**.

### FR-8 — Xuất Excel
Một workbook gồm:
- Sheet `Tong quan` — đúng layout sổ tay cho một tháng.
- Sheet `Phong`, `Dien`, `Nuoc`, `Rac` — pivot 32 phòng × 12 tháng của một năm.

### FR-9 — Mã PIN quản lý
- PIN gồm **đúng 6 chữ số** (`000000` đến `999999`), lưu trong bảng `Setting` với khoá `ADMIN_PIN`.
- Giá trị mặc định khi seed: `000000`.
- Admin đổi được PIN trong trang quản lý; phải nhập đúng PIN hiện tại mới đổi được, và PIN mới phải nhập lại hai lần cho khớp.
- PIN lưu **dạng chữ thường, không băm**, theo yêu cầu: nếu quên thì chủ trọ đọc thẳng từ DB bằng script `npm run admin:pin`.
  - Đánh đổi đã chấp nhận: ai đọc được file `dev.db` thì đọc được PIN. Chỉ phù hợp khi DB nằm trên máy/server riêng của chủ trọ. Không commit `dev.db` vào git.

## 4. Ngoài phạm vi (v1)
- Theo dõi đã thu / chưa thu, công nợ.
- Hợp đồng, tiền cọc, lịch sử người thuê chi tiết.
- Gửi email/SMS thông báo.
- Nhiều nhà trọ.
