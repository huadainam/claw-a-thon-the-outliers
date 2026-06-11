# Review Radar — AI Agent tự động phân tích review ứng dụng

## Tổng quan

**Review Radar** là một AI agent nhận vào tên ứng dụng bất kỳ (Zalo, ZaloPay, Võ Lâm Truyền Kỳ,...), tự động cào 1.000 review mới nhất từ cả App Store và Google Play, phân loại review bằng AI (tập trung tiếng Việt), gom nhóm các bug report, và hiển thị toàn bộ kết quả trên một dashboard thống nhất kèm to-do list quản lý bug. Agent tự cập nhật mỗi 1 giờ để không bỏ sót review mới.

---

## Vấn đề giải quyết

Các team product/dev thường nhận hàng trăm review mỗi ngày nhưng không có công cụ tự động nào giúp họ:
- Lọc ra review thực sự có giá trị trong đống review rác
- Phát hiện nhanh các bug đang được user báo cáo
- Theo dõi tình trạng xử lý bug theo thời gian

Review Radar giải quyết toàn bộ vòng lặp này mà không cần dev/PM ngồi đọc thủ công.

---

## Input / Output

**Input:** Tên ứng dụng (ví dụ: `zalo`, `zalopay`, `võ lâm truyền kỳ`)

**Output:**
- Dashboard tổng quan với biểu đồ phân loại review
- To-do list các bug report với severity và trạng thái xử lý
- Tự động append review mới mỗi 1 giờ

---

## Luồng xử lý (Agent Flow)

```
User nhập app name
        ↓
Tìm kiếm app ID trên App Store & Google Play
        ↓
Scrape 1.000 review mới nhất từ mỗi nền tảng (tổng ~2.000 review)
        ↓
Deduplication — loại bỏ review đã xử lý trước đó (theo review ID)
        ↓
Filter review rác (quá ngắn, chỉ có emoji, không nội dung)
        ↓
Phân loại từng review bằng AI (tiếng Việt + tiếng Anh):
  • Bug Report
  • Feature Request  
  • Complaint (UX/performance)
  • Positive Feedback
  • Spam / Rác
        ↓
Gom nhóm Bug Report theo chủ đề (crash, lỗi login, lỗi thanh toán,...)
        ↓
Gắn Severity cho từng nhóm bug:
  • Critical — nhiều user báo cáo (≥10 mention)
  • Medium — vài user báo cáo (3–9 mention)
  • Low — ít báo cáo (<3 mention)
        ↓
Tạo to-do item cho mỗi nhóm bug → đổ vào Dashboard
        ↓
Lưu trạng thái vào AgentBase Memory
```

---

## Tính năng Dashboard

### Tổng quan (Overview)
- Tổng số review đã xử lý
- Biểu đồ tròn phân loại review (Bug / Feature Request / Complaint / Positive / Spam)
- Biểu đồ trend theo thời gian (số bug report tuần này vs tuần trước)
- Timestamp cập nhật gần nhất

### Bug To-Do List
| Nhóm bug | Severity | Số mention | Trạng thái | Hành động |
|---|---|---|---|---|
| Lỗi đăng nhập Google | 🔴 Critical | 24 | Open | Mark Done |
| App crash khi mở camera | 🔴 Critical | 15 | Open | Mark Done |
| Giao diện lỗi trên iOS 17 | 🟡 Medium | 7 | In Progress | Mark Done |
| Thông báo không hiện | 🟢 Low | 2 | Done | ✓ |

- Mỗi to-do item có thể click để xem sample review gốc
- Có thể filter theo severity, trạng thái, nền tảng (App Store / Google Play)
- **Mark Done** → cập nhật trạng thái, item không bị xóa để giữ lịch sử

### Review Explorer
- Xem danh sách review thô đã phân loại
- Filter theo: loại, rating (1–5 sao), nền tảng, ngày
- Highlight keyword AI đánh dấu

---

## Cơ chế cập nhật tự động (Hourly Sync)

- Mỗi 1 giờ, agent chạy lại pipeline scrape cho app đang theo dõi
- So sánh review ID với batch đã xử lý → chỉ xử lý review **mới** (incremental)
- Nếu review mới tạo ra bug group trùng với group đã có → merge vào group cũ, cập nhật mention count
- Nếu mention count vượt ngưỡng → tự động nâng severity (Low → Medium → Critical)
- Dashboard tự refresh, không cần user thao tác thêm

---

## Tech Stack dự kiến

| Layer | Công nghệ |
|---|---|
| Scraping | `google-play-scraper` (Python/Node), iTunes RSS / `app-store-scraper` |
| AI Classification | GreenNode AI Platform — LLM (Claude / model GreenNode cung cấp) |
| State / Memory | AgentBase Memory module |
| Backend / Orchestration | Python, chạy qua AgentBase Runtime |
| Frontend Dashboard | HTML/CSS/JS thuần hoặc React — self-contained |
| Deployment | Docker → AgentBase (GreenNode) |
| Source Control | GitHub (public repo) |

---

## Các điểm kỹ thuật cần lưu ý

### Scraping
- Giới hạn 1.000 review mới nhất mỗi nền tảng (2.000 tổng) để tránh timeout và tốn credit
- Lưu `review_id` sau mỗi lần xử lý → dùng để dedup lần sau
- Test scraping ngay ngày đầu để biết rate limit thực tế

### AI Classification
- Prompt phải handle tốt tiếng Việt (review thuần Việt, teen code, viết tắt)
- Batch classification để tiết kiệm API call (gửi 20–50 review/request thay vì từng cái)
- Dùng structured output (JSON) để parse kết quả ổn định

### Dashboard
- File HTML self-contained, không phụ thuộc external service
- State (trạng thái to-do) lưu trong AgentBase Memory, không dùng localStorage
- Endpoint public để share được (tránh lỗi localhost khi demo)

### Deduplication & Merge Logic
- Primary key: `review_id` từ store
- Bug group key: hash của chủ đề (để merge tự động khi có mention mới)

---

## Scope cho 7 ngày

| Ưu tiên | Tính năng |
|---|---|
| ✅ Must have | Scrape → Classify → Dashboard + Bug To-Do List |
| ✅ Must have | Deduplication, hourly sync |
| ✅ Must have | Mark Done, filter theo severity |
| 🔄 Should have | Trend chart theo thời gian |
| 🔄 Should have | Click vào bug để xem review gốc |
| ⭐ Nice to have | Export to-do list ra CSV/Notion |
| ⭐ Nice to have | Hỗ trợ theo dõi nhiều app cùng lúc |

---

## Tiêu chí thành công (Demo)

1. Nhập `zalo` → agent tìm được app trên cả 2 store
2. Dashboard hiện đúng phân loại review, bug list với severity
3. Mark một bug là Done → trạng thái cập nhật
4. Chạy lại sau 1 giờ → review mới được append, không bị duplicate
5. Link agent public, ai cũng truy cập được
