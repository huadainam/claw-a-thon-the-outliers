# Review Radar — Design Spec

- **Ngày:** 2026-06-11
- **Team:** The Outliers
- **Bối cảnh:** claw-a-thon, deadline nộp bài 17/06/2026 12:00
- **Deploy target:** GreenNode AgentBase (Custom Agent Runtime, PUBLIC always-on)

---

## 1. Mục tiêu

AI agent nhận tên một ứng dụng, tự động cào ~1.000 review mới nhất từ App Store
và Google Play, phân loại bằng LLM (ưu tiên tiếng Việt), gom nhóm bug report theo
chủ đề + severity, và hiển thị tất cả trên một dashboard kèm bug to-do list. Agent
tự chạy lại pipeline mỗi 1 giờ (incremental, chỉ xử lý review mới).

### Tiêu chí thành công (demo)
1. Nhập `zalo` → agent tìm được app trên cả 2 store, hiện ra để user **xác nhận**; sau khi xác nhận mới bắt đầu scrape + phân tích.
2. Nhập tên sai/mơ hồ (vd `ZLP`) → trả thông báo không tìm thấy + danh sách app gợi ý để chọn.
3. Dashboard hiện đúng phân loại review + bug list với severity.
4. Mark một bug là Done → trạng thái cập nhật và được giữ lại (không bị reset bởi sync sau).
5. Chạy lại (manual hoặc sau 1 giờ) → review mới được append, không duplicate.
6. Link agent public, ai cũng truy cập được.

---

## 2. Quyết định thiết kế (đã chốt)

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| Lưu state | **AgentBase Memory** (qua lớp `storage` trừu tượng) | Bền qua restart/redeploy, đúng tinh thần "agent có memory". |
| Backend dev | **File JSON local** (cùng interface) | Dev máy nhanh, không cần gọi API; chọn qua env `STORE_BACKEND`. |
| Rủi ro scraping | **Scrape live + fallback cache** | Cloud IP có thể bị chặn; nếu scrape rỗng/lỗi → dùng batch review cache mới nhất trong store. Dashboard không bao giờ trống lúc demo. |
| Hourly sync | **Thread `schedule` trong Flask server** (always-on) + `POST /run` manual | Đơn giản, tự chứa; nút Refresh tiện quay demo không phải chờ 1 tiếng. |
| Frontend | **Vanilla HTML + JS + Chart.js (CDN)**, self-contained | Không build step, nhẹ, deploy nhanh — hợp deadline 6 ngày. |
| Phạm vi app | **Một app tại một thời điểm** | Chọn app mới → reset state. Gọn, đúng must-have. |

---

## 3. Kiến trúc tổng quan

Một Flask app lắng nghe **port 8080** đóng 3 vai:
- **(a)** serve dashboard tĩnh (`/`, `index.html`)
- **(b)** REST API cho dashboard (`/api/*`)
- **(c)** chứa một background daemon thread chạy pipeline mỗi 1 giờ

Mọi I/O state đi qua lớp `storage` trừu tượng (LocalStore file JSON hoặc MemoryStore
AgentBase). Runtime chỉ bắt buộc 2 thứ: lắng nghe port 8080 + `GET /health` trả 200.
Credentials Memory được AgentBase tự inject vào container (`GREENNODE_CLIENT_ID/SECRET`).

```
                ┌─────────────────────────────────────────┐
                │            Flask app (port 8080)         │
   Dashboard ◄──┤  /  /health  /api/*  /run                │
   (browser)    │                                          │
                │  ┌────────────┐   ┌────────────────────┐ │
                │  │ scheduler  │──►│  run_pipeline()    │ │
                │  │ thread(1h) │   │  (pipeline.py)     │ │
                │  └────────────┘   └─────────┬──────────┘ │
                └────────────────────────────┼────────────┘
                                              ▼
        scraper ─► dedup ─► classifier ─► grouper ─► storage(Store)
          │                    │                        │
       2 stores            GreenNode LLM        Memory / JSON local
```

