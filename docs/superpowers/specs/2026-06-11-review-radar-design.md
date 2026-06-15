# Review Radar - As-Built Design Spec

- **Ngày gốc:** 2026-06-11
- **Cập nhật:** phản ánh source code hiện tại
- **Team:** The Outliers
- **Runtime target:** GreenNode AgentBase Custom Agent Runtime

## 1. Mục Tiêu Sản Phẩm

Review Radar là một AI agent giúp team sản phẩm đọc review mobile app nhanh hơn.
Hệ thống thu thập review từ App Store và Google Play, dùng LLM để phân loại, gom
bug report thành nhóm, tính mức độ nghiêm trọng, và hiển thị trên dashboard.

Mục tiêu không phải thay thế con người ra quyết định. Mục tiêu là biến một dòng
review lớn thành danh sách vấn đề có thể đọc, ưu tiên và xử lý.

## 2. Tóm Tắt Cho Người Non-Tech

Người dùng có thể báo cùng một lỗi bằng nhiều cách khác nhau:

```text
"Không đăng nhập được"
"Login Google lỗi"
"Tài khoản cứ bị đẩy ra"
"Mở app lên lại bắt đăng nhập"
```

Review Radar cố gắng nhận ra đây là cùng một chủ đề:

```text
Lỗi đăng nhập
```

Sau đó hệ thống đếm số lần lỗi này được nhắc tới. Nếu nhiều người gặp cùng một
lỗi, bug đó được đẩy lên mức ưu tiên cao hơn.

## 3. Flow Tổng Quan

```text
User
 |
 | nhập tên app
 v
Resolve app
 |
 | tìm trên App Store / Google Play
 v
User chọn đúng app
 |
 v
Track app
 |
 | tạo/cập nhật app trong registry
 v
Pipeline chạy nền
 |
 +--> Scrape reviews
 |
 +--> Deduplicate review IDs
 |
 +--> LLM classify reviews
 |
 +--> LLM canonicalize bug topics
 |
 +--> Group bug reports
 |
 +--> Save reviews, todos, meta
 |
 v
Dashboard
 |
 | đọc stats/todos/reviews qua API
 v
Người dùng xem KPI, action items, review detail
```

## 4. Kiến Trúc Hiện Tại

Ứng dụng là một Flask server duy nhất chạy ở port `8080`.

Server này làm 3 việc:

1. Serve dashboard React trong `review-radar/dashboard/`.
2. Cung cấp REST API cho dashboard.
3. Chạy scheduler khi start với `--serve`.

```text
                 Browser
                    |
                    v
        React dashboard served by Flask
                    |
                    v
              Flask REST API
                    |
        +-----------+------------+
        |                        |
        v                        v
   App registry              Review pipeline
        |                        |
        v                        v
 LocalStore / MemoryStore  Scraper + LLM + Grouper
```

## 5. Frontend Hiện Tại

Frontend không còn là vanilla HTML + Chart.js như plan ban đầu. Dashboard hiện
dùng:

- React 18 qua CDN.
- ReactDOM qua CDN.
- Babel standalone qua CDN để chạy JSX trực tiếp trong browser.
- Nhiều file JSX trong `review-radar/dashboard/`.
- Custom SVG chart components, không dùng Chart.js.
- `api-bridge.js` để chuyển data backend sang shape UI cần.

### File frontend chính

| File | Vai trò |
|---|---|
| `index.html` | Load React, Babel, CSS, data bridge và JSX files |
| `app.jsx` | App shell, routing UI, language state, polling status |
| `api-bridge.js` | Gọi backend API và map data sang `window.DATA` |
| `data.js` | I18N, fallback/mock data, demo config |
| `screen1.jsx` | Search, selection, app gallery |
| `screen2.jsx` | Crawl progress screen |
| `dashboard.jsx` | Overview, dashboard-level filters, actions/reviews shell |
| `charts.jsx` | Donut chart và trend chart bằng SVG |
| `table.jsx` | Review explorer |
| `subviews.jsx` | Full Actions và Reviews pages |
| `reports.jsx` | Reports UI cho phase tiếp theo |
| `compare.jsx` | Compare Apps, đọc data backend thật |
| `settings.jsx` | Settings/integrations UI cho phase tiếp theo |
| `team.jsx` | Team page và feedback form |

### Màn hình đã nối backend thật

- Search app.
- Track app.
- Available apps/gallery.
- Crawl progress và cancel.
- Dashboard overview.
- Action item data và status update.
- Review explorer.
- Compare Apps, lấy dữ liệu từ `/api/stats`, `/api/reviews`, `/api/todos`.
- Team feedback, persist qua `/api/feedback`.

### Màn hình demo/future

- Reports.
- Scheduled reports.
- Settings integrations.
- Export comparison.

