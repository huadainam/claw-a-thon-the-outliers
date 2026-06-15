# Review Radar - The Outliers

Review Radar là AI agent giúp team Product, Engineering, QA và Support đọc hiểu
review ứng dụng nhanh hơn. Thay vì đọc thủ công hàng trăm review trên App Store
và Google Play, hệ thống tự thu thập review, dùng LLM để phân loại feedback,
gom các bug giống nhau thành action item, tính mức độ ưu tiên và hiển thị trên
dashboard.

> Built for GreenNode AgentBase / claw-a-thon by team The Outliers.

Live demo:

```text
https://endpoint-2043fa62-0dc6-4e6f-8d4c-d2b8091c76ab.agentbase-runtime.aiplatform.vngcloud.vn
```

## Bài Toán

Review của người dùng thường rất nhiều, lặp lại và không được viết theo cùng một
cách. Ví dụ các câu như "không đăng nhập được", "login Google bị lỗi", "mở app
lên lại bắt đăng nhập" có thể đang nói về cùng một lỗi. Nếu xử lý thủ công, team
phải tự đọc, phân loại, gom nhóm, đếm số lần xuất hiện và quyết định mức độ ưu
tiên.

Review Radar biến luồng review thô thành một dashboard có thể hành động:

- app nào đang được theo dõi
- review mới đã được crawl và phân loại
- tỉ trọng bug, complaint, feature request, positive, spam
- bug/action item nào xuất hiện nhiều nhất
- severity của từng bug group
- review gốc liên quan tới từng action item
- so sánh nhiều app theo KPI, rating, sentiment và bug volume

## Luồng Hoạt Động

```text
Người dùng nhập tên app
        |
        v
Resolve app trên App Store / Google Play
        |
        v
Chọn app + số review muốn phân tích
        |
        v
Track app vào registry và enqueue pipeline
        |
        v
Crawl review mới từ store
        |
        v
Deduplicate review đã xử lý
        |
        v
LLM classify từng review
        |
        v
LLM canonicalize bug topic
        |
        v
Group bug report thành todo/action item
        |
        v
Dashboard đọc REST API và cập nhật UI
```

## Tính Năng Chính

- Tìm app theo tên bằng fuzzy matching, có gợi ý khi tên không khớp tuyệt đối.
- Gộp metadata từ App Store và Google Play thành một app record.
- Track nhiều app, mỗi app có config, reviews, todos, processed IDs và meta
  riêng.
- Crawl Google Play review bằng `google-play-scraper`.
- Crawl App Store review bằng iTunes Search/Lookup/RSS; với backfill lớn, hệ
  thống đi qua nhiều storefront để vượt giới hạn RSS của một country.
- Retry/backoff khi store API bị throttle hoặc trả lỗi tạm thời.
- Deduplicate review theo ID để giảm chi phí LLM.
- Classify review thành 5 label:
  - `BUG_REPORT`
  - `FEATURE_REQUEST`
  - `COMPLAINT`
  - `POSITIVE`
  - `SPAM`
- Canonicalize bug topic để các cách diễn đạt khác nhau được gom về cùng một
  nhãn chuẩn.
- Group bug thành action item và tính severity:
  - `critical`: từ 10 mentions
  - `medium`: từ 3 đến 9 mentions
  - `low`: 1 đến 2 mentions
- Giữ nguyên status todo khi regroup, ví dụ `open`, `in_progress`, `done/fixed`,
  `ignored`.
- Queue pipeline để nhiều app không chạy đè nhau.
- Cho phép cancel crawl; review đã classify trước thời điểm cancel vẫn được giữ.
- Hỗ trợ hourly refresh theo từng app, có thể bật/tắt trong gallery.
- Có seed data để demo không bị trống khi live crawling chậm hoặc bị rate limit.
- Có Team feedback view, persist vào cùng storage backend.

## Kiến Trúc

Ứng dụng là một Flask server chạy ở port `8080`.

```text
Browser
  |
  v
React dashboard served by Flask
  |
  v
Flask REST API
  |
  +-- App registry
  +-- Feedback store
  +-- Crawl queue / scheduler
  +-- Review pipeline
        |
        +-- Scraper
        +-- LLM classifier
        +-- LLM topic canonicalizer
        +-- Bug grouper
        +-- Storage
              |
              +-- Local JSON
              +-- AgentBase Memory
```

### Backend Modules

