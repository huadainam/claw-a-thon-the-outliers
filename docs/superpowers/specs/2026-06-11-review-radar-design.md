# Review Radar - As-Built Design Spec

- **Ngày gốc:** 2026-06-11
- **Cập nhật:** phản ánh source code hiện tại
- **Team:** The Outliers
- **Deploy target:** GreenNode AgentBase Custom Agent Runtime, public always-on

---

## 1. Mục Tiêu Sản Phẩm

Review Radar là một AI agent giúp team sản phẩm đọc review mobile app nhanh hơn.
Hệ thống thu thập review từ App Store và Google Play, dùng AI để phân loại, gom
bug report thành nhóm, tính mức độ nghiêm trọng, và hiển thị trên dashboard.

Mục tiêu không phải thay thế con người ra quyết định. Mục tiêu là biến một dòng
review lớn thành một danh sách vấn đề để team có thể đọc, ưu tiên và xử lý.

---

## 2. Tóm Tắt Cho Người Non-Tech

Người dùng có thể báo cùng một lỗi bằng nhiều cách khác nhau:

```text
"Không đăng nhập được"
"Login Google lỗi"
"Tài khoản cứ bị đẩy ra"
"Mở app lên lại bắt đăng nhập"
```

Review Radar sẽ cố gắng nhận ra đây là cùng một chủ đề:

```text
Lỗi đăng nhập
```

Sau đó hệ thống đếm số lần lỗi này được nhắc tới. Nếu nhiều người gặp cùng một
lỗi, bug đó được đẩy lên mức ưu tiên cao hơn.

---

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

---

## 4. Kiến Trúc Hiện Tại

Ứng dụng là một Flask server duy nhất chạy ở port `8080`.

Server này làm 3 việc:

1. Serve dashboard React trong `dashboard/`.
2. Cung cấp REST API cho dashboard.
3. Chạy scheduler mỗi giờ khi start với `--serve`.

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

---

## 5. Frontend Hiện Tại

Khác với spec ban đầu, frontend hiện tại không còn là vanilla HTML + Chart.js.

Dashboard hiện dùng:

- React 18 qua CDN.
- ReactDOM qua CDN.
- Babel standalone qua CDN để chạy JSX trực tiếp trong browser.
- Nhiều file JSX trong `review-radar/dashboard/`.
- Custom SVG chart components, không dùng Chart.js.
- `api-bridge.js` để chuyển data backend sang shape UI cần.

### File frontend chính

| File | Vai trò |
|---|---|
| `index.html` | Load React, Babel, CSS, data bridge, JSX files |
| `app.jsx` | App shell, routing UI, language state, polling status |
| `api-bridge.js` | Gọi backend API và map data sang `window.DATA` |
| `data.js` | I18N, fallback/mock data, demo config |
| `screen1.jsx` | Search, selection, app gallery |
| `screen2.jsx` | Crawl progress screen |
| `dashboard.jsx` | Overview, actions, reviews shell |
| `charts.jsx` | Donut chart và trend chart bằng SVG |
| `table.jsx` | Review explorer |
| `subviews.jsx` | Full Actions và Reviews pages |
| `reports.jsx` | Demo/future reports UI |
| `compare.jsx` | Demo comparison UI |
| `settings.jsx` | Demo settings/integrations UI |
| `team.jsx` | Team và feedback UI |

### Màn hình đã nối backend thật

- Search app.
- Track app.
- Available apps.
- Crawl progress.
- Dashboard overview.
- Action item data.
- Review explorer.

### Màn hình demo/future

- Reports.
- Scheduled reports.
- Integrations.
- Team feedback persistence.
- Compare mock metrics.

---

## 6. Backend Modules

| File | Vai trò |
|---|---|
| `app.py` | Flask routes, active app handling, seed bootstrap, scheduler |
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

---