## 6. Date Range Và Source Window

Backend áp dụng source window để tránh tính review trong ngày hiện tại khi store
chưa đồng bộ hết dữ liệu. Cutoff hiện tại là ngày hôm qua theo GMT+7. Vì vậy UI
có thể hiển thị "Dữ liệu tới 14/06/2026" nếu ngày hiện tại là 15/06/2026.

Frontend có date range `7N / 30N / 90N`. Range này hiện được áp dụng đồng bộ cho:

- KPI cards.
- Category/donut chart.
- Trend chart.
- Action preview trên overview.
- Actions page.
- Reviews page/table.

## 7. Backend Modules

| File | Vai trò |
|---|---|
| `app.py` | Flask routes, active app handling, queue/cancel, seed bootstrap, scheduler |
| `pipeline.py` | Điều phối scrape -> classify -> canonicalize -> group |
| `scraper.py` | Resolve app, normalize review schema |
| `scraper_live.py` | Live calls tới Google Play scraper và iTunes APIs/RSS |
| `classifier.py` | Gọi LLM để classify review |
| `canonicalize.py` | Gọi LLM để gom topic bug về nhãn chuẩn |
| `grouper.py` | Group bug, tính severity, merge todos cũ |
| `storage.py` | Store abstraction, LocalStore, MemoryStore, Registry |
| `memory_http.py` | Thin HTTP client cho AgentBase Memory |
| `bootstrap.py` | Copy seed data vào live store nếu store trống |
| `seed.py` | Tạo seed data bằng resolve + pipeline |
| `regroup_seed.py` | Rebuild todos trong seed bằng canonical topics |
| `migrate_to_memory.py` | Copy local JSON data lên AgentBase Memory |

