# 📡 Review Radar — The Outliers

AI agent tự động phân tích review ứng dụng từ **App Store** và **Google Play**: cào
review, phân loại bằng LLM (ưu tiên tiếng Việt), gom nhóm bug theo chủ đề + mức độ
nghiêm trọng, và hiển thị trên một dashboard kèm bug to-do list. Tự cập nhật mỗi giờ.

> claw-a-thon · Team The Outliers · deploy trên GreenNode AgentBase.

## Tính năng

- **Tìm app fuzzy**: nhập tên → resolve trên 2 store, gợi ý khi mơ hồ, xác nhận trước khi cào.
- **Pipeline**: scrape (giới hạn cấu hình được, retry chống throttle) → phân loại 5 nhãn
  (BUG_REPORT / FEATURE_REQUEST / COMPLAINT / POSITIVE / SPAM) → **gom nhóm bug với
  canonical topic** (gom chủ đề tương đồng) → gán severity Critical/Medium/Low theo số mention.
- **Dashboard**: gallery app có sẵn (chọn là xem ngay), chuyển app tức thì, thẻ tiến độ
  phân tích, 4 thẻ tổng quan, donut + bar chart, **bug to-do** (filter severity/status,
  Mark Done, click xem sample review), review explorer.
- **Đa app**: lưu cache theo từng app, theo dõi nhiều app, sync lại mỗi giờ (incremental, dedup).
- **Pre-seed**: 13 app phổ biến (Zalo, Zalopay, Zing MP3, ZingPlay, Phong Thần VNG,
  VLTK Mobile, CookieRun...) được cào sẵn và bundle vào image → demo có dữ liệu ngay.

## Kiến trúc

Một Flask app (port 8080) phục vụ dashboard tĩnh + REST API + một thread chạy pipeline
mỗi giờ. State đi qua lớp `storage` trừu tượng với 2 backend: **LocalStore** (file JSON,
mặc định) và **MemoryStore** (AgentBase Memory). Lúc khởi động, dữ liệu seed được nạp vào
store qua `bootstrap`.

| File | Vai trò |
|---|---|
| `app.py` | Flask routes (`/health`, `/`, `/api/*`, `/run`) + scheduler + bootstrap |
| `pipeline.py` | Orchestrate: scrape → classify → canonicalize → group; dedup, run-lock, status |
| `scraper.py` / `scraper_live.py` | resolve_app (fuzzy) + scrape GP/AS (error-safe, retry) |
| `classifier.py` | Phân loại review theo batch qua LLM, fallback SPAM |
| `canonicalize.py` | Gom chủ đề bug về nhãn chuẩn bằng LLM |
| `grouper.py` | Gom nhóm bug + severity + merge giữ trạng thái |
| `storage.py` | `Store` (LocalStore/MemoryStore) + app `Registry`, partition theo app_id |
| `seed.py` / `regroup_seed.py` | Cào sẵn + re-group danh sách app vào `seed/` |
| `dashboard/index.html` | Dashboard self-contained (vanilla JS + Chart.js) |

## Chạy local

```bash
cd review-radar
python -m venv .venv && .venv/Scripts/activate   # (Windows: .venv\Scripts\Activate.ps1)
pip install -r requirements.txt
cp .env.example .env        # điền OPENAI_API_KEY / OPENAI_BASE_URL / MODEL_NAME
python app.py               # mở http://localhost:8080
```

Biến môi trường (xem `.env.example`): `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `MODEL_NAME`,
`REVIEW_LIMIT` (mặc định 500), `STORE_BACKEND` (`local`|`memory`), `MEMORY_ID`.

LLM dùng endpoint OpenAI-compatible của GreenNode AI Platform
(`https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1`), model mặc định `minimax/minimax-m2.5`.

## Test

```bash
cd review-radar && python -m pytest -q     # 58 tests
```

## Docker / Deploy

```bash
docker build -t review-radar review-radar
docker run -p 8080:8080 --env-file review-radar/.env review-radar
```

Deploy lên GreenNode AgentBase Runtime ở chế độ **PUBLIC always-on**, port 8080,
health check `GET /health`. Seed được bundle trong image; `STORE_BACKEND=local`.

## Tài liệu

- Spec: [`docs/superpowers/specs/2026-06-11-review-radar-design.md`](docs/superpowers/specs/2026-06-11-review-radar-design.md)
- Plan: [`docs/superpowers/plans/2026-06-11-review-radar.md`](docs/superpowers/plans/2026-06-11-review-radar.md)
