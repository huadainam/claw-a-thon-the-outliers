# Review Radar - The Outliers

Review Radar là công cụ AI giúp team product và engineering đọc hiểu review ứng
dụng nhanh hơn. Hệ thống thu thập review từ App Store và Google Play, dùng LLM
để phân loại nội dung, gom các bug giống nhau thành action item, tính mức độ ưu
tiên, rồi đưa lên dashboard để team theo dõi.

> claw-a-thon - Team The Outliers - built for GreenNode AgentBase.

## Review Radar Làm Gì?

- Tìm app theo tên, kể cả khi người dùng nhập chưa chính xác.
- Track nhiều app, mỗi app có config, reviews, todos và meta riêng.
- Crawl review từ App Store và Google Play khi có store ID tương ứng.
- Bỏ qua review đã xử lý trước đó để giảm chi phí và thời gian xử lý.
- Phân loại review thành:
  - `BUG_REPORT`: người dùng báo lỗi.
  - `FEATURE_REQUEST`: người dùng đề xuất tính năng.
  - `COMPLAINT`: phàn nàn về trải nghiệm, hiệu năng, UX.
  - `POSITIVE`: phản hồi tích cực.
  - `SPAM`: review rác hoặc quá ít thông tin.
- Chuẩn hóa các chủ đề bug tương tự về cùng một tên.
- Gom bug report thành todo/action item và tính severity:
  - `critical`: 10+ mentions.
  - `medium`: 3-9 mentions.
  - `low`: 1-2 mentions.
- Hiển thị app gallery, crawl progress, KPI, biểu đồ, action items, review
  explorer, compare view và feedback view.
- Hỗ trợ hourly refresh theo từng app; có thể bật/tắt trong gallery.
- Có seed data để dashboard không bị trống khi demo.

Ví dụ: các review "không đăng nhập được", "login Google bị lỗi", "tài khoản cứ
bị văng ra" có thể được gom thành một action item như `Lỗi đăng nhập`.

## Flow Hoạt Động

```text
Người dùng nhập tên app
        |
        v
Review Radar tìm app trên App Store / Google Play
        |
        v
Người dùng chọn app cần theo dõi
        |
        v
Hệ thống tạo/cập nhật app trong registry
        |
        v
Pipeline nền crawl review mới
        |
        v
Deduplicate review đã xử lý
        |
        v
LLM phân loại review
        |
        v
LLM chuẩn hóa bug topic
        |
        v
Gom bug report, tính severity, lưu state
        |
        v
Dashboard đọc API và cập nhật UI
```

## Kiến Trúc Hiện Tại

Review Radar là một Flask app chạy ở port `8080`.

Server làm 3 việc:

1. Serve dashboard React trong `review-radar/dashboard/`.
2. Cung cấp REST API cho dashboard.
3. Chạy scheduler khi start với `--serve`.

```text
Browser Dashboard
      |
      v
Flask app :8080
      |
      +-- /api/resolve      tìm app
      +-- /api/track        track app và enqueue pipeline
      +-- /api/apps         gallery, status, progress
      +-- /api/apps/<id>    bật/tắt hourly refresh
      +-- /api/active       đổi app đang xem
      +-- /api/stats        KPI và label counts
      +-- /api/todos        bug/action items
      +-- /api/todos/<id>   cập nhật status action item
      +-- /api/reviews      review đã phân loại
      +-- /api/cancel       hủy run đang chờ/đang chạy
      +-- /api/feedback     feedback dùng chung của sản phẩm
      +-- /run              chạy pipeline thủ công
      |
      v
Pipeline
      |
      +-- scrape reviews
      +-- classify bằng LLM
      +-- canonicalize bug topics
      +-- group bug reports
      +-- save state
```

## Module Chính

| File | Vai trò |
|---|---|
| `review-radar/app.py` | Flask app, API routes, queue/cancel, seed bootstrap, scheduler |
| `review-radar/pipeline.py` | Điều phối scrape -> classify -> canonicalize -> group |
| `review-radar/scraper.py` | Resolve app và chuẩn hóa review |
| `review-radar/scraper_live.py` | Gọi Google Play scraper và iTunes Search/RSS |
| `review-radar/classifier.py` | Gọi LLM để phân loại review |
| `review-radar/canonicalize.py` | Gọi LLM để gom topic bug về nhãn chuẩn |
| `review-radar/grouper.py` | Gom bug, tính severity, merge todo cũ |
| `review-radar/storage.py` | Local JSON store, AgentBase Memory store, app registry |
| `review-radar/memory_http.py` | HTTP client cho AgentBase Memory |
| `review-radar/bootstrap.py` | Nạp seed data vào store khi khởi động lần đầu |
| `review-radar/dashboard/` | Dashboard React/Babel chạy trên browser |
| `review-radar/seed/` | Dữ liệu demo đã được phân tích sẵn |