| File | Vai trò |
|---|---|
| `review-radar/app.py` | Flask app, REST API, queue/cancel, scheduler, seed bootstrap |
| `review-radar/pipeline.py` | Điều phối scrape -> classify -> canonicalize -> group -> save |
| `review-radar/scraper.py` | Resolve app và normalize review schema |
| `review-radar/scraper_live.py` | Live Google Play/iTunes search, lookup và review crawling |
| `review-radar/classifier.py` | Prompt + OpenAI-compatible LLM call để classify review |
| `review-radar/canonicalize.py` | Gom raw bug topics thành canonical labels |
| `review-radar/grouper.py` | Group bug reports, tính severity, merge todo cũ |
| `review-radar/storage.py` | LocalStore, MemoryStore, Registry, FeedbackStore |
| `review-radar/memory_http.py` | Client cho AgentBase Memory Events API |
| `review-radar/bootstrap.py` | Copy bundled seed data vào live store ở lần chạy đầu |
| `review-radar/seed.py` | Tạo seed cache bằng pipeline thật |
| `review-radar/scripts/init_core_apps.py` | Configure/crawl danh sách core apps và bật hourly refresh |

### Frontend

Dashboard nằm trong `review-radar/dashboard/` và chạy trực tiếp trên browser:

- React 18 từ CDN.
- ReactDOM từ CDN.
- Babel Standalone để chạy JSX tại runtime.
- Không có npm build step.
- Chart được vẽ bằng custom SVG components.
- `api-bridge.js` map REST API payload sang shape UI.
- State route/language lưu bằng `localStorage`.

Các màn hình đã nối backend thật:

- App search + track app mới.
- App gallery, trạng thái crawl, queue position, progress và cancel.
- Dashboard overview với KPI, category donut, trend chart, sentiment/rating mix.
- Date range `7N / 30N / 90N` áp dụng cho KPI, chart, actions và review table.
- Action items page và update status todo qua API.
- Reviews explorer với filter và expandable detail.
- Compare Apps, đọc dữ liệu thật từ `/api/stats`, `/api/reviews`, `/api/todos`.
- Team feedback, persist qua `/api/feedback`.

Các phần hiện vẫn là future/demo UI:

- Reports và scheduled report delivery.
- Settings integrations, API key management và admin controls.
- Export compare/report.
- Các nút trong review detail như `Mark as Fixed`, `Create Ticket`,
  `Reply Suggestion` là UI-only; flow persist chính là status menu trên action
  row.

## REST API

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/` | Serve dashboard |
| `POST` | `/api/resolve` | Tìm app theo tên |
| `POST` | `/api/track` | Track app, lưu config, enqueue pipeline |
| `GET` | `/api/apps` | List tracked apps kèm status/progress/queue |
| `GET` | `/api/apps?lite=1` | Payload nhẹ cho initial/poll |
| `PATCH` | `/api/apps/<app_id>` | Bật/tắt hourly refresh |
| `POST` | `/api/active` | Set active app |
| `POST` | `/run` | Chạy pipeline thủ công cho active app |
| `POST` | `/api/cancel` | Cancel queued/running crawl của một app |
| `GET` | `/api/stats?app_id=<id>` | KPI, label counts, bug trend, meta |
| `GET` | `/api/todos?app_id=<id>` | Action items |
| `PATCH` | `/api/todos/<todo_id>?app_id=<id>` | Update todo status |
| `GET` | `/api/reviews?app_id=<id>` | Classified reviews |
| `GET` | `/api/feedback` | List feedback |
| `POST` | `/api/feedback` | Submit feedback |

Các read endpoint hỗ trợ `?app_id=<id>` để tránh phụ thuộc hoàn toàn vào active
app và tránh cache collision khi chuyển app.

## Storage

Storage backend được chọn bằng biến môi trường `STORE_BACKEND`.

### Local JSON

Dùng cho dev offline và test:

```text
review-radar/data/
  registry.json
  feedback.json
  apps/
    <app_id>/
      config.json
      processed_ids.json
      reviews.json
      todos.json
      meta.json
```

### AgentBase Memory

Dùng khi deploy hoặc test chung trên AgentBase. `MemoryStore` ghi state vào
AgentBase Memory Events API theo dạng document log. Reviews và todos được chunk
để tránh payload quá lớn; registry và feedback dùng session riêng.

Khi chạy trên AgentBase Runtime, token được lấy từ
`GREENNODE_CLIENT_ID`/`GREENNODE_CLIENT_SECRET` do platform inject. Khi chạy
local, `memory_http.py` có fallback gọi helper script AgentBase ở repo root.

## Source Window

Dashboard chỉ tính review có ngày không vượt quá cutoff nguồn. Cutoff hiện tại
là ngày hôm qua theo GMT+7. Điều này tránh việc dashboard tính lệch khi store
chưa đồng bộ đủ review trong ngày hiện tại.

Frontend hiển thị nhãn như `Dữ liệu tới <ngày cutoff>` và các range `7N / 30N /
90N` được tính dựa trên cutoff này.

## Seed Data

`review-radar/seed/` chứa các app đã được crawl và phân tích sẵn. Khi app start,
`bootstrap_from_seed()` sẽ copy seed vào backend đang dùng nếu registry còn
trống. Việc copy đi qua interface `Store/Registry`, nên dùng được cho cả Local
JSON lẫn AgentBase Memory.

Các script liên quan:

```bash
cd review-radar
python seed.py seed_apps.txt
python regroup_seed.py
python scripts/init_core_apps.py --configure-only
```

`seed_apps.txt` không được copy vào Docker image; `seed/` thì được bundle để demo
có dữ liệu ngay.

## Chạy Local

```bash
cd review-radar
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Cập nhật `review-radar/.env`:

