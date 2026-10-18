# Nhà trọ Văn Phúc

Website thay quyển sổ tay tính tiền phòng của nhà trọ Văn Phúc (32 phòng).
Mỗi tháng tính tiền phòng, tiền rác, tiền điện, tiền nước cộng 10% tiền hao
hụt trên điện + nước, rồi xuất ra Excel.

- Khách thuê đăng nhập bằng cách **chọn số phòng**, không cần mật khẩu.
- Quản lý đăng nhập bằng **mã PIN 8 số**.
- Mọi khoản tiền là số nguyên đồng. Một kỳ là cặp số nguyên `năm` + `tháng`.

## Yêu cầu trước khi chạy

- **Node.js >= 20** (xem `engines` trong `package.json`).
- npm (đi kèm Node).
- Không cần cài thêm máy chủ cơ sở dữ liệu: dự án dùng SQLite, dữ liệu nằm ở
  `prisma/dev.db`.

## Cài đặt

```bash
npm install
cp .env.example .env
```

Mở `.env` và điền:

| Biến             | Ý nghĩa                                                      |
| ---------------- | ------------------------------------------------------------ |
| `DATABASE_URL`   | Đường dẫn file SQLite, mặc định `file:./dev.db`.             |
| `SESSION_SECRET` | Khoá ký cookie phiên. **Bắt buộc**, xem cảnh báo bên dưới.   |
| `ADMIN_INITIAL_PIN` | Mã PIN quản lý ban đầu, **đúng 8 chữ số**. Xem mục "Mã PIN quản lý". |
| `TZ`             | **Phải là `Asia/Ho_Chi_Minh`**, xem cảnh báo bên dưới.       |

Sinh `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> **Thiếu `SESSION_SECRET` là app không boot được.** Mọi trang, kể cả
> `/login`, đều đọc cookie phiên nên sẽ lỗi ngay
> `Thiếu biến môi trường SESSION_SECRET` và không có trang nào quay lại được.
> Nếu gặp lỗi này, hãy kiểm tra `.env` trước tiên.

> **`TZ=Asia/Ho_Chi_Minh` là yêu cầu thật, không phải tuỳ chọn.** Hạn nhập chỉ
> số nước là 00:00 ngày 10 của tháng kế tiếp, tính theo **giờ địa phương của
> máy chủ**. Máy chủ chạy UTC sẽ khoá sớm 7 tiếng, tức khách thuê bị chặn từ
> 17:00 ngày 9 — sai so với lời hứa với chủ nhà. Khi triển khai (systemd,
> Docker, PM2...) phải đặt `TZ` cho tiến trình Node, không chỉ cho shell.

## Tạo cơ sở dữ liệu

```bash
npm run db:push   # dựng bảng theo prisma/schema.prisma
npm run db:seed   # 32 phòng, 4 đơn giá chung từ 01/2026, PIN quản lý mặc định
```

`db:seed` chạy lại được nhiều lần (upsert), không ghi đè đơn giá đã sửa và
không ghi đè mã PIN nếu quản lý đã đổi.

## Mã PIN quản lý

PIN gồm **đúng 8 chữ số**. PIN ban đầu lấy từ biến `ADMIN_INITIAL_PIN` trong
`.env` (dùng khi seed DB lần đầu).

> **Không ghi PIN thật vào code, README hay `.env.example`.** Repo công khai
> trên GitHub, ai đọc được PIN là vào được trang quản lý của bản đang chạy.
> PIN thật chỉ nằm trong `.env` (đã gitignore) và trong DB.

PIN được lưu **nguyên văn** trong cơ sở dữ liệu một cách có chủ ý, để chủ nhà
quên thì đọc lại được:

```bash
npm run admin:pin         # in ra mã PIN quản lý hiện tại
npm run admin:pin:reset   # đặt lại PIN về ADMIN_INITIAL_PIN trong .env
```

`admin:pin:reset` cũng dùng để chuyển DB cũ còn PIN 6 số sang PIN 8 số. Đặt lại
PIN không đăng xuất các thiết bị đang đăng nhập; muốn đăng xuất tất cả thì đổi
`SESSION_SECRET`.

## Chạy

```bash
npm run dev     # máy cá nhân, http://localhost:3000
```

Triển khai thật:

```bash
npm run build
npm run start
```

Trang gốc `/` chuyển thẳng sang `/login`.

## Triển khai lên VPS bằng Docker

Bộ `Dockerfile` + `docker-compose.yml` + `Caddyfile` chạy 2 container: **app**
(Next.js) và **Caddy** (tự xin/gia hạn chứng chỉ HTTPS, chuyển http → https).
Container app khi khởi động tự `db push` và seed (seed không ghi đè PIN/đơn giá
đã sửa), nên không cần chạy tay `db:push`/`db:seed`.

Chuẩn bị:

- VPS Linux, RAM **tối thiểu 2 GB** (build Next.js tốn RAM; 1 GB thì nên bật
  thêm swap), đã cài Docker (`curl -fsSL https://get.docker.com | sh`).