## Frontend

Dashboard dùng React trực tiếp trong browser:

- React 18 và ReactDOM từ CDN.
- Babel standalone từ CDN để chạy JSX.
- Không có npm build step.
- Biểu đồ vẽ bằng custom SVG components, không dùng Chart.js.
- `dashboard/api-bridge.js` map data backend sang shape UI.
- Navigation, language và selected route có dùng browser state/local storage.

Những màn hình đã đọc dữ liệu thật từ backend:

- Search app và track app mới.
- App gallery, crawl status, progress và cancel.
- Overview metrics, donut/category mix, trend chart.
- Date range `7N / 30N / 90N`; filter này áp dụng cho KPI, category mix, trend,
  actions và reviews trên dashboard.
- Actions page và status update cho todo.
- Reviews explorer.
- Compare Apps, lấy dữ liệu từ `/api/stats`, `/api/reviews`, `/api/todos`.
- Team feedback, persist qua `/api/feedback`.

Những phần vẫn là future/demo UI:

- Reports và scheduled reports.
- Settings integrations.
- Export comparison.
- Một nút `Mark as Fixed` trong review detail hiện vẫn là UI-only; status menu
  trong action row mới là luồng update backend chính.

## Storage

Tất cả state đi qua `storage.py`. Backend được chọn bằng `STORE_BACKEND`.

### Local JSON

Dùng cho dev offline hoặc regression test:

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

### AgentBase Memory

Dùng cho deploy và workflow test chung của team. Khi test local mà cần dùng CSDL
server, file `review-radar/.env` nên để:

```bash
STORE_BACKEND=memory
MEMORY_ID=<team-memory-id>
MEMORY_BASE_URL=https://agentbase.api.vngcloud.vn/memory
```

`STORE_BACKEND=local` chỉ nên dùng khi muốn chạy tách khỏi dữ liệu server.

## Source Window Và Seed Data

Dashboard chỉ tính số liệu từ review có ngày không vượt quá cutoff của source.
Cutoff hiện tại là ngày hôm qua theo GMT+7, nên UI có thể hiển thị "Dữ liệu tới
<ngày hôm qua>" để tránh tính lệch khi store chưa đồng bộ hết review trong ngày.

Repo có `review-radar/seed/` gồm các app đã crawl và phân tích sẵn. Khi app khởi
động và store đang trống, `bootstrap_from_seed` sẽ copy seed vào backend đang
dùng, bao gồm cả LocalStore lẫn MemoryStore.

## Chạy Local

Lần đầu:

```bash
cd review-radar
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Nếu muốn test với CSDL server của team, cập nhật `.env` sang `STORE_BACKEND=memory`
và điền `MEMORY_ID`.

Chạy dashboard/API kèm scheduler:

```bash
cd review-radar
./.venv/bin/python app.py --serve
```

Mở:

```text
http://127.0.0.1:8080/
```

Nếu chạy không có `--serve`, Flask vẫn serve dashboard/API nhưng scheduler hourly
không được bật.

## Biến Môi Trường

Xem thêm `review-radar/.env.example`.

| Biến | Ý nghĩa |
|---|---|
| `OPENAI_API_KEY` | API key cho LLM endpoint |
| `OPENAI_BASE_URL` | Base URL của LLM endpoint |
| `MODEL_NAME` | Model dùng để classify và canonicalize |
| `REVIEW_LIMIT` | Số review mặc định scrape mỗi store khi track/chạy thủ công |
| `REFRESH_REVIEW_LIMIT` | Số review mỗi store khi hourly refresh |
| `STORE_BACKEND` | `local` hoặc `memory` |
| `MEMORY_ID` | AgentBase Memory store ID khi dùng memory backend |
| `MEMORY_BASE_URL` | AgentBase Memory API base URL |

## Test

```bash
cd review-radar
./.venv/bin/python -m pytest -q
```

Test suite nằm trong `review-radar/tests/` và bao phủ app routes, pipeline,
storage, Memory HTTP, scraper/resolve, classifier/canonicalize và grouper.

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
- bật scheduler check app cần refresh theo chu kỳ

## Known Gaps

- Reports, scheduled reports, Settings integrations và export compare là future
  UI.
- Nút `Mark as Fixed` trong review detail chưa phải luồng persist chính; dùng
  action row status menu để cập nhật todo vào backend.
- Frontend phụ thuộc CDN React/Babel nếu chưa vendor assets.

## Tài Liệu

- As-built design: `docs/superpowers/specs/2026-06-11-review-radar-design.md`
- Historical implementation plan: `docs/superpowers/plans/2026-06-11-review-radar.md`
- Original build prompt: `INSTRUCTION.md` (tài liệu lịch sử, không phải source
  of truth hiện tại)
