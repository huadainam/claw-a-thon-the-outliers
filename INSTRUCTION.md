# INSTRUCTION: Build Review Radar Agent

## Mục tiêu

Xây dựng một AI agent tên **Review Radar** với chức năng:
- Nhận input là tên ứng dụng (ví dụ: `zalo`, `zalopay`, `võ lâm truyền kỳ`)
- Tự động scrape 1.000 review mới nhất từ **App Store** và **Google Play**
- Phân loại review bằng AI (tiếng Việt là chính)
- Hiển thị kết quả trên dashboard với bug to-do list
- Tự động cập nhật mỗi 1 giờ, chỉ xử lý review mới (incremental)

---

## Bước 1 — Tạo cấu trúc thư mục

Tạo cấu trúc folder như sau trong thư mục hiện tại:

```
review-radar/
├── main.py                  # Entry point — chạy toàn bộ pipeline
├── scraper.py               # Scrape review từ App Store & Google Play
├── classifier.py            # Gọi AI phân loại review
├── grouper.py               # Gom nhóm bug report theo chủ đề
├── storage.py               # Đọc/ghi state (review đã xử lý, to-do list)
├── scheduler.py             # Chạy pipeline mỗi 1 giờ
├── dashboard/
│   └── index.html           # Dashboard self-contained (HTML + CSS + JS)
├── data/
│   ├── processed_ids.json   # Lưu review_id đã xử lý (deduplication)
│   ├── reviews.json         # Review đã phân loại
│   └── todos.json           # Bug to-do list
├── requirements.txt
└── .env                     # API keys (không commit lên GitHub)
```

---

## Bước 2 — Cài đặt dependencies

Tạo file `requirements.txt` với nội dung:

```
google-play-scraper
app-store-scraper
openai
python-dotenv
schedule
flask
```

Chạy: `pip install -r requirements.txt`

---

## Bước 3 — Viết `scraper.py`

File này có 2 hàm chính:

### `scrape_google_play(app_name: str) -> list[dict]`
- Dùng thư viện `google_play_scraper` để search app theo tên, lấy `app_id` đầu tiên tìm được
- Scrape 1.000 review mới nhất bằng `reviews()` với `count=1000`, `sort=Sort.NEWEST`, `lang='vi'`, `country='vn'`
- Mỗi review trả về dict gồm: `id`, `userName`, `content`, `score`, `at` (datetime), `source='google_play'`

### `scrape_app_store(app_name: str) -> list[dict]`
- Dùng thư viện `app_store_scraper` với `country='vn'`
- Search app theo tên, lấy `app_id` đầu tiên
- Scrape 1.000 review mới nhất
- Mỗi review trả về dict gồm: `id`, `userName`, `content`, `score`, `at`, `source='app_store'`

**Lưu ý quan trọng:**
- Nếu không tìm được app trên một store, log warning và trả về list rỗng, không crash
- Wrap toàn bộ trong try/except, nếu lỗi thì trả về `[]`

---

## Bước 4 — Viết `storage.py`

File này quản lý đọc/ghi toàn bộ data vào thư mục `data/`.

### Các hàm cần có:

```python
def load_processed_ids() -> set[str]
    # Đọc data/processed_ids.json, trả về set các review_id đã xử lý

def save_processed_ids(ids: set[str])
    # Ghi set ids vào data/processed_ids.json

def load_reviews() -> list[dict]
    # Đọc data/reviews.json

def append_reviews(new_reviews: list[dict])
    # Append reviews mới vào data/reviews.json (không ghi đè)

def load_todos() -> list[dict]
    # Đọc data/todos.json

def save_todos(todos: list[dict])
    # Ghi data/todos.json

def load_app_name() -> str
    # Đọc tên app đang theo dõi từ data/config.json

def save_app_name(app_name: str)
    # Lưu tên app vào data/config.json
```

---

## Bước 5 — Viết `classifier.py`

File này gọi LLM để phân loại review.

### Cấu hình
- Dùng OpenAI-compatible API (đọc `OPENAI_API_KEY` và `OPENAI_BASE_URL` từ `.env`)
- Model: đọc từ biến môi trường `MODEL_NAME`, mặc định là `gpt-4o-mini`

### Hàm `classify_reviews(reviews: list[dict]) -> list[dict]`

Xử lý theo batch 30 review/lần để tiết kiệm API call.

Với mỗi batch, gửi prompt sau:

```
Bạn là chuyên gia phân tích review ứng dụng mobile. Phân loại từng review dưới đây.

Các loại phân loại:
- BUG_REPORT: user báo lỗi, crash, tính năng không hoạt động
- FEATURE_REQUEST: user đề xuất tính năng mới
- COMPLAINT: phàn nàn về UX, tốc độ, thiết kế nhưng không phải bug cụ thể
- POSITIVE: review tích cực, khen ngợi
- SPAM: review rác, quá ngắn (<5 từ), chỉ emoji, vô nghĩa

Trả về JSON array với đúng thứ tự input, mỗi item gồm:
{
  "id": "<review_id>",
  "label": "<BUG_REPORT|FEATURE_REQUEST|COMPLAINT|POSITIVE|SPAM>",
  "bug_topic": "<mô tả ngắn chủ đề bug bằng tiếng Việt, chỉ điền nếu label=BUG_REPORT, còn lại để null>",
  "confidence": <0.0 đến 1.0>
}

Reviews:
[danh sách review dạng JSON]
```

