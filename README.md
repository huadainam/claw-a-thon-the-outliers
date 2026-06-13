# Review Radar - The Outliers

Review Radar là công cụ AI giúp team product và engineering đọc hiểu review ứng
dụng nhanh hơn. Thay vì phải tự đọc hàng trăm review trên App Store và Google
Play, hệ thống tự thu thập review, dùng AI để phân loại nội dung, gom các lỗi
giống nhau thành nhóm bug, rồi hiển thị trên dashboard.

> claw-a-thon · Team The Outliers · built for GreenNode AgentBase.

## Review Radar Làm Gì?

- Tìm app theo tên, kể cả khi người dùng nhập chưa chính xác.
- Thu thập review từ App Store và Google Play khi có store ID tương ứng.
- Dùng AI để phân loại từng review:
  - `BUG_REPORT`: người dùng báo lỗi.
  - `FEATURE_REQUEST`: người dùng đề xuất tính năng.
  - `COMPLAINT`: phàn nàn về trải nghiệm, hiệu năng, UX.
  - `POSITIVE`: phản hồi tích cực.
  - `SPAM`: review rác hoặc quá ít thông tin.
- Gom các bug giống nhau thành một chủ đề chuẩn.
- Tính mức độ nghiêm trọng dựa trên số người nhắc tới:
  - `critical`: 10+ lượt nhắc.
  - `medium`: 3-9 lượt nhắc.
  - `low`: ít hơn 3 lượt nhắc.
- Hiển thị dashboard gồm app gallery, tiến độ crawl, KPI, biểu đồ, action items
  và review explorer.
- Hỗ trợ nhiều app, mỗi app có dữ liệu riêng.
- Có sẵn seed data để demo mở lên là có dữ liệu ngay.

## Flow Hoạt Động

```text
Người dùng nhập tên app
        |
        v
Review Radar tìm app trên App Store / Google Play
        |
        v
Người dùng chọn đúng app
        |
        v
Hệ thống thu thập review mới
        |
        v
Bỏ qua review đã xử lý trước đó
        |
        v
AI phân loại từng review
        |
        v
AI chuẩn hóa các chủ đề bug tương tự
        |
        v
Hệ thống gom bug và tính severity
        |
        v
Dashboard hiển thị số liệu, action items và review chi tiết
        |
        v
Mỗi giờ hệ thống tự kiểm tra review mới
```

Ví dụ dễ hiểu: nhiều review khác nhau như "không đăng nhập được", "login Google
bị lỗi", "tài khoản cứ bị văng ra" có thể được gom thành một action item:
`Lỗi đăng nhập`.

## Kiến Trúc Hiện Tại

Review Radar là một Flask app chạy ở port `8080`.

Server này làm 3 việc:

1. Serve dashboard.
2. Cung cấp REST API cho dashboard.
3. Chạy pipeline nền để cập nhật review.

```text
Browser Dashboard
      |
      v
Flask app :8080
      |
      +-- /api/resolve    tìm app
      +-- /api/track      bắt đầu theo dõi app
      +-- /api/apps       danh sách app và trạng thái crawl
      +-- /api/stats      số liệu tổng quan
      +-- /api/todos      bug/action items
      +-- /api/reviews    review đã phân loại
      +-- /run            chạy pipeline thủ công
      |
      v
Pipeline
      |
      +-- scrape reviews
      +-- classify bằng LLM
      +-- chuẩn hóa bug topics
      +-- gom bug reports
      +-- lưu state
```

## Module Chính

| File | Vai trò |
|---|---|
| `review-radar/app.py` | Flask app, API routes, seed bootstrap, scheduler |
| `review-radar/pipeline.py` | Điều phối scrape -> classify -> canonicalize -> group |
| `review-radar/scraper.py` | Resolve app và chuẩn hóa review |
| `review-radar/scraper_live.py` | Gọi Google Play scraper và iTunes Search/RSS |
| `review-radar/classifier.py` | Dùng LLM để phân loại review |
| `review-radar/canonicalize.py` | Dùng LLM để gom topic bug về nhãn chuẩn |
| `review-radar/grouper.py` | Gom bug, tính severity, merge todo cũ |
| `review-radar/storage.py` | Local JSON store, AgentBase Memory store, app registry |
| `review-radar/bootstrap.py` | Nạp seed data vào store khi khởi động lần đầu |
| `review-radar/dashboard/` | Dashboard React chạy trực tiếp trên browser |
| `review-radar/seed/` | Dữ liệu demo đã được phân tích sẵn |