---

## 4. Module breakdown

| File | Trách nhiệm | Phụ thuộc |
|---|---|---|
| `app.py` | Flask: `/health`, `/`, `/api/*`, `/run`; spawn scheduler thread khi `--serve` | pipeline, storage, config |
| `pipeline.py` | `run_pipeline(app)` orchestrate toàn bộ; lock tránh chạy chồng | scraper, classifier, grouper, storage |
| `scraper.py` | `resolve_app(name)`, `scrape_google_play(app_id)`, `scrape_app_store(app_id)` — luôn trả về giá trị, không raise | google-play-scraper, app-store-scraper, difflib |
| `classifier.py` | `classify_reviews(reviews)` — batch 30/lần, structured JSON, GreenNode LLM | openai |
| `grouper.py` | `group_bugs(reviews)`, `merge_with_existing_todos(new, existing)` | uuid, difflib |
| `storage.py` | Interface `Store` + `LocalStore` (JSON) + `MemoryStore` (AgentBase) | requests |
| `config.py` | Đọc env: `MODEL_NAME`, `STORE_BACKEND`, `MEMORY_ID`, `OPENAI_*` | os, dotenv |

Nguyên tắc: mỗi module một trách nhiệm rõ ràng, test độc lập được. `storage.Store` là
interface chung để pipeline không biết đang dùng file hay Memory.

---

## 5. App Resolution + gợi ý fuzzy

Resolve tên app là **bước riêng, đứng trước pipeline**. Tận dụng hàm search của 2 thư
viện (trả về nhiều ứng viên).

> **Nguyên tắc:** resolve **luôn chỉ search, không bao giờ tự scrape**. User phải
> **xác nhận/chọn** một app trước khi pipeline chạy — kể cả khi khớp tốt. `matched`
> chỉ pre-select ứng viên tốt nhất để user bấm xác nhận, không auto-proceed.

`resolve_app(name) -> dict` trả về 1 trong 3 trạng thái:

| Status | Điều kiện | Payload | Hành vi UI |
|---|---|---|---|
| `matched` | Có ứng viên khớp tốt (similarity ≥ ~0.85, hoặc khớp case-insensitive) | `{ app: {title, developer, icon, gp_id, as_id, stores} }` | Hiện app khớp nhất + nút **"Xác nhận theo dõi"** |
| `ambiguous` | Có ứng viên gần giống (0.4 ≤ sim < 0.85) | `{ suggestions: [ {title, developer, icon, gp_id, as_id, stores}, ... ] }` | Hiện danh sách thẻ gợi ý để **chọn** |
| `not_found` | Không ứng viên nào đủ gần / cả 2 store rỗng | `{ message, suggestions?: [...top kết quả gần nhất] }` | Banner "không tìm thấy" + gợi ý gần nhất / nhập lại |

Thuật toán: search top ~5 mỗi store → merge ứng viên theo độ giống tiêu đề
(`difflib.SequenceMatcher`) → tính max similarity với input để quyết định status.

**Luồng (start flow):**
```
User nhập tên app
  → POST /api/resolve  (chỉ search, KHÔNG scrape — nhanh)
  → matched   : hiện app khớp nhất + nút "Xác nhận theo dõi"
    ambiguous : hiện danh sách thẻ gợi ý (vd nhập "ZLP" → Zalo, ZaloPay, Zip...)
    not_found : "Không tìm thấy 'ZLP'. Có phải ý bạn là..." + gợi ý / nhập lại
  → user XÁC NHẬN / CHỌN một app (đã kèm gp_id/as_id)
  → POST /api/track → reset state, set app, scrape + chạy pipeline lần đầu (async)
  → các bước tiếp theo (classify → group → dashboard) chạy như mục 6
```

---

## 6. Luồng dữ liệu pipeline

