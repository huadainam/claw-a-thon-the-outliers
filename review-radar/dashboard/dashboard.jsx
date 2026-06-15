/* ============ Screen 3: Review Monitoring Dashboard ============ */
function reviewMatchesFilters(review, filters) {
  return (
    (filters.rating == null || review.rating === filters.rating) &&
    (filters.cat == null || review.cat === filters.cat) &&
    (filters.priority == null || review.priority === filters.priority) &&
    (filters.status == null || review.status === filters.status) &&
    (filters.sentiment == null || review.sentiment === filters.sentiment) &&
    (filters.platform == null || review.platform === filters.platform) &&
    (filters.actionId == null || (review.actionIds || []).includes(filters.actionId))
  );
}

function dashboardCount(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1000000000) return (n / 1000000000).toFixed(1) + "B";
  if (abs >= 1000000) return (n / 1000000).toFixed(1) + "M";
  return Math.round(n).toLocaleString();
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function dateKeyFromDate(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function formatDateKeyForUi(dateKey, t) {
  if (!dateKey) return "—";
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString(t._lang === "vi" ? "vi-VN" : "en-US", {
    day:"2-digit", month:"2-digit", year:"numeric",
  });
}

function reviewDayKey(review) {
  if (review && review.dateKey) return review.dateKey;
  const raw = review && review.date;
  if (!raw || raw === "—") return "";
  const d = new Date(String(raw).replace(" ", "T"));
  if (!Number.isNaN(d.getTime())) return dateKeyFromDate(d);
  return String(raw).slice(0, 10);
}

function latestReviewDayKey(reviews) {
  return reviews.reduce((latest, review) => {
    const day = reviewDayKey(review);
    return day && day > latest ? day : latest;
  }, "");
}

function makeFilteredKpis(reviews, actions) {
  const total = reviews.length;
  const latestKey = latestReviewDayKey(reviews);
  const latest = latestKey ? reviews.filter(r => reviewDayKey(r) === latestKey).length : 0;
  const bugs = reviews.filter(r => r.cat === "bug").length;
  const fixed = actions.filter(a => a.status === "fixed").length;
  const pending = actions.filter(a => a.status === "open").length;
  const positive = reviews.filter(r => r.sentiment === "positive").length;
  const negative = reviews.filter(r => r.sentiment === "negative").length + bugs;
  const denom = Math.max(1, reviews.length);
  const healthScore = Math.round(Math.max(0, Math.min(100, ((positive - negative * 0.5) / denom * 50) + 70)));
  return [
    { id:"total",    value:dashboardCount(total), raw:total, icon:"reviews", trend:null, sub:"all_time", tone:"neutral" },
    { id:"latest",   value:dashboardCount(latest), raw:latest, icon:"calendar", trend:null, sub:"source_latest_day", dateKey:latestKey, tone:"neutral" },
    { id:"critical", value:dashboardCount(bugs), raw:bugs, icon:"alert", trend:null, sub:"need_fix", tone:"critical", invert:true },
    { id:"fixed",    value:dashboardCount(fixed), raw:fixed, icon:"check", trend:null, sub:"last_30d", tone:"positive" },
    { id:"pending",  value:dashboardCount(pending), raw:pending, icon:"flag", trend:null, sub:"action_items", tone:"warning", invert:true },
    { id:"health",   value:String(healthScore), raw:healthScore, icon:"heart", trend:null, sub:"out_of_100", tone:"positive", suffix:"/100" },
  ];
}

function makeFilteredCategories(reviews) {
  const colors = {
    positive:"var(--cat-positive)",
    feedback:"var(--cat-feedback)",
    bug:"var(--cat-bug)",
    negative:"var(--cat-negative)",
    feature:"var(--cat-feature)",
    criticalbug:"var(--cat-criticalbug)",
    spam:"var(--cat-spam)",
  };
  const byCat = {};
  reviews.forEach(r => {
    const id = r.cat || "feedback";
    if (!byCat[id]) byCat[id] = { id, count:0, color:colors[id] || "var(--cat-feedback)" };
    byCat[id].count += 1;
  });
  return Object.values(byCat).sort((a, b) => b.count - a.count);
}

function makeFilteredTrend(reviews) {
  const byDay = {};
  reviews.forEach(r => {
    const day = reviewDayKey(r);
    if (!day) return;
    if (!byDay[day]) byDay[day] = { reviews:0, critical:0, healthTotal:0 };
    byDay[day].reviews += 1;
    if (r.cat === "bug") byDay[day].critical += 1;
    byDay[day].healthTotal += (Number(r.rating) || 3) * 20;
  });
  return Object.keys(byDay).sort().map(day => {
    const d = new Date(day + "T00:00:00");
    const row = byDay[day];
    return {
      date:d,
      label:d.getDate() + "/" + (d.getMonth() + 1),
      reviews:row.reviews,
      critical:row.critical,
      health:Math.round(row.healthTotal / row.reviews),
    };
  });
}

function normalizeDashboardParts(parts) {
  const entries = Object.entries(parts);
  const sum = entries.reduce((acc, entry) => acc + entry[1], 0);
  if (sum === 100 || sum === 0) return parts;
  const out = {};
  entries.forEach(([key, value]) => { out[key] = value; });
  const largest = entries.slice().sort((a, b) => b[1] - a[1])[0][0];
  out[largest] = Math.max(0, Math.min(100, out[largest] + (100 - sum)));
  return out;
}

function pctPart(count, total) {
  return total ? Math.round((count / total) * 100) : 0;
}

function makeSentimentMix(reviews) {
  const counts = { positive:0, neutral:0, negative:0 };
  reviews.forEach(r => {
    const key = counts[r.sentiment] != null ? r.sentiment : "neutral";
    counts[key] += 1;
  });
  const total = reviews.length;
  const pct = normalizeDashboardParts({
    positive: pctPart(counts.positive, total),
    neutral: pctPart(counts.neutral, total),
    negative: pctPart(counts.negative, total),
  });
  return { total, counts, pct };
}

function makeRatingMix(reviews) {
  const counts = { 5:0, 4:0, 3:0, 2:0, 1:0 };
  let ratingTotal = 0;
  let ratingCount = 0;
  reviews.forEach(r => {
    const raw = Number(r.rating);
    if (!Number.isFinite(raw) || raw <= 0) return;
    const rating = Math.max(1, Math.min(5, Math.round(raw)));
    counts[rating] += 1;
    ratingTotal += rating;
    ratingCount += 1;
  });
  const pct = normalizeDashboardParts({
    5: pctPart(counts[5], ratingCount),
    4: pctPart(counts[4], ratingCount),
    3: pctPart(counts[3], ratingCount),
    2: pctPart(counts[2], ratingCount),
    1: pctPart(counts[1], ratingCount),
  });
  return { total: ratingCount, average: ratingCount ? ratingTotal / ratingCount : null, counts, pct };
}

function actionMatchesReviewFilters(action, filters, filteredReviews) {
  // "Contains" semantics: the to-do matches a priority filter if ANY review in
  // its cluster has that priority (falls back to the aggregate priority for older
  // entries without a `priorities` list).
  if (filters.priority != null) {
    const pris = (action.priorities && action.priorities.length) ? action.priorities : [action.priority];
    if (pris.indexOf(filters.priority) < 0) return false;
  }
  if (filters.status != null && action.status !== filters.status) return false;
  if (filters.cat != null && action.cat !== filters.cat) return false;
  const reviewDriven = [filters.rating, filters.sentiment, filters.platform, filters.actionId].some(v => v != null);
  if (!reviewDriven) return true;
  return filteredReviews.some(r => (r.actionIds || []).includes(action.id));
}

function Dashboard({ t, app, onBack, view, onNav, onDataChanged, loading }) {
  const a = window.DATA.APPS[app] || { name: app || "", platform: "—" };
  const [range, setRange] = useState(30);
  const [freq, setFreq] = useState("1h");
  const [showSchedule, setShowSchedule] = useState(false);
  const [toast, setToast] = useState(false);
  const emptyFilters = { rating:null, cat:null, priority:null, status:null, sentiment:null, platform:null };
  const [reviewFilters, setReviewFilters] = useState(emptyFilters);
  const [reviewCtx, setReviewCtx] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(false), 2600); };

  // While switching apps, window.DATA still holds the previous app's numbers
  // until this app's data finishes loading. Show a loading state instead of the
  // wrong (stale) data — loadDashboard stamps LOADED_APP_ID once data is in place,
  // and the dataVersion key bump remounts this view with the correct numbers.
  if (loading || window.DATA.LOADED_APP_ID !== app) {
    return (
      <div>
        <DashTopBar t={t} app={app} a={a} onBack={onBack} freq={freq} onConfigure={() => setShowSchedule(true)}
          range={range} setRange={setRange} onFutureNote={() => showToast(t("future_note"))}
          filters={reviewFilters} setFilters={setReviewFilters}/>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          padding:"140px 32px", gap:16, color:"var(--text-3)" }}>
          <div style={{ width:26, height:26, borderRadius:"50%", border:"3px solid rgba(0,113,227,0.2)",
            borderTopColor:"var(--accent)", animation:"spin 0.8s linear infinite" }}></div>
          <div style={{ fontSize:14, fontWeight:600 }}>{t("loading_dashboard")}</div>
        </div>
      </div>
    );
  }

  const filterActive = Object.values(reviewFilters).some(v => v != null);
  const filteredReviews = window.DATA.REVIEWS.filter(r => reviewMatchesFilters(r, reviewFilters));
  const filteredActions = window.DATA.ACTIONS.filter(a => actionMatchesReviewFilters(a, reviewFilters, filteredReviews));
  const overviewActions = filterActive ? filteredActions : window.DATA.ACTIONS;
  const overviewKpis = filterActive ? makeFilteredKpis(filteredReviews, overviewActions) : window.DATA.KPIS;
  const overviewCategories = filterActive ? makeFilteredCategories(filteredReviews) : window.DATA.CATEGORIES;
  const overviewTrend = filterActive ? makeFilteredTrend(filteredReviews) : window.DATA.TREND;
  const overviewReviews = filterActive ? filteredReviews : window.DATA.REVIEWS;
  const sentimentMix = makeSentimentMix(overviewReviews);
  const ratingMix = makeRatingMix(overviewReviews);

  // Jump to the Reviews page filtered to the category of an action item
  const viewReviewsFor = (action) => {
    setReviewFilters({ ...emptyFilters, actionId: action.id });
    setReviewCtx(action);
    onNav("reviews");
  };

  return (
    <div>
      <DashTopBar t={t} app={app} a={a} onBack={onBack} freq={freq} onConfigure={() => setShowSchedule(true)}
        range={range} setRange={setRange} onFutureNote={() => showToast(t("future_note"))}
        filters={reviewFilters} setFilters={setReviewFilters}/>
      <div style={{ padding:"24px 32px 60px", maxWidth:1280, margin:"0 auto" }}>

        {view === "overview" && (
          <React.Fragment>
            {/* KPI cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:14, marginBottom:20 }}>
              {overviewKpis.map((k, i) => <KpiCard key={k.id} k={k} t={t} i={i}/>)}
            </div>

            {/* Category + Trend */}
            <div style={{ display:"grid", gridTemplateColumns:"minmax(0, 420px) minmax(0, 1fr)", gap:16, marginBottom:20 }}>
              <div className="card fade-up" style={{ padding:"20px 22px", animationDelay:".1s" }}>
                <CardHead title={t("cat_title")} sub={t("cat_sub")}/>
                <div style={{ marginTop:16 }}>
                  <DonutChart data={overviewCategories} t={t} activeCat={reviewFilters.cat}
                    onSelect={(c) => setReviewFilters({ ...reviewFilters, cat: c })}/>
                </div>
              </div>

              <div className="card fade-up" style={{ padding:"20px 22px", animationDelay:".15s" }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                  <CardHead title={t("trend_title")} sub={t("trend_sub")}/>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:10 }}>
                    <div className="seg">
                      {[7,30,90].map(r => (
                        <button key={r} className={range===r ? "active":""} onClick={() => setRange(r)}>{t("r"+r)}</button>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:14, fontSize:12, color:"var(--text-2)", fontWeight:500 }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}><span style={{width:9,height:9,borderRadius:2,background:"#cfe2fb"}}></span>{t("legend_reviews")}</span>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}><span style={{width:12,height:3,borderRadius:2,background:"#0071e3"}}></span>{t("legend_health")}</span>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop:18 }}>
                  <TrendChart data={overviewTrend} t={t} range={range}/>
                </div>
              </div>
            </div>

            {/* Sentiment + rating distribution */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
              <div className="card fade-up" style={{ padding:"20px 22px", animationDelay:".18s" }}>
                <CardHead title={t("sentiment_split")} sub={t("sentiment_sub")}/>
                <div style={{ marginTop:18 }}>
                  <DashboardStackBar items={[
                    { key:"positive", pct:sentimentMix.pct.positive, color:"var(--positive)" },
                    { key:"neutral", pct:sentimentMix.pct.neutral, color:"#c7c7cc" },
                    { key:"negative", pct:sentimentMix.pct.negative, color:"var(--critical)" },
                  ]}/>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10, marginTop:16 }}>
                    <DashboardMixStat color="var(--positive)" label={t("sent_positive")} pct={sentimentMix.pct.positive} count={sentimentMix.counts.positive}/>
                    <DashboardMixStat color="#c7c7cc" label={t("sent_neutral")} pct={sentimentMix.pct.neutral} count={sentimentMix.counts.neutral}/>
                    <DashboardMixStat color="var(--critical)" label={t("sent_negative")} pct={sentimentMix.pct.negative} count={sentimentMix.counts.negative}/>
                  </div>
                </div>
              </div>

              <div className="card fade-up" style={{ padding:"20px 22px", animationDelay:".2s" }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                  <CardHead title={t("rating_dist")} sub={t("rating_sub")}/>
                  <div className="mono" style={{ fontSize:22, fontWeight:800, color:"#f5a623", lineHeight:1 }}>
                    ★ {ratingMix.average == null ? "—" : ratingMix.average.toFixed(1)}
                  </div>
                </div>
                <div style={{ marginTop:17, display:"flex", flexDirection:"column", gap:9 }}>
                  {[5,4,3,2,1].map(star => (
                    <DashboardRatingRow key={star} star={star} pct={ratingMix.pct[star]} count={ratingMix.counts[star]}/>
                  ))}
                </div>
              </div>
            </div>

            {/* Priority actions (preview) */}
            <div className="card fade-up" style={{ padding:"20px 22px", marginBottom:20, animationDelay:".2s" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <CardHead title={t("action_title")} sub={t("action_sub")}/>
                <button className="btn btn-ghost btn-sm" onClick={() => onNav("actions")}>{t("view_all")}<Icon name="chevron" size={15} stroke={2.2}/></button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {overviewActions.slice(0, 5).map((it) => <ActionRow key={it.id} app={app} it={it} t={t} onViewReviews={viewReviewsFor} onDataChanged={onDataChanged}/>)}
                {overviewActions.length === 0 && (
                  <div style={{ padding:"26px 12px", textAlign:"center", color:"var(--text-3)", fontSize:14, fontWeight:500 }}>
                    {t("no_actions")}
                  </div>
                )}
              </div>
            </div>

            {/* Review detail table */}
            <div className="fade-up" style={{ animationDelay:".25s" }}>
              <ReviewTable t={t} filters={reviewFilters} setFilters={setReviewFilters}/>
            </div>
          </React.Fragment>
        )}

        {view === "actions" && (
          <ActionsPage t={t} app={app} onBack={() => { setReviewCtx(null); setReviewFilters(emptyFilters); onNav("overview"); }} onViewReviews={viewReviewsFor} onDataChanged={onDataChanged}/>
        )}

        {view === "reviews" && (
          <ReviewsPage t={t} onBack={() => { setReviewCtx(null); setReviewFilters(emptyFilters); onNav("overview"); }} filters={reviewFilters} setFilters={setReviewFilters}
            ctx={reviewCtx} onClearCtx={() => { setReviewCtx(null); setReviewFilters(emptyFilters); }}/>
        )}
      </div>

      <ConfigureScheduleModal t={t} app={app} open={showSchedule}
        onClose={() => setShowSchedule(false)}/>

      {toast && (
        <div className="toast"><Icon name="checkCircle" size={17} stroke={2.2} style={{ color:"var(--positive)" }}/>{toast}</div>
      )}
    </div>
  );
}