## 7. API Hiện Tại

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/` | Serve dashboard |
| `POST` | `/api/resolve` | Tìm app theo tên, trả về matched/ambiguous/not_found |
| `POST` | `/api/track` | Add/update app, set active, start pipeline async |
| `GET` | `/api/apps` | List tracked apps kèm crawl status/progress |
| `POST` | `/api/active` | Set active app |
| `POST` | `/run` | Chạy pipeline thủ công cho active app |
| `GET` | `/api/stats?app_id=<id>` | Metrics, label counts, bug_by_day, meta |
| `GET` | `/api/todos?app_id=<id>` | Bug action items |
| `PATCH` | `/api/todos/<id>` | Update todo status trên active app |
| `GET` | `/api/reviews?app_id=<id>` | Classified reviews |

Read endpoints như `/api/stats`, `/api/todos`, `/api/reviews` có hỗ trợ
`?app_id=<id>`. Những URL riêng theo app này giúp dashboard tránh hiện nhầm data
khi user chuyển app.

---

## 8. Storage Hiện Tại

Tất cả state đi qua `storage.py`.

### LocalStore

Dùng cho dev và demo local. Mỗi app có folder riêng:

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

Dùng cho AgentBase Memory. Mỗi loại state được lưu như một session/event stream.
Khi có `app_id`, session ID được suffix theo app để tách data từng app.

### Registry

Registry quản lý:

- app nào đã được track
- app nào đang active
- metadata của app: title, icon, developer, store IDs, review_limit

Có 2 backend:

- `LocalRegistry`
- `MemoryRegistry`

---

## 9. Data Schema Chính

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
  "review_limit": 100
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

### Todo / bug group

```json
{
  "id": "uuid",
  "topic": "Lỗi đăng nhập",
  "severity": "critical",
  "mention_count": 12,
  "sample_reviews": ["..."],
  "sources": ["app_store", "google_play"],
  "first_seen": "2026-06-11",
  "last_seen": "2026-06-11",
  "status": "open"
}
```

### Meta / progress

```json
{
  "status": "analyzing",
  "progress": {
    "done": 30,
    "total": 100
  },
  "last_updated": "2026-06-11T08:00:00+00:00"
}
```

---

## 10. Pipeline Chi Tiết

```text
run_pipeline(store)
 |
 +-- load app config
 |
 +-- scrape Google Play nếu có gp_id
 |
 +-- scrape App Store nếu có as_id
 |
 +-- so sánh review IDs với processed_ids
 |
 +-- save meta: analyzing, progress 0/N
 |
 +-- classify new reviews theo batch 30
 |
 +-- append classified reviews
 |
 +-- update processed_ids
 |
 +-- canonicalize toàn bộ bug topics
 |
 +-- group BUG_REPORT reviews
 |
 +-- merge với existing todos
 |      |
 |      +-- giữ old todo id
 |      +-- giữ old done/open status
 |      +-- update mention_count/severity/samples
 |
 +-- save todos
 |
 +-- save meta: idle
```

Nếu scrape trả về rỗng, pipeline sẽ không crash. Nó regroup lại cached reviews
hiện có để dashboard không bị trống nếu đã có data trước đó.

---

## 11. App Resolution

`resolve_app(name)` search trên 2 nguồn:

- Google Play search qua `google-play-scraper`.
- App Store search qua iTunes Search API.

Kết quả được merge và tính điểm gần đúng bằng title similarity.

Trả về 3 trạng thái:

| Status | Ý nghĩa |
|---|---|
| `matched` | Có app khớp tốt, UI hiện nút confirm |
| `ambiguous` | Có nhiều ứng viên gần đúng, UI hiện suggestions |
| `not_found` | Không tìm thấy ứng viên phù hợp |

Resolve chỉ tìm app. Pipeline chỉ chạy sau khi user chọn/confirm app.

---

## 12. Seed Và Bootstrap

`review-radar/seed/` gồm 13 app đã được crawl và phân tích sẵn.

Khi app khởi động:

```text
if live registry is empty:
    copy seed registry and per-app data into live store
else:
    do nothing
```

Nguyên tắc này giữ lại thay đổi của user. Ví dụ, nếu user đã mark một bug là
done, lần restart sau sẽ không bị seed overwrite.

---

## 13. Deployment

Docker image:

```text
python:3.11-slim
WORKDIR /app
pip install -r requirements.txt
COPY . .
CMD ["python", "app.py", "--serve"]
```

Khi chạy với `--serve`:

- bootstraps seed data nếu cần
- serve dashboard/API
- start hourly scheduler thread

Health check:

```text
GET /health
```

---

## 14. Testing

Test suite hiện có 58 tests, bao phủ:

- config defaults/env
- storage local/memory
- registry multi-app
- app resolve
- scraper normalization
- classifier parse/fallback
- canonicalize parse/fallback
- grouper severity/merge
- pipeline dedup/cache fallback/progress
- Flask API shape
- seed/bootstrap behavior

Run:

```bash
cd review-radar
./.venv/bin/python -m pytest -q
```

---

## 15. Known Gaps / Future Work

- `PATCH /api/todos/<id>` hiện patch active app; frontend nên truyền `app_id`
  hoặc backend nên hỗ trợ patch theo app để tránh nhầm khi multi-app.
- Một số nút "Mark as Fixed" trong UI chỉ đổi local state, chưa gọi API.
- Reports, integrations, compare metrics và feedback persistence đang ở mức
  demo/future UI.
- Dashboard phụ thuộc CDN React/Babel nếu chưa vendor assets.
- Plan doc cũ vẫn là historical implementation plan, không phải source of truth
  cho kiến trúc hiện tại.