```
run_pipeline(app):
  1. scrape_google_play(app.gp_id) + scrape_app_store(app.as_id)
  2. nếu cả hai rỗng/lỗi → fallback: load batch review cache mới nhất từ store
  3. dedup: bỏ review có id ∈ processed_ids
  4. nếu không có review mới → log "không có review mới", giữ nguyên state, return
  5. classify_reviews(new) — batch 30, structured JSON
  6. append review đã phân loại vào store; cập nhật processed_ids
  7. group_bugs(tất cả review BUG_REPORT) → bug groups + severity
  8. merge_with_existing_todos(groups, existing) — GIỮ status cũ (done không reset)
  9. lưu todos + cập nhật last_updated timestamp
```

### Phân loại (classifier)
Nhãn: `BUG_REPORT | FEATURE_REQUEST | COMPLAINT | POSITIVE | SPAM`.
Batch 30 review/request, prompt tiếng Việt, yêu cầu trả JSON array đúng thứ tự với
`{id, label, bug_topic, confidence}`. Parse lỗi → mặc định `SPAM`, confidence `0.0`.

### Gom nhóm + severity (grouper)
Lọc `BUG_REPORT` → gom theo `bug_topic` (so khớp string, merge topic gần giống bằng
similarity). `mention_count`: ≥10 → `critical`, ≥3 → `medium`, <3 → `low`. Merge với
todos cũ theo topic (case-insensitive), cập nhật mention/last_seen/sample/severity,
**giữ nguyên `status`**.

---

## 7. Storage interface

```python
class Store(ABC):
    def load_config(self) -> dict           # app đang theo dõi
    def save_config(self, cfg: dict)
    def load_processed_ids(self) -> set[str]
    def save_processed_ids(self, ids: set[str])
    def load_reviews(self) -> list[dict]
    def append_reviews(self, reviews: list[dict])
    def load_todos(self) -> list[dict]
    def save_todos(self, todos: list[dict])
    def reset(self)                          # xóa state khi đổi app
```

- **LocalStore**: đọc/ghi JSON trong `data/` (dev).
- **MemoryStore**: mỗi loại state là một *session* trong 1 Memory store; `save` = ghi
  1 event chứa full JSON vào content; `load` = lấy event mới nhất rồi parse
  (last-write-wins). Gọi Memory REST API với IAM token (creds auto-inject trên runtime).

Chọn backend qua `STORE_BACKEND=local|memory`.

---

## 8. API

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/health` | Luôn 200 (kể cả khi chưa có data) |
| `GET` | `/` | Serve `index.html` |
| `POST` | `/api/resolve` | `{name}` → `{status, app?, suggestions?, message?}` (chỉ search) |
| `POST` | `/api/track` | `{gp_id, as_id, title}` → reset state, set app, chạy pipeline async, trả ngay |
| `POST` | `/run` | Trigger pipeline thủ công cho app hiện tại (nút Refresh) |
| `GET` | `/api/stats` | `{app, total, by_label, last_updated, bug_by_day}` |
| `GET` | `/api/todos` | Danh sách bug to-do |
| `PATCH`| `/api/todos/<id>` | `{status: open|done}` → cập nhật + lưu |
| `GET` | `/api/reviews` | Review đã phân loại (cho Review Explorer) |

---

## 9. Dashboard (vanilla `index.html`)

- **Màn hình tìm app (start):** ô input + nút "Tìm app" → gọi `/api/resolve`.
  - `matched` → hiện 1 thẻ app khớp nhất + nút **"Xác nhận theo dõi"** (chưa scrape cho tới khi bấm).
  - `ambiguous` → hiện **các thẻ gợi ý** (icon + tên + developer + badge store nào có) để chọn.
  - `not_found` → banner đỏ + gợi ý gần nhất (nếu có) / cho nhập lại.
  - Xác nhận/chọn thẻ → `POST /api/track` → hiện spinner "Đang phân tích review...".
- **Header (sau khi đang theo dõi):** tên app + `last_updated` + nút Refresh (`/run`) + nút "Đổi app" (quay lại màn hình tìm app).
- **4 Overview cards:** tổng review xử lý / bug open / bug critical / bug done.
- **Charts (Chart.js CDN):** donut phân bố label; bar bug-report theo ngày (7 ngày gần nhất).
- **Bug To-Do table:** cột `Severity | Chủ đề | Mention | Nguồn | Lần cuối | Trạng thái | Hành động`. Filter severity (All/Critical/Medium/Low) + status (All/Open/Done). Badge màu. Click row → expand 3 sample review gốc. Mark Done/Reopen → `PATCH /api/todos/<id>`.
- **Review Explorer:** bảng `Nguồn | Rating | Label | Nội dung | Ngày`, filter label/rating/source, pagination 20/trang.
- Màu chủ đạo xanh lá `#22c55e`, font Inter/system, responsive ≥1280px, state giữ trong biến JS (không localStorage).