```bash
OPENAI_API_KEY=...
OPENAI_BASE_URL=...
MODEL_NAME=...
STORE_BACKEND=local
```

Chạy dashboard/API:

```bash
./.venv/bin/python app.py
```

Mở:

```text
http://127.0.0.1:8080/
```

Khi start bằng `app.py`, ứng dụng sẽ bootstrap seed data nếu store đang trống.

Chạy dashboard/API kèm scheduler hourly refresh:

```bash
./.venv/bin/python app.py --serve
```

Với `--serve`, app chạy thêm scheduler nền:

- mỗi 5 phút check app nào đã tới hạn refresh
- enqueue refresh cho app có `hourly_refresh_enabled=true`

## Biến Môi Trường

| Biến | Default | Ý nghĩa |
|---|---|---|
| `OPENAI_API_KEY` | rỗng | API key cho LLM endpoint |
| `OPENAI_BASE_URL` | rỗng | OpenAI-compatible base URL |
| `MODEL_NAME` | `gpt-4o-mini` | Model dùng cho classify/canonicalize |
| `REVIEW_LIMIT` | `100` | Số review mặc định mỗi store mỗi run |
| `REFRESH_REVIEW_LIMIT` | `100` | Số review mỗi store khi scheduled refresh |
| `STORE_BACKEND` | `local` | `local` hoặc `memory` |
| `MEMORY_ID` | rỗng | AgentBase Memory ID khi dùng memory backend |
| `MEMORY_BASE_URL` | `https://agentbase.api.vngcloud.vn/memory` | Memory API base URL |
| `GREENNODE_CLIENT_ID` | platform inject | Service account client ID trên AgentBase Runtime |
| `GREENNODE_CLIENT_SECRET` | platform inject | Service account secret trên AgentBase Runtime |

Lưu ý: `.env`, `.greennode.json`, `.agentbase/`, local `data/` và virtualenv đều
được ignore, không commit secret hoặc dữ liệu runtime.

## Test

```bash
cd review-radar
./.venv/bin/python -m pytest -q
```

Test suite hiện bao phủ:

- app routes và API shape
- queue/scheduler/cancel behavior
- source window cutoff
- pipeline batching, dedup, fallback và error recovery
- classifier/canonicalizer parser fallback
- bug grouping và severity
- LocalStore, MemoryStore, Registry và MemoryHTTP
- scraper normalization và app resolve
- seed/bootstrap scripts

## Docker / Deploy

Build từ repo root:

```bash
docker build -t review-radar review-radar
```

Run local bằng Docker:

```bash
docker run -p 8080:8080 --env-file review-radar/.env review-radar
```

Docker image dùng:

```text
python app.py --serve
```

Nghĩa là container sẽ bootstrap seed, serve dashboard/API và bật scheduler.

## Cấu Trúc Thư Mục

```text
.
├── README.md
├── project_description.md
├── INSTRUCTION.md
├── docs/
├── logo/
└── review-radar/
    ├── app.py
    ├── pipeline.py
    ├── scraper.py
    ├── scraper_live.py
    ├── classifier.py
    ├── canonicalize.py
    ├── grouper.py
    ├── storage.py
    ├── memory_http.py
    ├── bootstrap.py
    ├── dashboard/
    ├── seed/
    ├── tests/
    ├── requirements.txt
    └── Dockerfile
```

## Known Gaps

- Frontend phụ thuộc CDN React/Babel, nên môi trường offline hoàn toàn cần vendor
  assets hoặc thêm build step.
- Reports, scheduled delivery, Settings integrations và export vẫn là future UI.
- Review detail action buttons chưa persist; dùng action row status menu để cập
  nhật todo thật.
- Health score và priority trong frontend là heuristic từ label/rating/volume,
  không phải một model dự đoán riêng.
- Store review feed có thể trễ hơn thời gian thực và có thể bị rate limit.

## Tài Liệu Liên Quan

- `project_description.md`: mô tả sản phẩm ngắn gọn.
- `docs/superpowers/specs/2026-06-11-review-radar-design.md`: as-built design
  spec.
- `docs/superpowers/plans/2026-06-11-review-radar.md`: implementation plan ban
  đầu.
- `INSTRUCTION.md`: prompt/yêu cầu gốc của cuộc thi, không phải source of truth
  hiện tại.
