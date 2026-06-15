/* ============ Mock data + i18n for Review Radar ============ */
(function () {
  // ---------- App glyph specs — pre-seeded for known VN apps ----------
  // The api-bridge.js will add real tracked apps dynamically.
  // Set `logo` to an image path/URL to swap in the actual app icon.
  var APPS = {
    zalo:    { id:"zalo",    name:"Zalo",     logo:"", glyph:"Z",  grad:["#0a8cff","#0068e1"], publisher:"VNG Corporation",      platform:"App Store" },
    zalopay: { id:"zalopay", name:"ZaloPay",  logo:"", glyph:"Zp", grad:["#0096ff","#0057d8"], publisher:"VNG / Zion",          platform:"Google Play" },
    momo:    { id:"momo",    name:"MoMo",     logo:"", glyph:"M",  grad:["#d6246e","#a01259"], publisher:"M_Service JSC",       platform:"App Store" },
    shopee:  { id:"shopee",  name:"Shopee",   logo:"", glyph:"S",  grad:["#ff6a2c","#ee4d2d"], publisher:"Shopee Mobile",       platform:"Google Play" },
    grab:    { id:"grab",    name:"Grab",     logo:"", glyph:"G",  grad:["#22c55e","#00b14f"], publisher:"Grab Holdings",       platform:"App Store" },
    tiki:    { id:"tiki",    name:"Tiki",     logo:"", glyph:"T",  grad:["#4a9bff","#1a76e8"], publisher:"Tiki Corporation",    platform:"Google Play" },
    vietcombank:{ id:"vietcombank", name:"VCB Digibank", logo:"", glyph:"V", grad:["#1aa64b","#0a7d36"], publisher:"Vietcombank", platform:"App Store" },
  };

  // ---------- Available apps — populated dynamically by api-bridge.js ----------
  var AVAILABLE = [];

  // ---------- Suggested matches (fallback for offline mode) ----------
  var SUGGESTIONS = [
    { app:"zalopay", score:98 },
    { app:"zalo",    score:91 },
    { app:"momo",    score:64 },
    { app:"vietcombank", score:52 },
  ];

  // ---------- Dashboard KPIs — overridden by api-bridge.js when real data loads ----------
  var KPIS = [
    { id:"total",    value:"—", raw:0,  icon:"reviews",  trend:null, sub:"all_time",      tone:"neutral" },
    { id:"latest",   value:"—", raw:0,  icon:"calendar", trend:null, sub:"source_latest_day", tone:"neutral" },
    { id:"critical", value:"—", raw:0,  icon:"alert",    trend:null, sub:"need_fix",      tone:"critical", invert:true },
    { id:"fixed",    value:"—", raw:0,  icon:"check",    trend:null, sub:"last_30d",      tone:"positive" },
    { id:"pending",  value:"—", raw:0,  icon:"flag",     trend:null, sub:"action_items",  tone:"warning", invert:true },
    { id:"health",   value:"—", raw:0,  icon:"heart",    trend:null, sub:"out_of_100",    tone:"positive", suffix:"/100" },
  ];

  // ---------- Category breakdown — populated by api-bridge.js ----------
  var CATEGORIES = [];

  // ---------- Trend — populated by api-bridge.js from real review rows ----------
  var TREND = [];

  // ---------- Priority / action items — overridden by api-bridge.js ----------
  var ACTIONS = [];

  // ---------- Review detail rows — overridden by api-bridge.js ----------
  var REVIEWS = [];

  // ---------- Latest source-store review day — populated by api-bridge.js ----------
  var SOURCE_DATE = { key:"", count:0, cutoffKey:"" };

  // ---------- i18n ----------
  var I18N = {
    en: {
      brand_sub:"Review Intelligence",
      nav_monitor:"Monitor", nav_apps:"Available Apps", nav_actions:"Action Items", nav_reports:"Reports", nav_settings:"Settings",
      nav_overview:"Overview", nav_reviews:"Reviews", all_apps:"All apps", sb_this_app:"This app",
      nav_section_main:"Workspace", nav_section_account:"Account",
      user_name:"The Outlier", user_role:"Product Owner",
      s1_eyebrow:"DAILY REVIEW INTELLIGENCE",
      s1_title:"Track app store reviews every day", s1_subtitle:"Enter an app name to quickly see new reviews, user sentiment, and issues that need attention. Data comes from public store sources and may be delayed by 1+ day.",
      desktop_notice:"Optimized for desktop browsers",
      source_window_prefix:"Latest source data:",
      s1_placeholder:"Enter an app name, e.g. Zalopay, Shopee, Facebook...", s1_find:"Find app",
      review_count_label:"Number of reviews to analyze", review_count_note:"Selecting more reviews may make the first collection take longer. Store data is not realtime and may be delayed by 1+ day.",
      suggested:"Suggested Matches", suggested_sub:"Ranked by name similarity",
      similarity:"match", confirm:"Confirm", confirmed:"Confirmed",
      available:"Available Apps", available_sub:"Daily snapshots — open instantly", available_search_placeholder:"Search available apps…", available_no_results:"No matching apps", available_no_results_sub:"Try another app name, publisher, platform, refresh status, or app ID.", clear_search:"Clear search", refresh_filter_label:"Filter by refresh status", refresh_filter_all:"All", refresh_filter_on:"Refresh on", refresh_filter_off:"Refresh off",
      last_updated:"Snapshot updated", total_reviews:"reviews", open_dashboard:"Open dashboard", start_crawl:"Collect reviews", hourly_on:"Refresh: on", hourly_off:"Refresh: off", hourly_disabled_short:"Off", hourly_admin_contact:"Store review feeds can lag by 1+ day; contact admin to enable/disable refresh.",
      scraping_title:"Collecting snapshot", scraping_sub:"Store collection in progress — tap to view status", status_scraping:"Collecting", status_queued:"Waiting", queue_title:"Collection Queue", queue_sub:"Apps are processed one at a time to avoid rate limits. Waiting apps start automatically in order.", queue_position:"Queue position", queue_next:"runs after the app ahead finishes", queue_starting:"Preparing to start", view_status:"View status", toast_scrape_done:"Snapshot updated", toast_added:"Added", toast_crawled:"Fetched", toast_classified:"classified", toast_new_reviews:"new reviews", toast_no_new_reviews:"no new store reviews to classify", toast_no_reviews_fetched:"No new store reviews were available", toast_crawl_fallback:"No new store reviews fetched; refreshed from saved data", toast_crawl_error:"Collection ended with an error",
      health_healthy:"Healthy", health_warning:"Warning", health_critical:"Critical",
      loading_apps:"Loading available apps…", empty_title:"Start by searching an app", empty_sub:"Type an app name above and we'll find the closest matches across the App Store and Google Play.",
      searching:"Searching app stores…",
      min_ago:"m ago", hour_ago:"h ago",
      s2_eyebrow:"Preparing dashboard",
      s2_title:"Setting up daily intelligence for", s2_note:"Collecting a new app for the first time can take a few minutes. Store feeds may be delayed, so this snapshot may not include same-day reviews.",
      step_confirmed:"App confirmed", step_confirmed_d:"Source verified on App Store",
      step_crawling:"Collecting store reviews", step_crawling_d:"Reading the latest public store snapshot",
      step_categorizing:"Categorizing reviews", step_categorizing_d:"Classifying by topic, sentiment & priority",
      step_building:"Building dashboard", step_building_d:"Computing metrics and trends",
      est_time:"Estimated time", reviews_collected:"Reviews collected", current_step:"Current step",
      loading_dashboard:"Loading dashboard…", notify:"Notify me when ready", back_apps:"Back to available apps", cancel_crawl:"Stop & keep results", cancelling:"Stopping…", almost:"Almost there…", skip_now:"Open dashboard now", skip_hint:"Classification keeps running in the background — refresh later for the rest.", open_existing_dashboard:"Open existing dashboard", queued_existing_data:"Existing dashboard data is still available while this refresh waits.", existing_dashboard_hint:"This refresh continues in the background; the dashboard will update after it finishes.",
      platform_label:"Platform", last_crawled:"Snapshot refreshed", source_latest:"Data through", source_date_none:"No source cutoff yet", crawl_freq:"Refresh cadence", every_hour:"Every 1 hour",
      configure:"Configure schedule", date_range:"Last 30 days", date_7:"Last 7 days", date_30:"Last 30 days", date_90:"Last 90 days", date_custom:"Custom...", toggle_nav:"Collapse menu",
      every_30m:"Every 30 min", every_6h:"Every 6 hours", every_12h:"Every 12 hours", every_24h:"Daily",
      schedule_title:"Refresh schedule", schedule_sub:"Refresh cadence is managed by admins for this workspace.", schedule_admin_title:"Contact admin to change refresh",
      freq_label:"Refresh cadence", schedule_help:"Review snapshots are collected automatically on this schedule.",
      opt_section:"Options",
      opt_notify:"Email me when critical bugs appear", opt_notify_d:"Get notified after each refreshed snapshot.",
      opt_pause:"Pause crawling on weekends", opt_pause_d:"Saves crawl quota when traffic is low.",
      cancel:"Cancel", close:"Close", save_changes:"Save changes", schedule_saved:"Crawl schedule updated",
      filter_platform:"Platform", filter_category:"Category", filter_priority:"Priority", filter_sentiment:"Sentiment", all:"All",
      kpi_total:"Total Reviews", kpi_latest:"Reviews on Latest Source Day", kpi_critical:"Critical Bugs To Fix", kpi_fixed:"Bugs Fixed", kpi_pending:"Pending Action Items", kpi_health:"Review Health Score",
      sub_all_time:"All time", sub_source_latest_day:"latest data day", sub_need_fix:"Need urgent fix", sub_last_30d:"Last 30 days", sub_action_items:"Awaiting triage", sub_out_of_100:"Sentiment-weighted",
      cat_title:"Category Breakdown", cat_sub:"Share of reviews by topic", cat_total:"reviews",
      cat_bug:"Bug", cat_criticalbug:"Critical Bug", cat_feedback:"Feedback", cat_positive:"Positive", cat_negative:"Negative", cat_spam:"Spam", cat_feature:"Feature Request",
      trend_title:"Review Trend", trend_sub:"Daily volume & health score",
      r7:"7D", r30:"30D", r90:"90D", legend_reviews:"Reviews / day", legend_health:"Health score", trend_high:"Peak", trend_low:"Low",
      action_title:"Priority Action Items", action_sub:"Issues that need attention, ranked by impact",
      view_all:"View all", mark_fixed:"Mark as Fixed", assign:"Assign", view_reviews:"View Reviews",
      pri_critical:"Critical", pri_high:"High", pri_medium:"Medium", pri_low:"Low",
      flag_need_fix:"Need Fix", flag_need_reply:"Need Reply", flag_need_investigation:"Need Investigation", flag_spam_review:"Spam Review",
      st_open:"Open", st_in_progress:"In Progress", st_fixed:"Fixed", st_ignored:"Ignored",
      owner:"Owner", affecting:"affecting", reviews_word:"reviews", linked_reviews:"linked reviews",
      table_title:"Review Detail", table_sub:"Click a row to expand the full review",
      col_review:"Review", col_date:"Date", col_rating:"Rating", col_category:"Category", col_sentiment:"Sentiment", col_priority:"Priority", col_status:"Status", col_summary:"AI Summary",
      filtered_by:"Filtered by", clear_filter:"Clear",
      ai_summary:"AI Summary", detected_issue:"Detected Issue", suggested_action:"Suggested Action", original_review:"Original Review", metadata:"Metadata",
      meta_version:"App version", meta_device:"Device", meta_country:"Country", meta_platform:"Platform",
      create_ticket:"Create Ticket", ignore:"Ignore", reply_suggestion:"Reply Suggestion",
      sent_positive:"Positive", sent_negative:"Negative", sent_neutral:"Neutral",
      showing:"Showing", of:"of", rows_limit:"Rows",
      filter_status:"Status", filter_flag:"Action", filter_rating:"Rating", clear_all:"Clear filters", no_results:"No reviews match these filters.", no_actions:"No action items match these filters.",
      back_overview:"Overview", actions_page_sub:"All flagged issues for this app, ranked by impact.", reviews_page_sub:"Every crawled review, fully filterable.",
      reviews_for:"Reviews linked to", clear_context:"Show all reviews", open_count:"open",
      reports_sub:"Generate and schedule review reports for your team.", coming_soon:"Coming soon", future_note:"Planned for a future release.",
      delivery_title:"Delivery channels", delivery_sub:"Reports will be delivered to where your team already works.",
      ch_teams:"Microsoft Teams", ch_teams_d:"Post summaries to a Teams channel", ch_outlook:"Outlook email", ch_outlook_d:"Scheduled email to a distribution list", ch_download:"Download", ch_download_d:"Export as PDF anytime", available_badge:"Available",
      templates_title:"Report templates", templates_sub:"Start from a ready-made report", scheduled_title:"Scheduled reports", scheduled_sub:"Running automatically",
      generate:"Generate", export_pdf:"Export PDF", schedule_btn:"Schedule", recipients:"Recipients", report_format:"Format", run_freq:"Frequency", next_run:"Next run", new_report:"New report",
      tpl_weekly:"Weekly review summary", tpl_weekly_d:"Volume, sentiment and top issues from the past 7 days.",
      tpl_critical:"Critical bug report", tpl_critical_d:"All critical bugs and crash clusters needing a fix.",
      tpl_category:"Category breakdown", tpl_category_d:"Share of reviews by category with week-over-week change.",
      tpl_compare:"App comparison", tpl_compare_d:"Benchmark this app against others you monitor.",
      sch_exec:"Monthly executive summary", sch_weekly_bug:"Weekly critical-bug digest",
      settings_sub:"Manage your workspace, crawl defaults and integrations.", settings_admin_only:"Admin-only settings",
      set_general:"General", set_workspace_name:"Workspace name", set_default_lang:"Default language", set_timezone:"Time zone",
      set_crawl:"Crawl defaults", set_default_freq:"Default crawl frequency", set_autocat:"Auto-categorize new reviews", set_autocat_d:"Classify topic, sentiment and priority on ingest.", set_spam:"Auto-filter spam reviews", set_spam_d:"Hide reviews matching known spam patterns.",
      set_notif:"Notifications", set_team:"Team members", set_invite:"Invite member", set_integrations:"Integrations", set_api:"API access", set_api_d:"Use the REST API to pull review data into your own tools.", set_api_key:"API key", set_regenerate:"Regenerate", connect:"Connect", connected:"Connected", settings_saved:"Settings saved", role_admin:"Admin", role_editor:"Editor", role_viewer:"Viewer", role_admin_main:"Main admin", role_admin_sub:"Sub admin",
      nav_compare:"Compare Apps", compare_sub:"Benchmark the apps you monitor side by side.", compare_select_title:"Select apps to compare", compare_select_sub:"Pick 2 or more apps, then generate a comparison.",
      compare_cta:"Compare", compare_min:"Select at least 2 apps", selected_count:"selected", compare_clear_selection:"Clear selection", compare_again:"Change selection", export_compare:"Export comparison",
      m_health:"Health score", m_rating:"Avg. rating", m_total:"Total reviews", m_latest:"Latest source-day reviews", m_critical:"Critical bugs", m_positive:"Positive sentiment", m_trend:"Volume trend",
      leaderboard:"Overall ranking", best:"Best", metric:"Metric", sentiment_split:"Sentiment split", rating_dist:"Rating distribution", health_trend:"Health trend (14d)", cat_compare:"Category mix", at_a_glance:"At a glance",
      team_title:"The Outlier", team_sub:"The person behind Review Radar.", nav_team:"Team",
      role_pic:"Project Lead · PIC", built_by:"Designed & built by",
      pic_name:"Nam. Hứa Đại",
      feedback_title:"Leave feedback", feedback_sub:"Tell us what works and what could be better.", feedback_contact:"You can also contact namhd@vng.com.vn directly.", feedback_name:"Your name", feedback_name_ph:"Optional", feedback_type:"Type", fb_idea:"Idea", fb_bug:"Bug", fb_praise:"Praise", feedback_msg:"Message", feedback_msg_ph:"Share your thoughts about the product…", feedback_rating:"How would you rate it?", feedback_send:"Send feedback", feedback_thanks:"Thanks for your feedback!", feedback_recent:"Recent feedback",
    },
    vi: {
      brand_sub:"Phân tích đánh giá",
      nav_monitor:"Giám sát", nav_apps:"Ứng dụng có sẵn", nav_actions:"Việc cần xử lý", nav_reports:"Báo cáo", nav_settings:"Cài đặt",
      nav_overview:"Tổng quan", nav_reviews:"Đánh giá", all_apps:"Tất cả ứng dụng", sb_this_app:"Ứng dụng này",
      nav_section_main:"Không gian làm việc", nav_section_account:"Tài khoản",
      user_name:"The Outlier", user_role:"Product Owner",
      s1_eyebrow:"REVIEW INTELLIGENCE HẰNG NGÀY",
      s1_title:"Theo dõi review ứng dụng trên store mỗi ngày", s1_subtitle:"Nhập tên ứng dụng để xem nhanh đánh giá mới, cảm xúc người dùng và các vấn đề cần ưu tiên xử lý. Dữ liệu được lấy từ nguồn công khai trên store và có thể trễ 1+ ngày.",
      desktop_notice:"Tối ưu cho trình duyệt desktop",
      source_window_prefix:"Dữ liệu nguồn mới nhất:",
      s1_placeholder:"Nhập tên ứng dụng, ví dụ Zalopay, Shopee, Facebook...", s1_find:"Tìm ứng dụng",
      review_count_label:"Số review muốn phân tích", review_count_note:"Chọn càng nhiều review, lần thu thập đầu tiên có thể càng lâu. Dữ liệu store không phải realtime và có thể trễ 1+ ngày.",
      suggested:"Kết quả phù hợp", suggested_sub:"Xếp hạng theo độ tương đồng tên",
      similarity:"khớp", confirm:"Chọn", confirmed:"Đã chọn",
      available:"Ứng dụng có sẵn", available_sub:"Snapshot hằng ngày — mở ngay", available_search_placeholder:"Tìm trong ứng dụng có sẵn…", available_no_results:"Không tìm thấy ứng dụng phù hợp", available_no_results_sub:"Thử tên app, nhà phát hành, nền tảng, trạng thái refresh hoặc app ID khác.", clear_search:"Xóa tìm kiếm", refresh_filter_label:"Lọc theo trạng thái refresh", refresh_filter_all:"Tất cả", refresh_filter_on:"Refresh bật", refresh_filter_off:"Refresh tắt",
      last_updated:"Snapshot cập nhật", total_reviews:"đánh giá", open_dashboard:"Mở dashboard", start_crawl:"Thu thập đánh giá", hourly_on:"Refresh: bật", hourly_off:"Refresh: tắt", hourly_disabled_short:"Tắt", hourly_admin_contact:"Feed đánh giá từ store có thể trễ 1+ ngày; liên hệ admin để được bật/tắt refresh.",
      scraping_title:"Đang thu thập snapshot", scraping_sub:"Đang thu thập từ store — bấm để xem trạng thái", status_scraping:"Đang thu thập", status_queued:"Đang chờ", queue_title:"Hàng đợi thu thập", queue_sub:"Các app được xử lý lần lượt để tránh rate limit. App đang chờ sẽ tự chạy theo thứ tự.", queue_position:"Vị trí hàng đợi", queue_next:"chạy sau app phía trước", queue_starting:"Đang chuẩn bị chạy", view_status:"Xem trạng thái", toast_scrape_done:"Đã cập nhật snapshot", toast_added:"Đã thêm", toast_crawled:"Đã lấy được", toast_classified:"phân loại", toast_new_reviews:"đánh giá mới", toast_no_new_reviews:"không có đánh giá mới từ store để phân loại", toast_no_reviews_fetched:"Store chưa có đánh giá mới", toast_crawl_fallback:"Không lấy được đánh giá mới, đã cập nhật từ dữ liệu đã lưu", toast_crawl_error:"Thu thập kết thúc với lỗi",
      health_healthy:"Tốt", health_warning:"Cảnh báo", health_critical:"Nghiêm trọng",
      loading_apps:"Đang tải ứng dụng có sẵn…", empty_title:"Bắt đầu bằng cách tìm một ứng dụng", empty_sub:"Nhập tên ứng dụng phía trên, chúng tôi sẽ tìm các kết quả gần nhất trên App Store và Google Play.",
      searching:"Đang tìm trên kho ứng dụng…",
      min_ago:" phút trước", hour_ago:" giờ trước",
      s2_eyebrow:"Đang chuẩn bị dashboard",
      s2_title:"Đang thiết lập snapshot cho", s2_note:"Thu thập một ứng dụng mới lần đầu có thể mất vài phút. Feed store có thể bị trễ, nên snapshot này có thể chưa bao gồm review trong ngày.",
      step_confirmed:"Đã xác nhận ứng dụng", step_confirmed_d:"Đã xác minh nguồn trên App Store",
      step_crawling:"Đang thu thập đánh giá store", step_crawling_d:"Đọc snapshot public mới nhất từ store",
      step_categorizing:"Đang phân loại đánh giá", step_categorizing_d:"Phân loại theo chủ đề, cảm xúc & độ ưu tiên",
      step_building:"Đang dựng dashboard", step_building_d:"Tính toán chỉ số và xu hướng",
      est_time:"Thời gian dự kiến", reviews_collected:"Đã thu thập", current_step:"Bước hiện tại",
      loading_dashboard:"Đang tải dashboard…", notify:"Báo tôi khi xong", back_apps:"Về danh sách ứng dụng", cancel_crawl:"Dừng & giữ kết quả", cancelling:"Đang dừng…", almost:"Sắp xong…", skip_now:"Vào dashboard ngay", skip_hint:"Phân loại vẫn tiếp tục chạy ở chế độ nền — tải lại sau để xem phần còn lại.", open_existing_dashboard:"Mở dashboard hiện có", queued_existing_data:"Vẫn có thể xem dashboard với dữ liệu hiện có trong lúc lượt refresh đang chờ.", existing_dashboard_hint:"Lượt refresh vẫn chạy ở chế độ nền; dashboard sẽ cập nhật sau khi hoàn tất.",
      platform_label:"Nền tảng", last_crawled:"Snapshot cập nhật", source_latest:"Dữ liệu tới", source_date_none:"Chưa có ngày cutoff", crawl_freq:"Nhịp refresh", every_hour:"Mỗi 1 giờ",
      configure:"Cấu hình lịch", date_range:"30 ngày qua", date_7:"7 ngày qua", date_30:"30 ngày qua", date_90:"90 ngày qua", date_custom:"Tùy chỉnh...", toggle_nav:"Thu gọn menu",
      every_30m:"Mỗi 30 phút", every_6h:"Mỗi 6 giờ", every_12h:"Mỗi 12 giờ", every_24h:"Hàng ngày",
      schedule_title:"Lịch refresh", schedule_sub:"Nhịp refresh do admin cấu hình cho workspace này.", schedule_admin_title:"Liên hệ admin để đổi refresh",
      freq_label:"Nhịp refresh", schedule_help:"Snapshot đánh giá được thu thập tự động theo lịch này.",
      opt_section:"Tùy chọn",
      opt_notify:"Gửi email khi có bug nghiêm trọng", opt_notify_d:"Nhận thông báo sau mỗi snapshot được refresh.",
      opt_pause:"Tạm dừng thu thập vào cuối tuần", opt_pause_d:"Tiết kiệm hạn mức khi lưu lượng thấp.",
      cancel:"Hủy", close:"Đóng", save_changes:"Lưu thay đổi", schedule_saved:"Đã cập nhật lịch thu thập",
      filter_platform:"Nền tảng", filter_category:"Danh mục", filter_priority:"Ưu tiên", filter_sentiment:"Cảm xúc", all:"Tất cả",
      kpi_total:"Tổng đánh giá", kpi_latest:"Đánh giá ngày nguồn mới nhất", kpi_critical:"Bug nghiêm trọng cần sửa", kpi_fixed:"Bug đã sửa", kpi_pending:"Việc đang chờ xử lý", kpi_health:"Điểm sức khỏe đánh giá",
      sub_all_time:"Toàn thời gian", sub_source_latest_day:"ngày có dữ liệu", sub_need_fix:"Cần sửa gấp", sub_last_30d:"30 ngày qua", sub_action_items:"Đang chờ phân loại", sub_out_of_100:"Tính theo cảm xúc",
      cat_title:"Phân loại đánh giá", cat_sub:"Tỉ trọng đánh giá theo chủ đề", cat_total:"đánh giá",
      cat_bug:"Bug", cat_criticalbug:"Bug nghiêm trọng", cat_feedback:"Góp ý", cat_positive:"Tích cực", cat_negative:"Tiêu cực", cat_spam:"Spam", cat_feature:"Yêu cầu tính năng",
      trend_title:"Xu hướng đánh giá", trend_sub:"Lượng đánh giá & điểm sức khỏe theo ngày",
      r7:"7N", r30:"30N", r90:"90N", legend_reviews:"Đánh giá / ngày", legend_health:"Điểm sức khỏe", trend_high:"Cao nhất", trend_low:"Thấp nhất",
      action_title:"Việc ưu tiên xử lý", action_sub:"Các vấn đề cần chú ý, xếp theo mức ảnh hưởng",
      view_all:"Xem tất cả", mark_fixed:"Đánh dấu đã sửa", assign:"Giao việc", view_reviews:"Xem đánh giá",
      pri_critical:"Nghiêm trọng", pri_high:"Cao", pri_medium:"Trung bình", pri_low:"Thấp",
      flag_need_fix:"Cần sửa", flag_need_reply:"Cần phản hồi", flag_need_investigation:"Cần điều tra", flag_spam_review:"Đánh giá spam",
      st_open:"Mở", st_in_progress:"Đang xử lý", st_fixed:"Đã sửa", st_ignored:"Bỏ qua",
      owner:"Phụ trách", affecting:"ảnh hưởng", reviews_word:"đánh giá", linked_reviews:"đánh giá liên quan",
      table_title:"Chi tiết đánh giá", table_sub:"Bấm vào một dòng để xem đầy đủ đánh giá",
      col_review:"Đánh giá", col_date:"Ngày", col_rating:"Sao", col_category:"Danh mục", col_sentiment:"Cảm xúc", col_priority:"Ưu tiên", col_status:"Trạng thái", col_summary:"Tóm tắt AI",
      filtered_by:"Lọc theo", clear_filter:"Xóa lọc",
      ai_summary:"Tóm tắt AI", detected_issue:"Vấn đề phát hiện", suggested_action:"Hành động đề xuất", original_review:"Đánh giá gốc", metadata:"Thông tin",
      meta_version:"Phiên bản", meta_device:"Thiết bị", meta_country:"Quốc gia", meta_platform:"Nền tảng",
      create_ticket:"Tạo ticket", ignore:"Bỏ qua", reply_suggestion:"Gợi ý phản hồi",
      sent_positive:"Tích cực", sent_negative:"Tiêu cực", sent_neutral:"Trung lập",
      showing:"Hiển thị", of:"trên", rows_limit:"Số dòng",
      filter_status:"Trạng thái", filter_flag:"Hành động", filter_rating:"Số sao", clear_all:"Xóa bộ lọc", no_results:"Không có đánh giá nào khớp bộ lọc.", no_actions:"Không có việc nào khớp bộ lọc.",
      back_overview:"Tổng quan", actions_page_sub:"Toàn bộ vấn đề được gắn cờ cho ứng dụng này, xếp theo mức ảnh hưởng.", reviews_page_sub:"Mọi đánh giá đã thu thập, lọc được toàn diện.",
      reviews_for:"Đánh giá liên quan đến", clear_context:"Xem tất cả đánh giá", open_count:"đang mở",
      reports_sub:"Tạo và lên lịch báo cáo đánh giá cho team.", coming_soon:"Sắp ra mắt", future_note:"Dự kiến phát triển trong bản phát hành sau.",
      delivery_title:"Kênh gửi báo cáo", delivery_sub:"Báo cáo sẽ được gửi tới nơi team đang làm việc.",
      ch_teams:"Microsoft Teams", ch_teams_d:"Đăng báo cáo vào kênh Teams", ch_outlook:"Email Outlook", ch_outlook_d:"Gửi email định kỳ tới danh sách nhận", ch_download:"Tải về", ch_download_d:"Xuất PDF bất kỳ lúc nào", available_badge:"Đang dùng được",
      templates_title:"Mẫu báo cáo", templates_sub:"Bắt đầu từ mẫu có sẵn", scheduled_title:"Báo cáo định kỳ", scheduled_sub:"Đang chạy tự động",
      generate:"Tạo", export_pdf:"Xuất PDF", schedule_btn:"Lên lịch", recipients:"Người nhận", report_format:"Định dạng", run_freq:"Tần suất", next_run:"Lần chạy tới", new_report:"Báo cáo mới",
      tpl_weekly:"Tóm tắt đánh giá tuần", tpl_weekly_d:"Lưu lượng, cảm xúc và vấn đề nổi bật 7 ngày qua.",
      tpl_critical:"Báo cáo bug nghiêm trọng", tpl_critical_d:"Toàn bộ bug nghiêm trọng và cụm crash cần sửa.",
      tpl_category:"Phân loại đánh giá", tpl_category_d:"Tỉ trọng đánh giá theo danh mục, so với tuần trước.",
      tpl_compare:"So sánh ứng dụng", tpl_compare_d:"Đối chiếu ứng dụng này với các app khác bạn theo dõi.",
      sch_exec:"Tóm tắt cho lãnh đạo hàng tháng", sch_weekly_bug:"Tổng hợp bug nghiêm trọng hàng tuần",
      settings_sub:"Quản lý workspace, mặc định thu thập và tích hợp.", settings_admin_only:"Chỉ admin mới được thao tác",
      set_general:"Chung", set_workspace_name:"Tên workspace", set_default_lang:"Ngôn ngữ mặc định", set_timezone:"Múi giờ",
      set_crawl:"Mặc định thu thập", set_default_freq:"Tần suất thu thập mặc định", set_autocat:"Tự động phân loại đánh giá mới", set_autocat_d:"Phân loại chủ đề, cảm xúc và ưu tiên khi thu thập.", set_spam:"Tự động lọc đánh giá spam", set_spam_d:"Ẩn đánh giá khớp mẫu spam đã biết.",
      set_notif:"Thông báo", set_team:"Thành viên", set_invite:"Mời thành viên", set_integrations:"Tích hợp", set_api:"Truy cập API", set_api_d:"Dùng REST API để đưa dữ liệu đánh giá vào công cụ của bạn.", set_api_key:"API key", set_regenerate:"Tạo lại", connect:"Kết nối", connected:"Đã kết nối", settings_saved:"Đã lưu cài đặt", role_admin:"Quản trị", role_editor:"Biên tập", role_viewer:"Người xem", role_admin_main:"Admin chính", role_admin_sub:"Admin phụ",
      nav_compare:"So sánh ứng dụng", compare_sub:"Đối chiếu các ứng dụng bạn theo dõi cạnh nhau.", compare_select_title:"Chọn ứng dụng để so sánh", compare_select_sub:"Chọn từ 2 ứng dụng trở lên, rồi tạo bảng so sánh.",
      compare_cta:"So sánh", compare_min:"Chọn ít nhất 2 ứng dụng", selected_count:"đã chọn", compare_clear_selection:"Xóa lựa chọn", compare_again:"Đổi lựa chọn", export_compare:"Xuất bảng so sánh",
      m_health:"Điểm sức khỏe", m_rating:"Điểm đánh giá TB", m_total:"Tổng đánh giá", m_latest:"Đánh giá ngày nguồn mới nhất", m_critical:"Bug nghiêm trọng", m_positive:"Cảm xúc tích cực", m_trend:"Xu hướng lượng",
      leaderboard:"Xếp hạng tổng thể", best:"Tốt nhất", metric:"Chỉ số", sentiment_split:"Tỉ lệ cảm xúc", rating_dist:"Phân bố sao", health_trend:"Xu hướng sức khỏe (14n)", cat_compare:"Cơ cấu danh mục", at_a_glance:"Tổng quan nhanh",
      team_title:"The Outlier", team_sub:"Người đứng sau Review Radar.", nav_team:"Đội ngũ",
      role_pic:"Trưởng dự án · PIC", built_by:"Thiết kế & phát triển bởi",
      pic_name:"Nam. Hứa Đại",
      feedback_title:"Để lại góp ý", feedback_sub:"Cho chúng tôi biết điều gì tốt và điều gì cần cải thiện.", feedback_contact:"Bạn cũng có thể liên hệ trực tiếp qua namhd@vng.com.vn.", feedback_name:"Tên của bạn", feedback_name_ph:"Không bắt buộc", feedback_type:"Loại", fb_idea:"Ý tưởng", fb_bug:"Lỗi", fb_praise:"Khen ngợi", feedback_msg:"Nội dung", feedback_msg_ph:"Chia sẻ cảm nhận của bạn về sản phẩm…", feedback_rating:"Bạn đánh giá thế nào?", feedback_send:"Gửi góp ý", feedback_thanks:"Cảm ơn góp ý của bạn!", feedback_recent:"Góp ý gần đây",
    },
  };

  // ---------- Reports / Settings mock data ----------
  var SCHEDULED = [
    { id:"sch_exec", freq:"Monthly", recipients:"leadership@company", format:"PDF", next:"01/07", channel:"download" },
    { id:"sch_weekly_bug", freq:"Weekly · Mon", recipients:"app-ops (8)", format:"PDF", next:"16/06", channel:"download" },
  ];
  var TEAM = [
    { name:"Nam. Hứa Đại", email:"namhd@vng.com.vn", role:"role_admin_main", avatar:"assets/namhd.jpeg", initials:"N", color:["#7bd3ff","#0a84ff"] },
  ];
  var INTEGRATIONS = [
    { id:"teams", name:"Microsoft Teams", desc_en:"Post alerts & reports to channels", desc_vi:"Đăng cảnh báo & báo cáo vào kênh", status:"future", glyph:"T", grad:["#6264a7","#4b4d8f"] },
    { id:"outlook", name:"Outlook", desc_en:"Email digests to distribution lists", desc_vi:"Gửi email tổng hợp tới danh sách", status:"future", glyph:"O", grad:["#0a84ff","#0058c8"] },
    { id:"jira", name:"Jira", desc_en:"Create tickets from action items", desc_vi:"Tạo ticket từ việc cần xử lý", status:"future", glyph:"J", grad:["#2b8aff","#1565d8"] },
    { id:"slack", name:"Slack", desc_en:"Daily digests to a channel", desc_vi:"Digest hằng ngày tới kênh", status:"future", glyph:"S", grad:["#e0b0ff","#9b2fae"] },
  ];

  // ---------- Per-app comparison stats — populated from live APIs ----------
  var COMPARE = {};

  window.DATA = { APPS: APPS, AVAILABLE: AVAILABLE, SUGGESTIONS: SUGGESTIONS, KPIS: KPIS, CATEGORIES: CATEGORIES, TREND: TREND, ACTIONS: ACTIONS, REVIEWS: REVIEWS, SOURCE_DATE: SOURCE_DATE, I18N: I18N, SCHEDULED: SCHEDULED, TEAM: TEAM, INTEGRATIONS: INTEGRATIONS, COMPARE: COMPARE };
})();
