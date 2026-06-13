# Review Radar - AI Agent Phân Tích Review Ứng Dụng

## Tổng Quan

Review Radar giúp team product và engineering nhanh chóng hiểu người dùng đang
gặp vấn đề gì khi sử dụng mobile app.

Bình thường, một ứng dụng có thể có hàng trăm review mới. Nếu đọc thủ công, team
rất dễ bỏ sót lỗi quan trọng. Review Radar tự động thu thập review, dùng AI để
phân loại nội dung, gom các bug giống nhau thành nhóm, và đưa tất cả lên một
dashboard dễ theo dõi.

## Bài Toán Giải Quyết

Người dùng thường viết review theo nhiều cách khác nhau:

- "Không đăng nhập được"
- "Login Google bị lỗi"
- "Mở app lên cứ bắt đăng nhập lại"
- "Tài khoản không vào được"

Với người đọc, đây có thể là cùng một vấn đề. Review Radar cũng cố gắng hiểu
theo cách đó và gom các câu trên thành một bug topic như:

```text
Lỗi đăng nhập
```

Sau đó hệ thống tính số lượt nhắc tới bug này để xếp mức độ ưu tiên.

## Input Và Output

**Input:** tên ứng dụng, ví dụ `Zalo`, `ZaloPay`, `Phong Thần VNG`.

**Output:**

- Dashboard tổng quan về review.
- Các nhóm bug đang được người dùng báo cáo.
- Danh sách action items cho team xử lý.
- Bảng review chi tiết để kiểm tra nội dung gốc.
- Trang tiến độ khi hệ thống đang crawl/phân tích review mới.

## Flow Hoạt Động

```text
1. User nhập tên app
        |
        v
2. Hệ thống tìm ứng viên trên App Store và Google Play
        |
        v
3. User chọn đúng app cần theo dõi
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
9. Dashboard cập nhật số liệu, biểu đồ, action items
```

## Các Loại Review

AI phân loại review thành 5 nhóm:

| Label | Ý nghĩa |
|---|---|
| `BUG_REPORT` | Người dùng báo lỗi cụ thể |
| `FEATURE_REQUEST` | Người dùng đề xuất tính năng |
| `COMPLAINT` | Phàn nàn về trải nghiệm, hiệu năng, UX |
| `POSITIVE` | Phản hồi tích cực |
| `SPAM` | Review quá ngắn, vô nghĩa, rác |

## Cách Tính Severity

Severity dựa trên số review cùng nhắc tới một vấn đề:

| Severity | Điều kiện | Ý nghĩa |
|---|---:|---|
| Critical | 10+ mentions | Nhiều người gặp, cần ưu tiên cao |
| Medium | 3-9 mentions | Đang xuất hiện lặp lại, cần theo dõi |
| Low | 1-2 mentions | Ít người báo cáo, ưu tiên thấp hơn |

## Dashboard Hiện Tại

Dashboard hiện có các khu vực:

- **App selection:** tìm app mới hoặc mở app đã có dữ liệu.
- **Currently scraping:** xem app nào đang được crawl.
- **Crawling screen:** hiển thị tiến độ xử lý review.
- **Overview:** KPI, phân loại review, trend, action items.
- **Actions:** danh sách bug/action items.
- **Reviews:** bảng review chi tiết có filter.
- **Reports / Settings / Team / Compare:** UI demo hoặc future features.

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
  +-- Local JSON khi dev
  +-- AgentBase Memory khi deploy
```

## Multi-App

Phiên bản hiện tại hỗ trợ nhiều app.

Mỗi app có data riêng:

```text
data/apps/<app_id>/
  config.json
  processed_ids.json
  reviews.json
  todos.json
  meta.json
```

`registry.json` lưu danh sách app đã theo dõi và app đang active.

Điều này giúp dashboard mở từng app mà không bị lẫn dữ liệu giữa các app.

## Seed Data Để Demo

Repo có thư mục `review-radar/seed/` gồm 13 app đã được crawl và phân tích sẵn.

Khi ứng dụng khởi động lần đầu và store còn trống, seed data sẽ được copy vào
store. Nhờ vậy dashboard có dữ liệu ngay khi demo, kể cả khi live scraping chậm
hoặc bị store throttle.

## Những Phần Đã Chạy Thật

- Tìm app bằng fuzzy search.
- Track app mới.
- Crawl review App Store / Google Play.
- Deduplicate review đã xử lý.
- Gọi LLM để classify review.
- Gọi LLM để canonicalize bug topic.
- Group bug và tính severity.
- Lưu data theo từng app.
- Hiển thị dashboard bằng dữ liệu backend.
- Bootstrap seed data.
- Chạy test suite.

## Những Phần Đang Là Demo/Future UI

- Reports và scheduled reports.
- Team feedback persistence.
- Settings integrations.
- Compare metrics.
- Một số nút "mark fixed" trong frontend mới đổi local state, chưa phải tất cả
  đều gọi API backend.

## Tiêu Chí Demo

Demo nên cho thấy:

1. Mở dashboard có sẵn app từ seed data.
2. Tìm app mới bằng tên app.
3. Chọn app và xem màn hình crawl progress.
4. Mở dashboard app đã phân tích.
5. Xem bug/action items và review gốc.
6. Giải thích được cách AI gom review thành bug groups.