- Parse JSON response, merge kết quả vào từng review dict gốc
- Nếu parse lỗi → label mặc định là `SPAM`, confidence `0.0`
- Trả về list review đã có thêm field `label`, `bug_topic`, `confidence`

---

## Bước 6 — Viết `grouper.py`

File này gom nhóm các BUG_REPORT theo chủ đề.

### Hàm `group_bugs(reviews: list[dict]) -> list[dict]`

1. Lọc chỉ lấy review có `label == 'BUG_REPORT'`
2. Gom nhóm theo `bug_topic` (dùng so sánh string đơn giản hoặc gọi LLM để merge topic tương đồng)
3. Với mỗi nhóm, tính `mention_count` = số review trong nhóm
4. Gán `severity` dựa trên `mention_count`:
   - `mention_count >= 10` → `"critical"`
   - `mention_count >= 3` → `"medium"`
   - `mention_count < 3` → `"low"`
5. Trả về list bug group, mỗi item gồm:

```json
{
  "id": "<uuid>",
  "topic": "<tên chủ đề bug>",
  "severity": "critical|medium|low",
  "mention_count": 12,
  "sample_reviews": ["<nội dung review 1>", "<nội dung review 2>", "<nội dung review 3>"],
  "sources": ["google_play", "app_store"],
  "first_seen": "<ISO datetime>",
  "last_seen": "<ISO datetime>",
  "status": "open"
}
```

### Hàm `merge_with_existing_todos(new_groups: list[dict], existing_todos: list[dict]) -> list[dict]`

- Với mỗi `new_group`, tìm trong `existing_todos` item có `topic` giống (so sánh case-insensitive)
- Nếu tìm thấy → cập nhật `mention_count`, `last_seen`, `sample_reviews`, `severity` (có thể nâng lên)
- Nếu không tìm thấy → thêm mới vào list
- Giữ nguyên `status` của to-do cũ (không reset về `open` nếu đã `done`)
- Trả về list todos đã merge

---

## Bước 7 — Viết `main.py`

Entry point với 2 chế độ:

### Chế độ 1: Khởi tạo lần đầu
```
python main.py --app "zalo"
```
- Lưu app_name vào config
- Chạy full pipeline lần đầu
- Khởi động scheduler

### Chế độ 2: Chạy lại thủ công
```
python main.py --run
```
- Đọc app_name từ config
- Chạy pipeline một lần

### Pipeline chính `run_pipeline(app_name: str)`:

```python
def run_pipeline(app_name: str):
    # 1. Scrape reviews từ cả 2 store
    gp_reviews = scrape_google_play(app_name)
    as_reviews = scrape_app_store(app_name)
    all_reviews = gp_reviews + as_reviews

    # 2. Deduplication
    processed_ids = load_processed_ids()
    new_reviews = [r for r in all_reviews if r['id'] not in processed_ids]
    if not new_reviews:
        print("Không có review mới.")
        return

    # 3. Classify
    classified = classify_reviews(new_reviews)

    # 4. Lưu reviews đã phân loại
    append_reviews(classified)
    new_ids = {r['id'] for r in classified}
    save_processed_ids(processed_ids | new_ids)

    # 5. Group bugs và merge với todos hiện có
    all_classified = load_reviews()
    bug_groups = group_bugs(all_classified)
    existing_todos = load_todos()
    updated_todos = merge_with_existing_todos(bug_groups, existing_todos)
    save_todos(updated_todos)

    # 6. Cập nhật dashboard data
    update_dashboard_data()

    print(f"Xong. Xử lý {len(new_reviews)} review mới, {len(updated_todos)} bug groups.")
```

---

## Bước 8 — Viết `scheduler.py`

```python
import schedule, time
from main import run_pipeline
from storage import load_app_name

def start_scheduler():
    app_name = load_app_name()
    schedule.every(1).hours.do(run_pipeline, app_name=app_name)
    print(f"Scheduler started. Sẽ cập nhật mỗi 1 giờ cho app: {app_name}")
    while True:
        schedule.run_pending()
        time.sleep(60)
```

---

## Bước 9 — Viết Dashboard (`dashboard/index.html`)

Tạo một file HTML **self-contained** (không cần server, mở trực tiếp bằng trình duyệt được).

Dashboard đọc data từ `../data/reviews.json` và `../data/todos.json` qua fetch API (hoặc inline data nếu cần).

### Yêu cầu giao diện:

**Phần 1 — Header**
- Tên app đang theo dõi
- Timestamp cập nhật gần nhất
- Nút "Refresh Data"