function DashboardStackBar({ items }) {
  const active = (items || []).filter(item => item.pct > 0);
  return (
    <div style={{ display:"flex", height:18, borderRadius:7, overflow:"hidden", gap:1.5, background:"rgba(0,0,0,0.055)" }}>
      {active.map(item => (
        <div key={item.key} style={{ width:`${item.pct}%`, minWidth:item.pct > 0 ? 3 : 0, height:"100%", background:item.color }}
          title={`${item.pct}%`}></div>
      ))}
    </div>
  );
}

function DashboardMixStat({ color, label, pct, count }) {
  return (
    <div style={{ padding:"11px 12px", borderRadius:12, background:"var(--card-2)", minWidth:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, color:"var(--text-2)", fontSize:12, fontWeight:650, marginBottom:6 }}>
        <span style={{ width:9, height:9, borderRadius:3, background:color, flexShrink:0 }}></span>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{label}</span>
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
        <span className="mono" style={{ fontSize:20, fontWeight:800, letterSpacing:"-0.02em" }}>{pct}%</span>
        <span className="mono" style={{ fontSize:12, color:"var(--text-3)", fontWeight:650 }}>{dashboardCount(count)}</span>
      </div>
    </div>
  );
}

function DashboardRatingRow({ star, pct, count }) {
  const color = star >= 4 ? "var(--positive)" : star === 3 ? "var(--warning)" : "var(--critical)";
  return (
    <div style={{ display:"grid", gridTemplateColumns:"44px minmax(0, 1fr) 88px", gap:10, alignItems:"center" }}>
      <div className="mono" style={{ fontSize:12.5, fontWeight:800, color:"#f5a623", whiteSpace:"nowrap" }}>{star}★</div>
      <div style={{ height:10, borderRadius:5, background:"rgba(0,0,0,0.055)", overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, minWidth:pct > 0 ? 3 : 0, height:"100%", borderRadius:5, background:color }}></div>
      </div>
      <div style={{ textAlign:"right", whiteSpace:"nowrap" }}>
        <span className="mono" style={{ fontSize:12.5, fontWeight:800 }}>{pct}%</span>
        <span className="mono" style={{ fontSize:11.5, color:"var(--text-3)", fontWeight:650, marginLeft:5 }}>{dashboardCount(count)}</span>
      </div>
    </div>
  );
}

