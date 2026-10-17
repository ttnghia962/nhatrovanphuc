Tôi cần viết 1 website để
  quản lý tiền phòng cho mỗi phòng, có 32 phòng.
  Thứ 1 cần 2 phân rule là admin và user

  Trong user page cần các cột trong db sẽ là:
Số phòng sẽ là keyid

Bảng TỔNG QUAN*
Số phòng | Họ và tên | Tiền phòng | Tiền rác |  Tiền điện | Tiền nước | Tiền hao hụt 10% | Tổng
* Tiền hao hụt 10% là của tổng điện + nước
Đây là bảng chính

Về bảng phụ của Phòng:
Số phòng | Tháng 1 | Tháng 2 … | Tháng 12 | Năm | Tổng
Tháng | Đơn giá (mapping để kiểm tra đơn giá theo mốc thời gian)
Vd: 01/2026 | xxx

Về bảng phụ của Điện:
Số phòng | Tháng 1 | Tháng 2 … | Tháng 12 | Năm | Tổng
Số phòng | Tháng 1 | Tháng 2 … | Tháng 12 | Năm | Tổng (đơn giá)
Tháng | Đơn giá (mapping để kiểm tra đơn giá theo mốc thời gian)


Về bảng phụ của Nước:
Số phòng | Tháng 1 | Tháng 2 … | Tháng 12 | Năm | Tổng (số điện * đơn giá)
Số phòng | Tháng 1 | Tháng 2 … | Tháng 12 | Năm | Tổng (đơn giá)
Tháng | Đơn giá (mapping để kiểm tra đơn giá theo mốc thời gian)

Về bảng phụ của Rác:
Số phòng | Tháng 1 | Tháng 2 … | Tháng 12 | Năm | Tổng
Tháng | Đơn giá (mapping để kiểm tra đơn giá theo mốc thời gian)


Về admin page:
Có thể điều chỉnh được, các đơn giá theo theo thời điểm
Có dashboard quan sát (về tiền) tổng quát (và download excel về được)

VỀ UX:
Sẽ có login (không cần mật khẩu), người dùng vào chỉ cần chọn số phòng và dashboard TỔNG QUAN* của phòng đó sẽ hiện