## Frontend

Dashboard hiện dùng React chạy trực tiếp trong browser:

- React 18 từ CDN.
- Babel từ CDN để chạy JSX.
- Không có npm build step.
- Biểu đồ tự vẽ bằng SVG/custom components.
- `dashboard/api-bridge.js` chuyển dữ liệu backend sang định dạng UI cần.

Các phần đã đọc dữ liệu thật từ backend:

- Tìm app và chọn app.
- Gallery app có sẵn.
- Màn hình tiến độ crawl.
- Overview metrics.
- Action items từ bug groups.
- Review explorer.

Các phần đang là demo/future UI:

- Reports.
- Settings integrations.
- Team feedback.
- Compare mock metrics.

## Storage

Toàn bộ state đi qua `storage.py`.

Khi chạy local, dữ liệu nằm trong JSON files:

```text
review-radar/data/
  registry.json
  apps/
    <app_id>/
      config.json
      processed_ids.json
      reviews.json
      todos.json
      meta.json
```

Khi deploy, hệ thống có thể dùng AgentBase Memory thông qua `MemoryStore`.

Registry lưu:

- danh sách app đã được theo dõi
- app đang active
- title, icon, developer, store IDs và review limit của từng app

## Seed Data

Repo có `review-radar/seed/` gồm 13 app đã được crawl và phân tích trước. Khi app
khởi động lần đầu và store còn trống, seed data sẽ được copy vào store đang dùng.

Nhờ vậy demo không bị trống dữ liệu, kể cả khi live crawl mất thời gian hoặc bị
store throttle.

## Chạy Local

```bash
cd review-radar
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp .env.example .env
./.venv/bin/python app.py
```

Mở:

```text
http://localhost:8080
```

Nếu virtualenv đã có sẵn:

```bash
cd review-radar
./.venv/bin/python app.py
```

## Biến Môi Trường

Xem `review-radar/.env.example`.

| Biến | Ý nghĩa |
|---|---|
| `OPENAI_API_KEY` | API key cho LLM endpoint |
| `OPENAI_BASE_URL` | Base URL của LLM endpoint |
| `MODEL_NAME` | Model dùng để classify và canonicalize |
| `REVIEW_LIMIT` | Số review mặc định cần scrape mỗi store |
| `STORE_BACKEND` | `local` hoặc `memory` |
| `MEMORY_ID` | AgentBase Memory store ID khi dùng memory backend |
| `MEMORY_BASE_URL` | AgentBase Memory API base URL |

## Test

```bash
cd review-radar
./.venv/bin/python -m pytest -q
```

Test suite hiện có 58 tests.

## Docker / Deploy

```bash
docker build -t review-radar review-radar
docker run -p 8080:8080 --env-file review-radar/.env review-radar
```

Docker chạy:

```bash
python app.py --serve
```

Với `--serve`, app sẽ:

- bootstrap seed data nếu store đang trống
- serve dashboard/API
- bật scheduler chạy pipeline mỗi giờ

## Known Gaps

- Một số nút "Mark as Fixed" trong frontend hiện mới đổi local UI state, chưa
  phải tất cả đều gọi API backend.
- Reports, integrations, app comparison và feedback persistence đang ở mức
  demo/future UI.
- Dashboard phụ thuộc CDN React/Babel nếu chưa vendor assets.

## Tài Liệu

- As-built design: `docs/superpowers/specs/2026-06-11-review-radar-design.md`
- Historical implementation plan: `docs/superpowers/plans/2026-06-11-review-radar.md`