**Phần 2 — Overview Cards (4 card)**
- Tổng review đã xử lý
- Số bug report (open)
- Số bug critical
- Số bug đã resolve (done)

**Phần 3 — Biểu đồ**
- Biểu đồ tròn (donut chart): phân bố các label (Bug / Feature / Complaint / Positive / Spam)
- Biểu đồ cột: số bug report theo ngày (7 ngày gần nhất)
- Dùng Chart.js từ CDN: `https://cdn.jsdelivr.net/npm/chart.js`

**Phần 4 — Bug To-Do List**

Bảng với các cột: `Severity | Chủ đề | Số mention | Nguồn | Lần cuối gặp | Trạng thái | Hành động`

- Filter bar phía trên: All / Critical / Medium / Low | All / Open / Done
- Severity hiển thị bằng badge màu: 🔴 Critical, 🟡 Medium, 🟢 Low
- Cột Trạng thái: badge `Open` (đỏ) hoặc `Done` (xanh)
- Cột Hành động: nút **"Mark Done"** (nếu Open) hoặc **"Reopen"** (nếu Done)
- Click vào row → expand hiện 3 sample reviews gốc
- Khi click Mark Done / Reopen → cập nhật `todos.json` qua fetch POST đến Flask server

**Phần 5 — Review Explorer**
- Bảng danh sách review với cột: `Nguồn | Rating | Label | Nội dung | Ngày`
- Filter theo: Label, Rating (1–5), Nguồn (App Store / Google Play)
- Pagination: 20 review/trang

### Yêu cầu kỹ thuật dashboard:
- Màu chủ đạo: xanh lá (#22c55e) và trắng/xám tối
- Font: Inter hoặc system font
- Responsive, hiển thị tốt trên màn hình 1280px+
- Không dùng localStorage, state lưu trong biến JS

---

## Bước 10 — Viết Flask API nhỏ để dashboard gọi

Thêm file `api.py`:

```python
from flask import Flask, jsonify, request
from storage import load_todos, save_todos, load_reviews, load_app_name
import json

app = Flask(__name__, static_folder='dashboard', static_url_path='')

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/todos', methods=['GET'])
def get_todos():
    return jsonify(load_todos())

@app.route('/api/todos/<todo_id>', methods=['PATCH'])
def update_todo(todo_id):
    data = request.json
    todos = load_todos()
    for todo in todos:
        if todo['id'] == todo_id:
            todo['status'] = data.get('status', todo['status'])
    save_todos(todos)
    return jsonify({'ok': True})

@app.route('/api/reviews', methods=['GET'])
def get_reviews():
    return jsonify(load_reviews())

@app.route('/api/stats', methods=['GET'])
def get_stats():
    reviews = load_reviews()
    from collections import Counter
    label_counts = Counter(r.get('label') for r in reviews)
    return jsonify({
        'app_name': load_app_name(),
        'total': len(reviews),
        'by_label': dict(label_counts)
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
```

Cập nhật `main.py` để chạy cả Flask server và scheduler trong 2 thread riêng biệt.

---

## Bước 11 — Tạo file `.env`

```
OPENAI_API_KEY=<API key của GreenNode AI Platform>
OPENAI_BASE_URL=<Base URL của GreenNode — xem trong portal>
MODEL_NAME=<tên model muốn dùng>
```

**Lưu ý:** Thêm `.env` vào `.gitignore`, không commit key lên GitHub.

---

## Bước 12 — Tạo `Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["python", "main.py", "--serve"]
```

Thêm flag `--serve` vào `main.py`: khởi động Flask server + scheduler (dùng threading).

---

## Bước 13 — Test toàn bộ flow

Chạy theo thứ tự:

```bash
# 1. Test scraper
python -c "from scraper import scrape_google_play; print(scrape_google_play('zalo')[:2])"

# 2. Test classifier với 5 review mẫu
python -c "
from classifier import classify_reviews
samples = [
    {'id': '1', 'content': 'App bị crash hoài khi mở ảnh', 'score': 1},
    {'id': '2', 'content': 'Rất tốt, dùng mượt', 'score': 5},
    {'id': '3', 'content': 'ok', 'score': 3},
]
print(classify_reviews(samples))
"

# 3. Chạy full pipeline
python main.py --app "zalo"

# 4. Mở dashboard
# Truy cập http://localhost:8080
```

---

## Lưu ý cuối

- **Credentials AgentBase**: Sau khi build xong local, import bộ skill AgentBase vào cùng folder → chạy step 1 (add credential) → dừng lại build xong → chạy tiếp để deploy
- **Public endpoint**: Khi deploy lên AgentBase Runtime, đảm bảo chuyển endpoint sang public (không để localhost)
- **GitHub repo**: Phải public trước deadline nộp bài 17/06/2026 12:00
- **Video demo**: Quay màn hình thao tác: nhập app name → chờ pipeline chạy → xem dashboard → mark done 1 bug
