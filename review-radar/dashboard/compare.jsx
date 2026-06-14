/* ============ App Comparison ============ */
function ComparePage({ t }) {
  const [selected, setSelected] = useState([]);
  const [phase, setPhase] = useState("select"); // select | result
  const [toast, setToast] = useState(false);
  const [loading, setLoading] = useState(false);
  const [compareData, setCompareData] = useState({});
  const apps = window.DATA.AVAILABLE.map(r => r.app);
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(false), 2400); };

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const clearSelection = () => setSelected([]);
  const runCompare = () => {
    if (selected.length < 2 || loading) return;
    setLoading(true);
    loadCompareStats(selected)
      .then(data => {
        setCompareData(data);
        setPhase("result");
      })
      .catch(err => {
        console.warn("[Compare] failed to load real stats:", err);
        showToast(t._lang === "vi" ? "Không tải được dữ liệu so sánh." : "Could not load comparison data.");
      })
      .finally(() => setLoading(false));
  };

  return (
    <div style={{ maxWidth:1180, margin:"0 auto", padding:"32px 40px 70px" }}>
      <div className="fade-up" style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:24, gap:16 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:700, letterSpacing:"-0.03em" }}>{t("nav_compare")}</h1>
          <p style={{ fontSize:15, color:"var(--text-2)", marginTop:3 }}>{t("compare_sub")}</p>
        </div>
        {phase === "result" && (
          <div style={{ display:"flex", gap:10 }}>
            <button className="btn btn-secondary" onClick={() => setPhase("select")}><Icon name="sliders" size={16}/>{t("compare_again")}</button>
            <button className="btn btn-primary" onClick={() => showToast(t("future_note"))}><Icon name="download" size={16}/>{t("export_compare")}</button>
          </div>
        )}
      </div>

      {phase === "select"
        ? <CompareSelect t={t} apps={apps} selected={selected} toggle={toggle} onClear={clearSelection} onCompare={runCompare} loading={loading}/>
        : <CompareResult t={t} selected={selected} compareData={compareData}/>}

      {toast && <div className="toast"><Icon name="clock" size={16} stroke={2.2} style={{ color:"var(--warning)" }}/>{toast}</div>}
    </div>
  );
}

function CompareSelect({ t, apps, selected, toggle, onClear, onCompare, loading }) {
  return (
    <div className="fade-up">
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:14, flexWrap:"wrap", marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.02em" }}>{t("compare_select_title")}</h2>
          <p style={{ fontSize:14, color:"var(--text-2)", marginTop:2 }}>{t("compare_select_sub")}</p>
        </div>
        {selected.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={onClear} disabled={loading}>
            <Icon name="x" size={15} stroke={2.2}/>
            {t("compare_clear_selection")}
          </button>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(250px, 1fr))", gap:14, marginBottom:24 }}>
        {apps.map((id, i) => {
          const a = window.DATA.APPS[id];
          const row = window.DATA.AVAILABLE.find(r => r.app === id);
          const on = selected.includes(id);
          return (
            <button key={id} onClick={() => toggle(id)} className="card"
              style={{ padding:16, textAlign:"left", display:"flex", alignItems:"center", gap:13,
                animation:`fadeUp .45s cubic-bezier(0.22,0.61,0.36,1) ${i*0.04}s both`,
                borderColor: on ? "var(--accent)" : "var(--hairline)",
                boxShadow: on ? "0 0 0 3px var(--accent-soft), var(--shadow-sm)" : "var(--shadow-sm)",
                transition:"box-shadow .18s, border-color .18s" }}>
              <AppGlyph app={id} size={44}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:600 }}>{a.name}</div>
                <div className="mono" style={{ fontSize:12.5, color:"var(--text-3)", marginTop:1 }}>{row.totalReviews.toLocaleString()} {t("total_reviews")}</div>
              </div>
              <div className="check-box" data-on={on}>{on && <Icon name="check" size={14} stroke={3}/>}</div>
            </button>
          );
        })}
      </div>

      <div style={{ position:"sticky", bottom:0, display:"flex", alignItems:"center", justifyContent:"space-between",
        background:"rgba(251,251,253,0.86)", backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)",
        borderTop:"1px solid var(--hairline)", padding:"16px 4px", marginTop:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ display:"flex" }}>
            {selected.slice(0,5).map((id, i) => (
              <div key={id} style={{ marginLeft: i ? -10 : 0, border:"2px solid var(--bg)", borderRadius:"24%", lineHeight:0 }}>
                <AppGlyph app={id} size={30}/>
              </div>
            ))}
          </div>
          <span style={{ fontSize:14, fontWeight:600, color:"var(--text-2)" }}>
            <span className="mono" style={{ color:"var(--text)" }}>{selected.length}</span> {t("selected_count")}
          </span>
        </div>
        <button className="btn btn-primary" disabled={selected.length < 2 || loading} onClick={onCompare}>
          <Icon name="chart" size={16}/>
          {loading ? (t._lang === "vi" ? "Đang so sánh..." : "Comparing...") : t("compare_cta")}
          {!loading && (selected.length >= 2 ? ` (${selected.length})` : ` · ${t("compare_min")}`)}
        </button>
      </div>
    </div>
  );
}