/* ---------- Top bar ---------- */
const FREQS = [
  { id:"30m", val:"30", unit:"min", key:"every_30m" },
  { id:"1h",  val:"1",  unit:"hr",  key:"every_hour" },
  { id:"6h",  val:"6",  unit:"hrs", key:"every_6h" },
  { id:"12h", val:"12", unit:"hrs", key:"every_12h" },
  { id:"24h", val:"24", unit:"hrs", key:"every_24h" },
];

function DashTopBar({ t, app, a, onBack, freq, onConfigure, range, setRange, onFutureNote, filters, setFilters }) {
  const appRow = window.DATA.AVAILABLE.find(row => row.app === app);
  const hourlyEnabled = !!(appRow && appRow.hourlyRefreshEnabled === true);
  const freqLabel = hourlyEnabled ? t((FREQS.find(f => f.id === freq) || FREQS[1]).key) : t("hourly_disabled_short");
  const lastCrawled = formatCrawlTimestamp(appRow && appRow.lastUpdatedAt, t);
  const sourceDateKey = (window.DATA.SOURCE_DATE && (window.DATA.SOURCE_DATE.cutoffKey || window.DATA.SOURCE_DATE.key)) || "";
  const sourceDateLabel = sourceDateKey ? formatDateKeyForUi(sourceDateKey, t) : t("source_date_none");
  const set = (key, val) => setFilters({ ...filters, [key]: val });
  const catOpts = window.DATA.CATEGORIES.map(c => ({ value:c.id, label:t("cat_"+c.id) }));
  const priOpts = ["critical","high","medium","low"].map(p => ({ value:p, label:t("pri_"+p) }));
  const senOpts = ["positive","neutral","negative"].map(s => ({ value:s, label:t("sent_"+s) }));
  const platOpts = [{ value:"App Store", label:"App Store" }, { value:"Google Play", label:"Google Play" }];
  const anyActive = [filters.platform, filters.cat, filters.priority, filters.sentiment].some(v => v != null);
  return (
    <div style={{ position:"sticky", top:0, zIndex:20, background:"rgba(251,251,253,0.82)",
      backdropFilter:"blur(18px) saturate(1.6)", WebkitBackdropFilter:"blur(18px) saturate(1.6)",
      borderBottom:"1px solid var(--hairline)" }}>
      <div style={{ maxWidth:1280, margin:"0 auto", padding:"14px 32px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <button className="btn-icon" onClick={onBack}
            style={{ width:34, height:34, borderRadius:9, display:"grid", placeItems:"center", background:"rgba(0,0,0,0.04)" }}>
            <Icon name="arrowLeft" size={18} style={{ color:"var(--text-2)" }}/>
          </button>
          <AppGlyph app={app} size={42}/>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <h1 style={{ fontSize:20, fontWeight:700, letterSpacing:"-0.025em" }}>{a.name}</h1>
              <span className="badge badge-muted" style={{ fontSize:11.5 }}><Icon name="globe" size={12}/>{a.platform}</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:12.5, color:"var(--text-2)", marginTop:2, flexWrap:"wrap" }}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--positive)", boxShadow:"0 0 0 3px var(--positive-soft)" }}></span>
                {t("last_crawled")} {lastCrawled}</span>
              <span style={{ width:3, height:3, borderRadius:"50%", background:"var(--text-3)" }}></span>
              <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}><Icon name="calendar" size={13}/>{t("source_latest")}: {sourceDateLabel}</span>
              <span style={{ width:3, height:3, borderRadius:"50%", background:"var(--text-3)" }}></span>
              <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}><Icon name="refresh" size={13}/>{t("crawl_freq")}: {freqLabel}</span>
            </div>
          </div>

          <div style={{ flex:1 }}></div>

          <button className="btn btn-secondary btn-sm" onClick={onConfigure}><Icon name="sliders" size={15}/>{t("configure")}</button>
          <DateRangeDropdown t={t} value={range} onChange={setRange} onCustom={onFutureNote}/>
        </div>

        {/* Filters — master bar, drives the review table below */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:14, flexWrap:"wrap" }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12.5, color:"var(--text-3)", fontWeight:600, marginRight:2 }}>
            <Icon name="filter" size={14}/>
          </span>
          <FilterSelect label={t("filter_platform")} value={filters.platform} options={platOpts} onChange={v=>set("platform",v)} t={t}/>
          <FilterSelect label={t("filter_category")} value={filters.cat} options={catOpts} onChange={v=>set("cat",v)} t={t}/>
          <FilterSelect label={t("filter_priority")} value={filters.priority} options={priOpts} onChange={v=>set("priority",v)} t={t}/>
          <FilterSelect label={t("filter_sentiment")} value={filters.sentiment} options={senOpts} onChange={v=>set("sentiment",v)} t={t}/>
          {anyActive && (
            <button className="btn btn-ghost btn-xs" onClick={() => setFilters({ ...filters, platform:null, cat:null, priority:null, sentiment:null })} style={{ color:"var(--text-2)" }}>
              <Icon name="x" size={13} stroke={2.4}/>{t("clear_all")}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function DateRangeDropdown({ t, value, onChange, onCustom }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const options = [
    { value:7, label:t("date_7") },
    { value:30, label:t("date_30") },
    { value:90, label:t("date_90") },
    { value:"custom", label:t("date_custom") },
  ];
  const selected = options.find(o => o.value === value) || options[1];
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const choose = (option) => {
    if (option.value === "custom") {
      onCustom && onCustom();
    } else {
      onChange(option.value);
    }
    setOpen(false);
  };
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600,
          padding:"7px 13px", borderRadius:9, border:"1px solid var(--hairline-strong)",
          background:"#fff", color:"var(--text)", transition:"all .15s" }}>
        <Icon name="calendar" size={15} style={{ color:"var(--text-2)" }}/>
        <span>{selected.label}</span>
        <Icon name="chevronDown" size={14} style={{ color:"var(--text-3)", transition:"transform .2s", transform: open?"rotate(180deg)":"none" }}/>
      </button>
      {open && (
        <div className="scale-in" style={{ position:"absolute", top:"calc(100% + 6px)", right:0, minWidth:170, zIndex:40,
          background:"#fff", border:"1px solid var(--hairline)", borderRadius:13, boxShadow:"var(--shadow-pop)", padding:6,
          transformOrigin:"top right" }}>
          {options.map(o => {
            const active = o.value === value;
            return (
              <button key={o.value} onClick={() => choose(o)}
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", textAlign:"left",
                  padding:"8px 11px", borderRadius:8, fontSize:13.5, fontWeight:500,
                  background: active ? "var(--accent-soft)":"transparent", color: active?"var(--accent)":"var(--text)" }}
                onMouseEnter={e => { if(!active) e.currentTarget.style.background="rgba(0,0,0,0.04)"; }}
                onMouseLeave={e => { if(!active) e.currentTarget.style.background="transparent"; }}>
                {o.label}{active && <Icon name="check" size={15} stroke={2.4}/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- KPI card ---------- */
function KpiCard({ k, t, i }) {
  const toneColor = { neutral:"var(--accent)", critical:"var(--critical)", positive:"var(--positive)", warning:"var(--warning)" }[k.tone];
  const toneSoft = { neutral:"var(--accent-soft)", critical:"var(--critical-soft)", positive:"var(--positive-soft)", warning:"var(--warning-soft)" }[k.tone];
  const subText = k.subText || (k.dateKey ? `${t("sub_"+k.sub)} ${formatDateKeyForUi(k.dateKey, t)}` : t("sub_"+k.sub));
  const healthFormula = k.id === "health" ? t("kpi_health_formula") : "";
  return (
    <div className="card fade-up" style={{ padding:"15px 16px", animationDelay:`${i*0.04}s`,
      display:"flex", flexDirection:"column", gap:11, minHeight:152 }}>
      <div style={{ width:32, height:32, borderRadius:9, background:toneSoft, color:toneColor, display:"grid", placeItems:"center" }}>
        <Icon name={k.icon} size={17}/>
      </div>
      {/* label: reserve two lines, but align the first line across every card */}
      <div style={{ fontSize:12.5, color:"var(--text-2)", fontWeight:600, lineHeight:1.3, height:34,
        display:"flex", alignItems:"flex-start" }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:5, minWidth:0, width:"100%" }}>
          <span style={{ display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", minWidth:0 }}>{t("kpi_"+k.id)}</span>
          {healthFormula && (
            <span className="kpi-info-wrap">
              <button type="button" className="kpi-info" aria-label={healthFormula} title={healthFormula}>
                <Icon name="info" size={12.5} stroke={2}/>
              </button>
              <span className="kpi-tip" role="tooltip">{healthFormula}</span>
            </span>
          )}
        </div>
      </div>
      <div style={{ marginTop:"auto" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:1 }}>
          <span className="mono" style={{ fontSize:27, fontWeight:700, letterSpacing:"-0.035em", lineHeight:1 }}>{k.value}</span>
          {k.suffix && <span style={{ fontSize:14, fontWeight:600, color:"var(--text-3)" }}>{k.suffix}</span>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8, minWidth:0 }}>
          <TrendDelta value={k.trend} invert={k.invert} size={12.5}/>
          <span style={{ fontSize:11.5, color:"var(--text-3)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{subText}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Action row (fixed grid so columns align across rows) ---------- */
const ACTION_STATUSES = ["open", "in_progress", "fixed", "ignored"];
const TODO_STATUS_FOR_ACTION = {
  open: "open",
  in_progress: "in_progress",
  fixed: "done",
  ignored: "ignored",
};

function ActionStatusMenu({ status, saving, t, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position:"relative", display:"inline-flex" }}>
      <button type="button" disabled={saving} onClick={() => setOpen(o => !o)}
        aria-label={t("filter_status")}
        style={{ display:"inline-flex", alignItems:"center", gap:6, minWidth:116, justifyContent:"space-between",
          padding:"4px 8px 4px 0", borderRadius:980, border:"1px solid transparent",
          background:saving ? "rgba(0,0,0,0.04)" : "transparent", color:"var(--text)",
          opacity:saving ? 0.65 : 1, cursor:saving ? "default" : "pointer" }}>
        <StatusBadge status={status} t={t}/>
        <Icon name="chevronDown" size={13} style={{ color:"var(--text-3)", transition:"transform .15s", transform:open ? "rotate(180deg)" : "none" }}/>
      </button>
      {open && (
        <div className="scale-in" style={{ position:"absolute", right:0, top:"calc(100% + 6px)", minWidth:168, zIndex:50,
          background:"#fff", border:"1px solid var(--hairline)", borderRadius:13, boxShadow:"var(--shadow-pop)", padding:6,
          transformOrigin:"top right" }}>
          {ACTION_STATUSES.map(s => {
            const selected = s === status;
            return (
              <button key={s} type="button" onClick={() => { setOpen(false); onChange(s); }}
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%",
                  padding:"7px 8px", borderRadius:9, background:selected ? "var(--accent-soft)" : "transparent",
                  color:selected ? "var(--accent)" : "var(--text)", fontSize:13, fontWeight:600 }}>
                <StatusBadge status={s} t={t}/>
                {selected && <Icon name="check" size={13} stroke={2.4}/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionRow({ app, it, t, onViewReviews, onDataChanged }) {
  const L = t._lang;
  const [status, setStatus] = useState(it.status);
  const [saving, setSaving] = useState(false);
  useEffect(() => setStatus(it.status), [it.status]);
  const updateStatus = (nextStatus) => {
    if (saving || nextStatus === status) return;
    const prev = status;
    setStatus(nextStatus);
    setSaving(true);
    const existing = window.DATA.ACTIONS.find(a => a.id === it.id);
    if (existing) existing.status = nextStatus;
    window.ARM_Bridge.patchTodo(app, it.id, { status: TODO_STATUS_FOR_ACTION[nextStatus] || "open" })
      .then(() => (onDataChanged ? onDataChanged() : null))
      .catch(err => {
        console.warn("[ActionRow] failed to update status:", err);
        if (existing) existing.status = prev;
        setStatus(prev);
      })
      .finally(() => setSaving(false));
  };
  return (
    <div className="action-row" style={{ display:"grid",
      gridTemplateColumns:"132px minmax(0,1fr) 128px 138px 124px", alignItems:"center", gap:14,
      padding:"13px 16px", borderRadius:12, border:"1px solid var(--hairline)", background:"#fff",
      transition:"border-color .15s, box-shadow .15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor="var(--hairline-strong)"; e.currentTarget.style.boxShadow="var(--shadow-sm)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor="var(--hairline)"; e.currentTarget.style.boxShadow="none"; }}>
      <div><PriorityBadge priority={it.priority} t={t}/></div>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:600, letterSpacing:"-0.01em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it["title_"+L]}</div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:3, fontSize:12.5, color:"var(--text-3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}><Icon name="user" size={12}/>{it.owner}</span>
          <span style={{ width:3, height:3, borderRadius:"50%", background:"var(--text-3)", flexShrink:0 }}></span>
          <span>{it.reviews} {t("linked_reviews")}</span>
        </div>
      </div>
      <div><FlagBadge flag={it.flag} t={t}/></div>
      <div><ActionStatusMenu status={status} saving={saving} t={t} onChange={updateStatus}/></div>
      <div style={{ display:"flex", gap:6, justifyContent:"flex-end", alignItems:"center" }}>
        <button className="btn btn-ghost btn-xs" onClick={() => onViewReviews && onViewReviews(it)} style={{ whiteSpace:"nowrap" }}>{t("view_reviews")}</button>
      </div>
    </div>
  );
}

/* ---------- Dropdown ---------- */
function Dropdown({ icon, label, options, t, compact }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(options[0]);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const isFiltered = compact && sel !== options[0];
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600,
          padding: compact ? "6px 11px" : "7px 13px", borderRadius:9,
          border:`1px solid ${isFiltered ? "var(--accent)" : "var(--hairline-strong)"}`,
          background: isFiltered ? "var(--accent-soft)" : "#fff", color: isFiltered ? "var(--accent)" : "var(--text)",
          transition:"all .15s" }}>
        {icon && <Icon name={icon} size={15} style={{ color:"var(--text-2)" }}/>}
        {compact && <span style={{ color:"var(--text-3)", fontWeight:600 }}>{label}:</span>}
        <span>{compact ? sel : label}</span>
        <Icon name="chevronDown" size={14} style={{ color:"var(--text-3)", transition:"transform .2s", transform: open?"rotate(180deg)":"none" }}/>
      </button>
      {open && (
        <div className="scale-in" style={{ position:"absolute", top:"calc(100% + 6px)", left:0, minWidth:170, zIndex:40,
          background:"#fff", border:"1px solid var(--hairline)", borderRadius:13, boxShadow:"var(--shadow-pop)", padding:6,
          transformOrigin:"top left" }}>
          {options.map(o => (
            <button key={o} onClick={() => { setSel(o); setOpen(false); }}
              style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", textAlign:"left",
                padding:"8px 11px", borderRadius:8, fontSize:13.5, fontWeight:500,
                background: sel===o ? "var(--accent-soft)":"transparent", color: sel===o?"var(--accent)":"var(--text)" }}
              onMouseEnter={e => { if(sel!==o) e.currentTarget.style.background="rgba(0,0,0,0.04)"; }}
              onMouseLeave={e => { if(sel!==o) e.currentTarget.style.background="transparent"; }}>
              {o}{sel===o && <Icon name="check" size={15} stroke={2.4}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CardHead({ title, sub }) {
  return (
    <div>
      <h3 style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.02em" }}>{title}</h3>
      {sub && <p style={{ fontSize:13.5, color:"var(--text-2)", marginTop:2 }}>{sub}</p>}
    </div>
  );
}

/* ---------- Configure crawl schedule modal ---------- */
function ConfigureScheduleModal({ t, app, open, onClose }) {
  const a = window.DATA.APPS[app] || { name: app || "", platform: "—" };
  if (!open) return null;

  const appRow = window.DATA.AVAILABLE.find(row => row.app === app);
  const hourlyEnabled = !!(appRow && appRow.hourlyRefreshEnabled === true);
  const statusText = hourlyEnabled ? t("hourly_on") : t("hourly_off");

  return (
    <Modal open={open} onClose={onClose} width={480}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:13, padding:"22px 24px 18px", borderBottom:"1px solid var(--hairline)" }}>
        <div style={{ width:38, height:38, borderRadius:11, background:"var(--accent-soft)", color:"var(--accent)", display:"grid", placeItems:"center", flexShrink:0 }}>
          <Icon name="refresh" size={19}/>
        </div>
        <div style={{ flex:1 }}>
          <h3 style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.02em" }}>{t("schedule_title")}</h3>
          <p style={{ fontSize:13, color:"var(--text-2)", marginTop:1 }}>{t("schedule_sub")}</p>
        </div>
        <button className="btn-icon" onClick={onClose} style={{ width:30, height:30, borderRadius:8, display:"grid", placeItems:"center", background:"rgba(0,0,0,0.04)" }}>
          <Icon name="x" size={17} style={{ color:"var(--text-2)" }}/>
        </button>
      </div>

      {/* Body */}
      <div style={{ padding:"20px 24px 4px" }}>
        {/* App row */}
        <div style={{ display:"flex", alignItems:"center", gap:11, padding:"11px 13px", background:"var(--card-2)", borderRadius:13, marginBottom:20 }}>
          <AppGlyph app={app} size={34}/>
          <div>
            <div style={{ fontSize:14, fontWeight:600 }}>{a.name}</div>
            <div style={{ fontSize:12, color:"var(--text-3)", display:"flex", alignItems:"center", gap:4 }}><Icon name="globe" size={12}/>{a.platform}</div>
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:14,
            padding:"14px 15px", borderRadius:13, border:"1px solid var(--hairline)", background:"#fff" }}>
            <div>
              <div style={{ fontSize:12.5, fontWeight:700, color:"var(--text-2)", textTransform:"uppercase", letterSpacing:"0.03em", marginBottom:5 }}>
                {t("crawl_freq")}
              </div>
              <div style={{ display:"inline-flex", alignItems:"center", gap:7, fontSize:14.5, fontWeight:700,
                color:hourlyEnabled ? "var(--accent)" : "var(--text-2)" }}>
                <Icon name="refresh" size={16} stroke={2}/>
                {statusText}
              </div>
            </div>
            <span className="badge" style={{
              background:hourlyEnabled ? "var(--accent-soft)" : "rgba(0,0,0,0.05)",
              color:hourlyEnabled ? "var(--accent)" : "var(--text-2)",
              fontWeight:700,
            }}>
              {hourlyEnabled ? t("refresh_filter_on") : t("refresh_filter_off")}
            </span>
          </div>

          <div style={{ display:"flex", alignItems:"flex-start", gap:11, padding:"15px",
            borderRadius:13, background:"var(--accent-soft)", color:"var(--accent)" }}>
            <Icon name="refresh" size={18} stroke={2.2} style={{ flexShrink:0, marginTop:1 }}/>
            <div>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:3 }}>{t("schedule_admin_title")}</div>
              <div style={{ fontSize:13.5, lineHeight:1.45, color:"var(--text-2)" }}>{t("hourly_admin_contact")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display:"flex", justifyContent:"flex-end", gap:10, padding:"18px 24px 22px" }}>
        <button className="btn btn-primary" onClick={onClose}>{t("close")}</button>
      </div>
    </Modal>
  );
}

function OptionRow({ label, desc, checked, onChange }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0", borderTop:"1px solid var(--hairline)" }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, fontWeight:600 }}>{label}</div>
        <div style={{ fontSize:12.5, color:"var(--text-3)", marginTop:1 }}>{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange}/>
    </div>
  );
}

Object.assign(window, { Dashboard, DashTopBar, KpiCard, ActionRow, Dropdown, CardHead, ConfigureScheduleModal, OptionRow });