---

## 10. Error handling

| Tình huống | Xử lý |
|---|---|
| App không tìm thấy | `resolve` trả `not_found` + gợi ý gần nhất (mục 5) |
| Tên app mơ hồ | `resolve` trả `ambiguous` + danh sách chọn |
| Scrape lỗi/bị chặn | Hàm trả `[]` + log warning; pipeline fallback cache |
| Cả 2 store rỗng | Dùng review cache mới nhất; nếu chưa có cache → giữ state cũ |
| LLM parse lỗi | Review đó → `SPAM`, confidence `0.0` |
| Memory API lỗi khi đọc | Trả default rỗng → dashboard vẫn render; log lỗi |
| Không có review mới | Log + giữ nguyên state |
| Pipeline đang chạy | Lock → bỏ qua trigger trùng |

---

## 11. Testing

- **scraper:** `resolve_app("zalo")` → `matched`; `resolve_app("zzxxqq")` → `not_found`; `resolve_app("zlp")` → `ambiguous` chứa ZaloPay/Zalo; app không tồn tại khi scrape → `[]`.
- **classifier:** 3 review mẫu (bug/positive/spam) → đúng label; JSON lỗi → SPAM fallback.
- **grouper:** severity boundary (2/3/10 mention); merge giữ status `done`.
- **storage:** round-trip save/load trên LocalStore (và MemoryStore nếu có creds).
- **E2E:** `python -m pipeline --app zalo` chạy hết; dashboard render từ data thật.

---

## 12. Deployment (AgentBase)

1. Tạo Memory store trước → lấy `MEMORY_ID`.
2. `Dockerfile`: `python:3.11-slim`, `pip install -r requirements.txt`, `EXPOSE 8080`, `CMD ["python","app.py","--serve"]`.
3. Build → push lên Container Registry (managed).
4. Tạo Custom Agent Runtime **PUBLIC always-on**; truyền env `MEMORY_ID`, `STORE_BACKEND=memory`, `MODEL_NAME`, `OPENAI_BASE_URL`. (`OPENAI_API_KEY` qua identity/secret; IAM creds auto-inject.)
5. Đảm bảo `/health` 200 → runtime `ACTIVE`; lấy public endpoint cho demo.
6. GitHub repo public trước 17/06; `.env` trong `.gitignore`.

`requirements.txt`: `google-play-scraper`, `app-store-scraper`, `openai`, `python-dotenv`, `schedule`, `flask`, `requests`.

---

## 13. Scope (must vs nice)

- ✅ **Must:** resolve app + gợi ý fuzzy · scrape → classify → group · dashboard + bug to-do · dedup · hourly sync · Mark Done · filter severity · storage Memory.
- 🔄 **Should:** trend bar chart theo ngày · click bug xem review gốc.
- ⭐ **Nice (bỏ nếu thiếu thời gian):** Review Explorer đầy đủ · export CSV · multi-app.