const COMPARE_LABEL_TO_CAT = {
  BUG_REPORT: "bug",
  FEATURE_REQUEST: "feature",
  COMPLAINT: "negative",
  POSITIVE: "positive",
  SPAM: "spam",
  FEEDBACK: "feedback",
};

function compareGet(url) {
  if (window.ARM_Bridge && window.ARM_Bridge._get) return window.ARM_Bridge._get(url);
  return fetch(url, { cache:"no-store" }).then(r => {
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  });
}

function loadCompareStats(ids) {
  return Promise.all(ids.map(id => loadOneCompareStats(id))).then(rows => {
    const out = {};
    rows.forEach(row => { out[row.id] = row.stats; });
    return out;
  });
}

function loadOneCompareStats(id) {
  const q = encodeURIComponent(id);
  return Promise.all([
    compareGet(`/api/stats?app_id=${q}`),
    compareGet(`/api/reviews?app_id=${q}`),
    compareGet(`/api/todos?app_id=${q}`),
  ]).then(([stats, reviews, todos]) => ({
    id,
    stats: makeRealCompareStats(id, stats || {}, reviews || [], todos || []),
  })).catch(err => {
    console.warn(`[Compare] stats unavailable for ${id}:`, err);
    return { id, stats: unavailableCompareStats(id) };
  });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pct(count, total) {
  return total ? Math.round((count / total) * 100) : 0;
}

function normalizePercentParts(parts) {
  const entries = Object.entries(parts);
  const sum = entries.reduce((acc, entry) => acc + entry[1], 0);
  if (sum === 100 || sum === 0) return parts;
  const out = {};
  entries.forEach(([key, value]) => { out[key] = value; });
  const largest = entries.slice().sort((a, b) => b[1] - a[1])[0][0];
  out[largest] = clamp(out[largest] + (100 - sum), 0, 100);
  return out;
}

function labelCounts(reviews) {
  return reviews.reduce((acc, r) => {
    const label = r.label || "FEEDBACK";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function numericScores(reviews) {
  return reviews
    .map(r => Number(r.score))
    .filter(score => Number.isFinite(score) && score > 0);
}

function comparePadDatePart(value) {
  return String(value).padStart(2, "0");
}

function compareDateKeyFromDate(date) {
  return `${date.getFullYear()}-${comparePadDatePart(date.getMonth() + 1)}-${comparePadDatePart(date.getDate())}`;
}

function compareReviewDay(review) {
  const raw = review && review.at;
  if (!raw) return "";
  let d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) d = new Date(String(raw).replace(" ", "T"));
  if (!Number.isNaN(d.getTime())) return compareDateKeyFromDate(d);
  return String(raw).slice(0, 10);
}

function latestCompareDay(reviews) {
  return (reviews || []).reduce((latest, review) => {
    const day = compareReviewDay(review);
    return day && day > latest ? day : latest;
  }, "");
}

function healthFromLabels(byLabel, total) {
  if (!total) return 0;
  const pos = byLabel.POSITIVE || 0;
  const neg = (byLabel.COMPLAINT || 0) + (byLabel.BUG_REPORT || 0);
  const totalCats = Object.values(byLabel).reduce((a, b) => a + b, 0) || total || 1;
  return Math.round(clamp(((pos - neg * 0.5) / totalCats * 50) + 70, 0, 100));
}

function sentimentFromLabels(byLabel, total) {
  if (!total) return { positive:0, neutral:0, negative:0 };
  const positive = pct(byLabel.POSITIVE || 0, total);
  const negative = pct((byLabel.COMPLAINT || 0) + (byLabel.BUG_REPORT || 0), total);
  return normalizePercentParts({
    positive,
    negative,
    neutral: clamp(100 - positive - negative, 0, 100),
  });
}

function categoryPercents(byLabel, total) {
  const raw = { positive:0, feedback:0, bug:0, negative:0, feature:0, criticalbug:0, spam:0 };
  Object.entries(byLabel).forEach(([label, count]) => {
    const cat = COMPARE_LABEL_TO_CAT[label] || "feedback";
    raw[cat] += count;
  });
  raw.criticalbug = Math.min(raw.bug, raw.criticalbug);
  const pctRaw = {};
  Object.entries(raw).forEach(([cat, count]) => { pctRaw[cat] = pct(count, total); });
  return normalizePercentParts(pctRaw);
}

function starPercents(scores) {
  const counts = { 5:0, 4:0, 3:0, 2:0, 1:0 };
  scores.forEach(score => {
    const star = clamp(Math.round(score), 1, 5);
    counts[star] += 1;
  });
  const out = {};
  [5, 4, 3, 2, 1].forEach(star => { out[star] = pct(counts[star], scores.length); });
  return normalizePercentParts(out);
}

function scoreHealth(review) {
  const score = Number(review.score);
  if (Number.isFinite(score) && score > 0) return clamp(Math.round(score * 20), 0, 100);
  if (review.label === "POSITIVE") return 90;
  if (review.label === "BUG_REPORT" || review.label === "COMPLAINT") return 35;
  return 65;
}

function sparkFromReviews(reviews, fallbackHealth) {
  const byDay = {};
  reviews.forEach(review => {
    const day = compareReviewDay(review);
    if (!day) return;
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(scoreHealth(review));
  });
  const points = Object.keys(byDay).sort().slice(-14).map(day => {
    const scores = byDay[day];
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  });
  if (points.length === 0) return Array.from({ length:14 }, () => fallbackHealth);
  while (points.length < 14) points.unshift(points[0]);
  return points;
}

function trendFromReviews(reviews) {
  const days = Object.keys(reviews.reduce((acc, review) => {
    const day = compareReviewDay(review);
    if (day) acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {})).sort();
  if (days.length < 2) return null;
  const counts = days.map(day => reviews.filter(r => compareReviewDay(r) === day).length);
  const half = Math.max(1, Math.floor(counts.length / 2));
  const prev = counts.slice(0, -half).reduce((a, b) => a + b, 0);
  const recent = counts.slice(-half).reduce((a, b) => a + b, 0);
  if (!prev) return recent ? 100 : null;
  return Math.round(((recent - prev) / prev) * 100);
}

function makeRealCompareStats(id, stats, reviews, todos) {
  const total = reviews.length || stats.total || 0;
  const byLabel = Object.keys(stats.by_label || {}).length ? stats.by_label : labelCounts(reviews);
  const scores = numericScores(reviews);
  const latestDay = latestCompareDay(reviews);
  const rating = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const health = healthFromLabels(byLabel, total);
  const openTodos = todos.filter(todo => !["done", "fixed", "ignored"].includes(todo.status));
  const criticalTodos = openTodos.filter(todo => todo.severity === "critical").length;

  return {
    health,
    rating,
    totalReviews: total,
    latestReviews: latestDay ? reviews.filter(r => compareReviewDay(r) === latestDay).length : 0,
    critical: criticalTodos,
    sentiment: sentimentFromLabels(byLabel, total),
    trend: trendFromReviews(reviews),
    cats: categoryPercents(byLabel, total),
    stars: starPercents(scores),
    spark: sparkFromReviews(reviews, health),
  };
}

function unavailableCompareStats(id) {
  const row = window.DATA.AVAILABLE.find(r => r.app === id) || {};
  const total = row.totalReviews || 0;
  return {
    unavailable: true,
    health: null,
    rating: null,
    totalReviews: total,
    latestReviews: null,
    critical: null,
    sentiment: { positive: 0, neutral: 0, negative: 0 },
    trend: null,
    cats: { positive: 0, feedback: 0, bug: 0, negative: 0, feature: 0, criticalbug: 0, spam: 0 },
    stars: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    spark: [],
  };
}

function CompareResult({ t, selected, compareData }) {
  const stats = selected.map(id => ({
    id,
    a: window.DATA.APPS[id],
    s: compareData[id] || unavailableCompareStats(id),
  }));
  // ranking by health
  const ranked = [...stats].sort((x, y) => (y.s.health ?? -1) - (x.s.health ?? -1));

  const metrics = [
    { key:"health",   label:t("m_health"),   get:s=>s.health, fmt:v=>v, suffix:"/100", best:"max" },
    { key:"rating",   label:t("m_rating"),   get:s=>s.rating, fmt:v=>v.toFixed(1), best:"max" },
    { key:"total",    label:t("m_total"),    get:s=>s.totalReviews, fmt:v=>v.toLocaleString(), best:"max" },
    { key:"latest",   label:t("m_latest"),   get:s=>s.latestReviews, fmt:v=>v.toLocaleString(), best:"max" },
    { key:"critical", label:t("m_critical"), get:s=>s.critical, fmt:v=>v, best:"min" },
    { key:"positive", label:t("m_positive"), get:s=>s.sentiment.positive, fmt:v=>v+"%", best:"max" },
  ];
  const bestFor = (m) => {
    const vals = stats.map(x => m.get(x.s)).filter(v => Number.isFinite(v));
    if (!vals.length) return null;
    return m.best === "max" ? Math.max(...vals) : Math.min(...vals);
  };

  const colW = `minmax(0, 1fr)`;
  const gridCols = `200px repeat(${stats.length}, ${colW})`;

  return (
    <div className="fade-up" style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Leaderboard */}
      <div className="card" style={{ padding:"20px 22px" }}>
        <CardHead title={t("leaderboard")} sub={t("compare_sub")}/>
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${stats.length}, 1fr)`, gap:14, marginTop:16 }}>
          {ranked.map((x, i) => {
            const medal = ["#f5b932","#b8bcc4","#cd8b54"][i] || "var(--text-3)";
            return (
              <div key={x.id} style={{ position:"relative", border:"1px solid var(--hairline)", borderRadius:16, padding:"16px 16px 14px",
                background: i===0 ? "linear-gradient(180deg, var(--accent-soft), #fff 60%)" : "#fff" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <AppGlyph app={x.id} size={40}/>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{x.a.name}</div>
                    <div style={{ fontSize:12, color:"var(--text-3)" }}>{x.a.platform}</div>
                  </div>
                  <div style={{ marginLeft:"auto", width:24, height:24, borderRadius:"50%", background:medal, color:"#fff",
                    display:"grid", placeItems:"center", fontSize:12, fontWeight:800, flexShrink:0 }}>{i+1}</div>
                </div>
                <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                  <span className="mono" style={{ fontSize:30, fontWeight:700, letterSpacing:"-0.03em" }}>{x.s.health == null ? "—" : x.s.health}</span>
                  {x.s.health != null && <span style={{ fontSize:13, color:"var(--text-3)", fontWeight:600 }}>/100</span>}
                  <span style={{ marginLeft:"auto" }}><TrendDelta value={x.s.trend} size={12.5}/></span>
                </div>
                <Sparkline data={x.s.spark} color={i===0 ? "var(--accent)" : "var(--text-3)"}/>
              </div>
            );
          })}
        </div>
      </div>

      {/* At a glance metric table */}
      <div className="card" style={{ padding:"20px 22px", overflowX:"auto" }}>
        <CardHead title={t("at_a_glance")} sub={t("metric")}/>
        <div style={{ marginTop:14, minWidth: 200 + stats.length*120 }}>
          {/* header */}
          <div style={{ display:"grid", gridTemplateColumns:gridCols, gap:12, padding:"0 0 12px", borderBottom:"1px solid var(--hairline)" }}>
            <div></div>
            {stats.map(x => (
              <div key={x.id} style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"flex-start" }}>
                <AppGlyph app={x.id} size={26}/>
                <span style={{ fontSize:13.5, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{x.a.name}</span>
              </div>
            ))}
          </div>
          {metrics.map((m, mi) => {
            const bv = bestFor(m);
            return (
              <div key={m.key} style={{ display:"grid", gridTemplateColumns:gridCols, gap:12, padding:"12px 0",
                borderBottom: mi < metrics.length-1 ? "1px solid var(--hairline)" : "none", alignItems:"center" }}>
                <div style={{ fontSize:13.5, fontWeight:500, color:"var(--text-2)" }}>{m.label}</div>
	                {stats.map(x => {
	                  const v = m.get(x.s);
	                  const missing = v == null || !Number.isFinite(v);
	                  const isBest = !missing && v === bv;
	                  return (
	                    <div key={x.id} style={{ display:"flex", alignItems:"center", gap:7 }}>
	                      <span className="mono" style={{ fontSize:15, fontWeight:isBest?700:600, color: isBest ? "var(--positive)" : "var(--text)" }}>
	                        {missing ? "—" : m.fmt(v)}{!missing && m.suffix && <span style={{ fontSize:11, color:"var(--text-3)", fontWeight:600 }}>{m.suffix}</span>}
	                      </span>
                      {isBest && <span className="badge badge-positive" style={{ fontSize:10, padding:"1px 6px" }}>{t("best")}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sentiment + Rating distribution */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
        <div className="card" style={{ padding:"20px 22px" }}>
          <CardHead title={t("sentiment_split")}/>
          <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:14 }}>
            {stats.map(x => (
              <div key={x.id}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <AppGlyph app={x.id} size={22}/>
                  <span style={{ fontSize:13, fontWeight:600 }}>{x.a.name}</span>
                </div>
                <div style={{ display:"flex", height:18, borderRadius:6, overflow:"hidden", gap:1.5 }}>
                  <SegBar pct={x.s.sentiment.positive} color="var(--positive)"/>
                  <SegBar pct={x.s.sentiment.neutral} color="#c7c7cc"/>
                  <SegBar pct={x.s.sentiment.negative} color="var(--critical)"/>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:16, marginTop:16, fontSize:12, color:"var(--text-2)", fontWeight:500 }}>
            <Legend color="var(--positive)" label={t("sent_positive")}/>
            <Legend color="#c7c7cc" label={t("sent_neutral")}/>
            <Legend color="var(--critical)" label={t("sent_negative")}/>
          </div>
        </div>

        <div className="card" style={{ padding:"20px 22px" }}>
          <CardHead title={t("rating_dist")}/>
          <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:13 }}>
            {stats.map(x => (
              <div key={x.id} style={{ display:"flex", alignItems:"center", gap:11 }}>
                <AppGlyph app={x.id} size={24}/>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>{x.a.name}</span>
	                    <span className="mono" style={{ fontSize:13, fontWeight:700, color:"#f5a623" }}>★ {x.s.rating == null ? "—" : x.s.rating.toFixed(1)}</span>
                  </div>
                  <div style={{ display:"flex", height:8, borderRadius:4, overflow:"hidden", gap:1.5 }}>
                    {[5,4,3,2,1].map(star => (
                      <SegBar key={star} pct={x.s.stars[star]} color={star>=4?"var(--positive)":star===3?"var(--warning)":"var(--critical)"}/>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- small chart helpers ---------- */
function Sparkline({ data, color }) {
  if (!data || data.length < 2) {
    return <div style={{ height:38, marginTop:10 }}></div>;
  }
  const W = 200, H = 38, min = Math.min(...data) - 2, max = Math.max(...data) + 2;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d - min) / (max - min)) * H;
    return [x, y];
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="38" style={{ display:"block", marginTop:10, overflow:"visible" }} preserveAspectRatio="none">
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.6" fill={color}/>
    </svg>
  );
}
function SegBar({ pct, color }) {
  return <div style={{ width:`${pct}%`, background:color, height:"100%" }} title={`${pct}%`}></div>;
}
function Legend({ color, label }) {
  return <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
    <span style={{ width:9, height:9, borderRadius:2, background:color }}></span>{label}</span>;
}

Object.assign(window, { ComparePage, CompareSelect, CompareResult, Sparkline, SegBar, Legend });