- Tên miền có bản ghi **A** trỏ về IP của VPS; mở cổng **80** và **443**.

Lần đầu:

```bash
git clone <repo> nhatrovanphuc && cd nhatrovanphuc
cp .env.example .env
nano .env        # SESSION_SECRET mới, ADMIN_INITIAL_PIN, DOMAIN
docker compose up -d --build
docker compose logs -f app   # thấy "Seed xong" và "Ready" là được, Ctrl+C để thoát
```

`DATABASE_URL` và `TZ` trong `.env` bị `docker-compose.yml` ghi đè bằng giá
trị đúng cho container, không cần sửa.

Cập nhật code mới:

```bash
git pull && docker compose up -d --build
```

Lệnh hay dùng:

```bash
docker compose exec app npm run -s admin:pin               # xem PIN hiện tại
docker compose exec app npx tsx scripts/reset-admin-pin.ts # đặt lại PIN theo .env
docker compose restart app                                 # khởi động lại app
```

> **Dữ liệu nằm trong volume `nhatro-data`**, không mất khi build lại hay
> khởi động lại. **Không bao giờ chạy `docker compose down -v`**: cờ `-v` xoá
> luôn volume, tức là xoá sạch dữ liệu.

Sao lưu (nên đặt cron chạy mỗi ngày, và chép bản sao ra khỏi VPS):

```bash
mkdir -p backups
docker compose cp app:/app/data/dev.db ./backups/dev-$(date +%F).db
```

Khôi phục: `docker compose cp ./backups/<file>.db app:/app/data/dev.db` rồi
`docker compose restart app`.

## Kiểm tra

```bash
npm test            # vitest, chạy một lượt
npm run test:watch  # vitest ở chế độ theo dõi
npx tsc --noEmit    # kiểm tra kiểu
npx eslint .        # kiểm tra lint
```

## Dùng hằng ngày

| Việc                                | Chỗ làm                              |
| ----------------------------------- | ------------------------------------ |
| Xem tổng quan cả năm, khoá sổ tháng | `/admin`                             |
| Bảng TỔNG QUAN + nhập liệu một kỳ   | `/admin/ky/<năm>/<tháng>`            |
| Sửa đơn giá theo mốc thời gian      | `/admin/don-gia`                     |
| Đổi mã PIN                          | `/admin/doi-ma-pin`                  |
| Tải Excel một kỳ                    | nút "Tải Excel" trên trang kỳ        |
| Nhập liệu một kỳ bằng Excel         | khối "Nhập bằng Excel" trên trang kỳ: tải file mẫu, điền, tải lên. Cả file được kiểm tra trước, có lỗi thì không lưu gì |
| Khách thuê xem bill, nhập chỉ số nước | `/phong/<số phòng>`                |

Khách thuê tự nhập chỉ số nước đến hết ngày 9 của tháng kế tiếp. Quá hạn thì
quản lý nhập giúp ở lưới nhập liệu của kỳ đó. Kỳ đã khoá sổ thì phải mở khoá ở
`/admin` trước khi sửa được.
