# Review Radar - AI Agent Phân Tích Review Ứng Dụng

## Tổng Quan

Review Radar giúp team product và engineering nhanh chóng hiểu người dùng đang
gặp vấn đề gì khi sử dụng mobile app. Thay vì đọc thủ công hàng trăm review mới,
hệ thống tự thu thập review, dùng AI để phân loại, gom các bug giống nhau thành
nhóm, tính mức độ ưu tiên và hiển thị trên dashboard.

## Bài Toán Giải Quyết

Người dùng thường mô tả cùng một lỗi bằng nhiều cách:

- "Không đăng nhập được"
- "Login Google bị lỗi"
- "Mở app lên cứ bắt đăng nhập lại"
- "Tài khoản không vào được"

Review Radar cố gắng nhận ra đây là cùng một vấn đề và gom về một bug topic như:

```text
Lỗi đăng nhập
```

Sau đó hệ thống đếm số review nhắc tới bug này để xếp mức độ ưu tiên.

## Input Và Output

**Input:** tên ứng dụng, ví dụ `Zalo`, `ZaloPay`, `Phong Thần VNG`.

**Output:**

- Dashboard tổng quan về review.
- KPI theo khoảng ngày 7/30/90 ngày.
- Các nhóm bug đang được người dùng báo cáo.
- Danh sách action items cho team xử lý.
- Bảng review chi tiết để đọc nội dung gốc.
- Màn hình tiến độ khi hệ thống crawl/phân tích review mới.
- Compare view giúp đối chiếu các app đã track.
- Team feedback view có persist dữ liệu.

## Flow Hoạt Động

```text
1. User nhập tên app
        |
        v
2. Hệ thống tìm ứng viên trên App Store và Google Play
        |
        v
3. User chọn app cần theo dõi
        |
        v
4. Hệ thống lấy review mới từ store
        |
        v
5. Review đã xử lý trước đó được bỏ qua
        |
        v
6. AI phân loại từng review
        |
        v
7. AI gom các chủ đề bug tương tự về một tên chuẩn
        |
        v
8. Hệ thống tạo bug groups và tính severity
        |
        v
9. Dashboard cập nhật KPI, biểu đồ, action items và review detail
```

## Các Loại Review

| Label | Ý nghĩa |
|---|---|
| `BUG_REPORT` | Người dùng báo lỗi cụ thể |
| `FEATURE_REQUEST` | Người dùng đề xuất tính năng |
| `COMPLAINT` | Phàn nàn về trải nghiệm, hiệu năng, UX |
| `POSITIVE` | Phản hồi tích cực |
| `SPAM` | Review quá ngắn, vô nghĩa, rác |

## Cách Tính Severity

| Severity | Điều kiện | Ý nghĩa |
|---|---:|---|
| Critical | 10+ mentions | Nhiều người gặp, cần ưu tiên cao |
| Medium | 3-9 mentions | Đang xuất hiện lặp lại, cần theo dõi |
| Low | 1-2 mentions | Ít người báo cáo, ưu tiên thấp hơn |

## Dashboard Hiện Tại

Dashboard có các khu vực:

- **App selection:** tìm app mới hoặc mở app đã có dữ liệu.
- **Currently scraping:** xem app đang queued/analyzing và có thể cancel.
- **Crawling screen:** hiển thị tiến độ xử lý review.
- **Overview:** KPI, phân loại review, trend, action items.
- **Date range:** `7N / 30N / 90N` áp dụng cho KPI, category, trend, actions và
  reviews của dashboard.
- **Actions:** danh sách bug/action items và status update.
- **Reviews:** bảng review chi tiết có filter.
- **Compare Apps:** so sánh nhiều app bằng dữ liệu backend thật.
- **Team:** feedback form và recent feedback persist qua API.
- **Reports / Settings integrations / Export compare:** UI cho phase tiếp theo.

## Kiến Trúc Hệ Thống

Ứng dụng là một Flask server chạy ở port `8080`.

```text
Browser
  |
  v
React dashboard
  |
  v
Flask REST API
  |
  v
Pipeline xử lý review
  |
  +-- Scraper
  +-- LLM classifier
  +-- Topic canonicalizer
  +-- Bug grouper
  |
  v
Storage
  +-- Local JSON khi dev offline
  +-- AgentBase Memory khi deploy/test chung
```

## Multi-App Và Storage

Phiên bản hiện tại hỗ trợ nhiều app. Mỗi app có data riêng:

```text
data/apps/<app_id>/
  config.json
  processed_ids.json
  reviews.json
  todos.json
  meta.json
```

`registry.json` hoặc Memory registry lưu danh sách app đã theo dõi và app đang
active. Khi test local với CSDL server của team, dùng `STORE_BACKEND=memory` và
`MEMORY_ID` trong `.env`. `STORE_BACKEND=local` chỉ dùng khi cần chạy offline.

## Seed Data Để Demo

Repo có `review-radar/seed/` gồm các app đã crawl và phân tích sẵn. Khi ứng dụng
khởi động lần đầu và store còn trống, seed data sẽ được copy vào store đang dùng.
Nhờ vậy dashboard có dữ liệu ngay khi demo, kể cả khi live scraping chậm hoặc bị
store throttle.

## Những Phần Đã Chạy Thật

- Tìm app bằng fuzzy search.
- Track app mới.
- Crawl review App Store / Google Play.
- Deduplicate review đã xử lý.
- Gọi LLM để classify review.
- Gọi LLM để canonicalize bug topic.
- Group bug và tính severity.
- Lưu data theo từng app.
- Dashboard overview đọc data backend.
- Date range filter cho KPI/chart/actions/reviews.
- Action item status update qua API.
- Compare Apps đọc dữ liệu backend thật.
- Team feedback persist qua API.
- Bootstrap seed data.
- Hourly refresh scheduler.
- Cancel queued/running crawl.
- Test suite.

## Những Phần Còn Là Future UI

- Reports và scheduled reports.
- Settings integrations.
- Export comparison.
- Một nút `Mark as Fixed` trong review detail chưa phải luồng persist chính; luồng
  persist hiện dùng status menu trên action row.

## Tiêu Chí Demo

Demo nên cho thấy:

1. Mở dashboard có sẵn app từ seed hoặc Memory.
2. Tìm app mới bằng tên app.
3. Chọn app và xem crawl progress.
4. Đổi date range 7/30/90 và thấy KPI/chart/actions/reviews thay đổi theo.
5. Xem bug/action items và review gốc.
6. Cập nhật status của action item.
7. So sánh nhiều app trong Compare Apps.
8. Gửi feedback và thấy feedback được lưu lại.
9. Giải thích được cách AI gom review thành bug groups.