## 8. API Hiện Tại

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/` | Serve dashboard |
| `POST` | `/api/resolve` | Tìm app theo tên, trả về matched/ambiguous/not_found |
| `POST` | `/api/track` | Add/update app, set active, start pipeline async |
| `GET` | `/api/apps` | List tracked apps kèm crawl status/progress |
| `GET` | `/api/apps?lite=1` | Lightweight gallery payload |
| `PATCH` | `/api/apps/<app_id>` | Update app config, hiện dùng cho hourly refresh |
| `POST` | `/api/active` | Set active app |
| `POST` | `/run` | Chạy pipeline thủ công cho active app |
| `POST` | `/api/cancel` | Hủy queued/running crawl cho một app |
| `GET` | `/api/stats?app_id=<id>` | Metrics, label counts, bug_by_day, meta |
| `GET` | `/api/todos?app_id=<id>` | Bug action items |
| `PATCH` | `/api/todos/<todo_id>?app_id=<id>` | Update todo status theo app |
| `GET` | `/api/reviews?app_id=<id>` | Classified reviews |
| `GET` | `/api/feedback` | Đọc feedback dùng chung |
| `POST` | `/api/feedback` | Gửi feedback dùng chung |

Read endpoints như `/api/stats`, `/api/todos`, `/api/reviews` hỗ trợ
`?app_id=<id>` và fallback về active app nếu không truyền `app_id`.

## 9. Storage Hiện Tại

Tất cả state đi qua `storage.py`.

### LocalStore

Dùng cho dev offline và regression test:

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

### MemoryStore

Dùng cho deploy và workflow test chung của team. Mỗi loại state được lưu qua
AgentBase Memory. Khi có `app_id`, session key được tách theo app để tránh lẫn
dữ liệu.

Khi test local với CSDL server, `.env` nên dùng:

```bash
STORE_BACKEND=memory
MEMORY_ID=<team-memory-id>
MEMORY_BASE_URL=https://agentbase.api.vngcloud.vn/memory
```

`STORE_BACKEND=local` chỉ nên dùng khi cần chạy tách khỏi dữ liệu server.

### Registry

Registry quản lý:

- app nào đã được track
- app nào đang active
- metadata app: title, icon, developer, store IDs, review_limit
- hourly refresh flag

Có 2 backend:

- `LocalRegistry`
- `MemoryRegistry`

## 10. Data Schema Chính

### App config

```json
{
  "app_id": "1112407590",
  "title": "Zalopay-Thanh toán & Tài chính",
  "developer": "ZION JOINT STOCK COMPANY",
  "icon": "...",
  "gp_id": null,
  "as_id": "1112407590",
  "stores": ["app_store"],
  "review_limit": 100,
  "hourly_refresh_enabled": true
}
```

### Review

```json
{
  "id": "review-id",
  "userName": "User",
  "content": "App bị lỗi đăng nhập",
  "score": 1,
  "at": "2026-06-11T08:00:00",
  "source": "app_store",
  "label": "BUG_REPORT",
  "bug_topic": "Lỗi đăng nhập",
  "confidence": 0.9
}
```

### Todo / action item

```json
{
  "id": "todo-abc",
  "title": "Lỗi đăng nhập",
  "count": 12,
  "severity": "critical",
  "status": "open",
  "review_ids": ["review-id-1", "review-id-2"]
}
```

### Meta

```json
{
  "status": "idle",
  "progress": {"done": 100, "total": 100},
  "last_run": "2026-06-15T07:30:00Z",
  "last_updated": "2026-06-15T07:30:00Z",
  "error": null
}
```

## 11. Pipeline Behavior

Pipeline chính trong `pipeline.py`:

1. Load app config.
2. Scrape review từ các store có ID.
3. Deduplicate bằng processed IDs.
4. Classify từng review bằng LLM.
5. Canonicalize bug topic để gom các câu diễn đạt khác nhau.
6. Merge review mới với review cũ.
7. Group bug reports thành todos.
8. Save reviews, todos, processed IDs và meta.

Pipeline có queue trong `app.py` để tránh nhiều run cùng lúc cho cùng một app.
`/api/cancel` đánh dấu cancel key; worker dừng ở batch boundary, giữ lại phần
review đã xử lý và regroup trước khi lưu.

Scheduler chỉ chạy khi start app với `--serve`. Scheduler check định kỳ app nào
cần hourly refresh, dựa trên flag của app và meta lần chạy gần nhất.

## 12. Seed Data

`review-radar/seed/` chứa dữ liệu đã phân tích sẵn. Khi store trống,
`bootstrap_from_seed(get_registry(), get_store)` sẽ copy seed vào backend đang
dùng. Điều này giúp demo có dữ liệu ngay cả khi live crawl chậm hoặc store bị
throttle.

## 13. Current Feature Status

### Đã chạy thật

- Resolve/search app.
- Track app mới.
- Multi-app registry.
- Crawl App Store / Google Play.
- Deduplicate review đã xử lý.
- LLM classify.
- LLM canonicalize bug topic.
- Group bug và tính severity.
- Dashboard overview bằng data backend.
- Date range filter cho KPI/chart/actions/reviews.
- Action status update qua API.
- Compare Apps bằng data backend.
- Feedback persistence qua API.
- Hourly refresh flag theo app.
- Cancel queued/running crawl.
- Seed bootstrap.
- LocalStore và MemoryStore.

### Future/demo UI

- Reports và scheduled reports.
- Settings integrations.
- Export comparison.
- Một nút `Mark as Fixed` trong review detail vẫn là UI-only; luồng persist chính
  là status menu trong action row.

## 14. Local Run

```bash
cd review-radar
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp .env.example .env
./.venv/bin/python app.py --serve
```

Mở:

```text
http://127.0.0.1:8080/
```

Nếu chỉ chạy `./.venv/bin/python app.py`, dashboard/API vẫn chạy nhưng scheduler
không bật.

## 15. Environment Variables

| Biến | Ý nghĩa |
|---|---|
| `OPENAI_API_KEY` | API key cho LLM endpoint |
| `OPENAI_BASE_URL` | Base URL của LLM endpoint |
| `MODEL_NAME` | Model dùng cho classify/canonicalize |
| `REVIEW_LIMIT` | Số review scrape mỗi store khi track/chạy thủ công |
| `REFRESH_REVIEW_LIMIT` | Số review scrape mỗi store khi hourly refresh |
| `STORE_BACKEND` | `local` hoặc `memory` |
| `MEMORY_ID` | AgentBase Memory store ID khi dùng MemoryStore |
| `MEMORY_BASE_URL` | AgentBase Memory API base URL |

## 16. Test Coverage

Test suite nằm trong `review-radar/tests/` và bao phủ:

- Flask app routes và API behavior.
- Pipeline success/error/cancel behavior.
- Config loading.
- LocalStore, MemoryStore, Memory HTTP client.
- Multi-app storage.
- Bootstrap seed.
- Resolve/scrape normalization.
- Classifier/canonicalize fallback behavior.
- Grouper/severity logic.

Chạy:

```bash
cd review-radar
./.venv/bin/python -m pytest -q
```

## 17. Những Điểm Cần Nhớ Khi Demo

- Với local test chung, dùng `STORE_BACKEND=memory` để đọc CSDL server.
- Source cutoff là ngày hôm qua theo GMT+7, nên "Dữ liệu tới" có thể không phải
  ngày hiện tại.
- Date range 7/30/90 hiện đã tác động tới KPI, chart, actions và reviews.
- Compare Apps đã dùng dữ liệu backend thật, nhưng export comparison vẫn là
  future.
- Team feedback đã persist qua API.
- Reports và integrations vẫn là phase tiếp theo.
