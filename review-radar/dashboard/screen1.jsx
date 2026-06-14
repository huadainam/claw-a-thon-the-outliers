/* ============ Screen 1: App Selection / Setup — wired to real backend ============ */
function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .trim();
}

const REVIEW_LIMIT_STORAGE_KEY = "arm_review_limit_v2";

function AppSelection({ t, lang, onConfirm, onOpenDashboard, onOpenCrawling, availVersion }) {
  const [query, setQuery] = useState("");
  const [availableQuery, setAvailableQuery] = useState("");
  const [phase, setPhase] = useState("empty"); // empty | searching | results
  const [suggestions, setSuggestions] = useState([]);
  const [confirmed, setConfirmed] = useState(null);
  const [reviewLimit, setReviewLimit] = useState(() => {
    const v = parseInt(localStorage.getItem(REVIEW_LIMIT_STORAGE_KEY), 10);
    return [50, 100, 200, 500, 1000].includes(v) ? v : 100;
  });
  const inputRef = useRef(null);

  useEffect(() => { localStorage.setItem(REVIEW_LIMIT_STORAGE_KEY, String(reviewLimit)); }, [reviewLimit]);

  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

  function ensureAppSpec(rawApp) {
    const id = rawApp.app_id || rawApp.gp_id || rawApp.as_id
      || (rawApp.title || "").toLowerCase().replace(/[\s.]+/g, "_");
    if (!window.DATA.APPS[id]) {
      const name   = rawApp.title || id;
      const stores = rawApp.stores || [];
      const platform = stores.includes("app_store") && stores.includes("google_play")
        ? "App Store & Google Play"
        : stores.includes("app_store") ? "App Store"
        : stores.includes("google_play") ? "Google Play"
        : "Unknown";
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
      const grads = [["#0a84ff","#0058c8"],["#34c759","#248a3d"],["#ff375f","#c0002a"],
                     ["#ff9f0a","#c07000"],["#af52de","#7a1fa2"],["#32ade6","#1d7ea8"]];
      const grad = grads[Math.abs(hash) % grads.length];
      window.DATA.APPS[id] = { id, name, logo: rawApp.icon || "", glyph: name.slice(0, 2).toUpperCase(), grad, publisher: rawApp.developer || "", platform };
    }
    return id;
  }

  const doSearch = (q) => {
    if (!q || !q.trim()) return;
    setPhase("searching");
    setSuggestions([]);
    window.ARM_Bridge.resolve(q.trim()).then(res => {
      // Build a candidate list: the confident match (if any) first, then the
      // other suggestions. Many queries (e.g. "MoMo") map to several distinct
      // apps, so always offer alternatives instead of a single auto-pick.
      const matched = res.status === "matched" && res.app ? res.app : null;
      const key = a => (a.gp_id || "") + "|" + (a.as_id || "") + "|" + (a.title || "");
      const list = [];
      const seen = new Set();
      [matched, ...(res.suggestions || [])].forEach(a => {
        if (a && !seen.has(key(a))) { seen.add(key(a)); list.push(a); }
      });
      const sugs = list.slice(0, 6).map((s, i) => {
        const id = ensureAppSpec(s);
        const score = (matched && i === 0) ? 99 : Math.max(50, 95 - i * 10);
        return { app: id, score, raw: s };
      });
      setSuggestions(sugs);
      setPhase("results");
    }).catch(() => {
      setSuggestions([]);
      setPhase("results");
    });
  };

  const runSearch = () => doSearch(query);
  // availVersion is referenced so a status refresh from the parent re-renders
  // this screen (scraping apps appear/finish) without remounting / losing search.
  void availVersion;
  const allAvailable = window.DATA.AVAILABLE || [];
  const isBusyStatus = status => status === "analyzing" || status === "queued";
  const scrapingApps = allAvailable.filter(r => isBusyStatus(r.status)).slice().sort((a, b) => {
    if (a.status === "analyzing" && b.status !== "analyzing") return -1;
    if (a.status !== "analyzing" && b.status === "analyzing") return 1;
    const ap = a.queuePosition || 9999;
    const bp = b.queuePosition || 9999;
    if (ap !== bp) return ap - bp;
    return String(a.app || "").localeCompare(String(b.app || ""));
  });
  const hasQueuedApps = scrapingApps.some(r => r.status === "queued");
  const availableApps = allAvailable.filter(r => !isBusyStatus(r.status));
  const availableTerms = normalizeSearchText(availableQuery).split(/\s+/).filter(Boolean);
  const available = availableTerms.length === 0 ? availableApps : availableApps.filter(row => {
    const a = window.DATA.APPS[row.app] || {};
    const haystack = normalizeSearchText([
      row.app,
      a.name,
      a.publisher,
      a.platform,
      row.health,
    ].join(" "));
    return availableTerms.every(term => haystack.includes(term));
  });

  return (
    <div style={{ maxWidth:1080, margin:"0 auto", padding:"54px 48px 80px" }}>
      {/* Hero search */}
      <div className="fade-up" style={{ textAlign:"center", marginBottom:38 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--accent)", letterSpacing:"0.02em", marginBottom:12, textTransform:"uppercase" }}>{t("s1_eyebrow")}</div>
        <h1 style={{ fontSize:42, fontWeight:700, letterSpacing:"-0.035em", lineHeight:1.05, marginBottom:14 }}>{t("s1_title")}</h1>
        <p style={{ fontSize:17, color:"var(--text-2)", maxWidth:560, margin:"0 auto", lineHeight:1.5 }}>{t("s1_subtitle")}</p>
        <div style={{
          display:"inline-flex", alignItems:"center", gap:7, margin:"16px auto 0",
          padding:"7px 12px", borderRadius:999, background:"rgba(0,0,0,0.045)",
          color:"var(--text-2)", fontSize:13, fontWeight:650
        }}>
          <Icon name="monitor" size={15} style={{ color:"var(--accent)" }}/>
          <span>{t("desktop_notice")}</span>
        </div>

        <div style={{ display:"flex", gap:10, maxWidth:560, margin:"22px auto 0" }}>
          <div style={{ flex:1, position:"relative", display:"flex", alignItems:"center" }}>
            <Icon name="search" size={19} style={{ position:"absolute", left:17, color:"var(--text-3)" }}/>
            <input ref={inputRef} value={query}
              onChange={e => { setQuery(e.target.value); if (phase === "results") setPhase("empty"); }}
              onKeyDown={e => e.key === "Enter" && runSearch()}
              placeholder={t("s1_placeholder")}
              style={{ width:"100%", padding:"15px 16px 15px 46px", fontSize:16, borderRadius:14,
                border:"1px solid var(--hairline-strong)", background:"#fff", outline:"none",
                boxShadow:"var(--shadow-sm)", transition:"box-shadow .15s, border-color .15s", letterSpacing:"-0.01em" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 4px var(--accent-soft)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--hairline-strong)"; e.target.style.boxShadow = "var(--shadow-sm)"; }}/>
          </div>
          <button className="btn btn-primary" style={{ padding:"0 24px", fontSize:15.5 }} onClick={runSearch} disabled={!query.trim()}>{t("s1_find")}</button>
        </div>
        <div style={{ marginTop:14, display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
          {["Zalopay","Shopee","MoMo"].map(s => (
            <button key={s} onClick={() => { setQuery(s); doSearch(s); }}
              style={{ fontSize:13, fontWeight:600, color:"var(--text-2)", background:"rgba(0,0,0,0.04)", padding:"5px 12px", borderRadius:980 }}>{s}</button>
          ))}
        </div>

        {/* Review-count selector */}
        <div style={{ marginTop:26, maxWidth:560, marginLeft:"auto", marginRight:"auto" }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--text-2)", marginBottom:9 }}>{t("review_count_label")}</div>
          <div style={{ display:"inline-flex", gap:4, padding:4, background:"rgba(0,0,0,0.04)", borderRadius:12 }}>
            {[50,100,200,500,1000].map(n => {
              const sel = reviewLimit === n;
              return (
                <button key={n} onClick={() => setReviewLimit(n)}
                  style={{ fontSize:13.5, fontWeight:600, padding:"7px 15px", borderRadius:9,
                    color: sel ? "#fff" : "var(--text-2)",
                    background: sel ? "var(--accent)" : "transparent",
                    boxShadow: sel ? "var(--shadow-sm)" : "none", transition:"background .15s, color .15s" }}>{n}</button>
              );
            })}
          </div>
          <div style={{ fontSize:12.5, color:"var(--text-3)", marginTop:9, display:"flex", alignItems:"center", gap:6, justifyContent:"center" }}>
            <Icon name="clock" size={13}/>
            <span>{t("review_count_note")}</span>
          </div>
        </div>
      </div>

      {/* Searching skeleton */}
      {phase === "searching" && (
        <>
          <SectionHeader title={t("suggested")} sub={t("searching")}/>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:44 }}>
            {[0,1,2].map(i => (
              <div key={i} className="card" style={{ display:"flex", alignItems:"center", gap:16, padding:"16px 18px" }}>
                <div className="skeleton" style={{ width:48, height:48, borderRadius:11 }}></div>
                <div style={{ flex:1 }}>
                  <div className="skeleton" style={{ width:140, height:15, marginBottom:8 }}></div>
                  <div className="skeleton" style={{ width:200, height:12 }}></div>
                </div>
                <div className="skeleton" style={{ width:90, height:34, borderRadius:980 }}></div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Results */}
      {phase === "results" && (
        <div className="fade-up">
          <SectionHeader title={t("suggested")} sub={suggestions.length ? t("suggested_sub") : t("empty_sub")}/>
          {suggestions.length > 0 ? (
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:46 }}>
              {suggestions.map((s, i) => {
                const a = window.DATA.APPS[s.app];
                if (!a) return null;
                const isConfirmed = confirmed === s.app;
                return (
                  <div key={s.app} className="card" style={{ display:"flex", alignItems:"center", gap:16, padding:"15px 18px",
                    animation:`fadeUp .45s cubic-bezier(0.22,0.61,0.36,1) ${i*0.06}s both`,
                    borderColor: isConfirmed ? "var(--accent)" : "var(--hairline)",
                    boxShadow: isConfirmed ? "0 0 0 3px var(--accent-soft), var(--shadow-sm)" : "var(--shadow-sm)",
                    transition:"box-shadow .2s, border-color .2s" }}>
                    <AppGlyph app={s.app} size={48}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:16, fontWeight:600, letterSpacing:"-0.01em" }}>{a.name}</div>
                      <div style={{ fontSize:13.5, color:"var(--text-2)", display:"flex", alignItems:"center", gap:8, marginTop:2 }}>
                        <span>{a.publisher}</span>
                        <span style={{ width:3, height:3, borderRadius:"50%", background:"var(--text-3)" }}></span>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}><Icon name="globe" size={13}/>{a.platform}</span>
                      </div>
                    </div>
                    <SimilarityMeter score={s.score} t={t}/>
                    {isConfirmed ? (
                      <button className="btn btn-secondary btn-sm" style={{ minWidth:104, color:"var(--positive)" }} disabled>
                        <Icon name="check" size={15} stroke={2.4}/>{t("confirmed")}</button>
                    ) : (
                      <button className="btn btn-primary btn-sm" style={{ minWidth:104 }}
                        onClick={() => { setConfirmed(s.app); setTimeout(() => onConfirm(s.raw || s.app, reviewLimit), 480); }}>{t("confirm")}</button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card" style={{ padding:"40px 22px", textAlign:"center", color:"var(--text-3)", marginBottom:40 }}>
              <Icon name="search" size={28} style={{ marginBottom:10 }}/>
              <div style={{ fontSize:15, fontWeight:500, marginBottom:4 }}>{t("empty_title")}</div>
              <p style={{ fontSize:13.5, lineHeight:1.5 }}>{t("empty_sub")}</p>
            </div>
          )}
        </div>
      )}

      {/* Currently scraping */}
      {scrapingApps.length > 0 && (
        <div className="fade-up" style={{ marginBottom:30 }}>
          <SectionHeader title={hasQueuedApps ? t("queue_title") : t("scraping_title")} sub={hasQueuedApps ? t("queue_sub") : t("scraping_sub")}/>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(248px, 1fr))", gap:14 }}>
            {scrapingApps.map((row, i) => {
              const a = window.DATA.APPS[row.app];
              if (!a) return null;
              const isQueued = row.status === "queued";
              const done = (row.progress && row.progress.done) || 0;
              const total = (row.progress && row.progress.total) || 0;
              const pct = total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0;
              const queueRank = row.queuePosition != null ? row.queuePosition : null;
              const statusLabel = isQueued
                ? `${t("status_queued")}${queueRank ? ` #${queueRank}` : ""}`
                : t("status_scraping");
              const detailLabel = isQueued
                ? (queueRank ? `${t("queue_position")} ${queueRank} · ${t("queue_next")}` : t("queue_starting"))
                : (total > 0 ? `${done.toLocaleString()} / ${total.toLocaleString()} ${t("reviews_word")}` : t("s2_eyebrow"));
              const hourlyEnabled = row.hourlyRefreshEnabled !== false;
              return (
                <button key={row.app} className="card"
                  onClick={() => onOpenCrawling(row.app)}
                  style={{ padding:18, textAlign:"left", display:"flex", flexDirection:"column", gap:13,
                    borderColor:isQueued ? "var(--warning-soft)" : "var(--accent-soft-2)",
                    animation:`fadeUp .5s cubic-bezier(0.22,0.61,0.36,1) ${i*0.05}s both`,
                    transition:"transform .18s ease, box-shadow .18s, border-color .18s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="var(--shadow-md)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="var(--shadow-sm)"; }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                    <div style={{ position:"relative" }}>
                      <AppGlyph app={row.app} size={46}/>
                      {!isQueued && <div style={{ position:"absolute", inset:-4, borderRadius:"30%", border:"2px solid var(--accent-soft-2)", animation:"pulse 1.8s ease-in-out infinite" }}></div>}
                    </div>
                    <span className="badge" style={{ display:"inline-flex", alignItems:"center", gap:6,
                      background:isQueued ? "var(--warning-soft)" : "var(--accent-soft)",
                      color:isQueued ? "var(--warning)" : "var(--accent)", fontWeight:600 }}>
                      {isQueued
                        ? <Icon name="clock" size={12} stroke={2.1}/>
                        : <span className="spinner" style={{ width:11, height:11, borderColor:"var(--accent-soft-2)", borderTopColor:"var(--accent)" }}></span>}
                      {statusLabel}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:600 }}>{a.name}</div>
                    <div style={{ fontSize:12.5, color:"var(--text-3)", marginTop:3 }}>
                      {detailLabel}
                    </div>
                  </div>
                  <div style={{ height:5, borderRadius:5, background:"rgba(0,0,0,0.06)", overflow:"hidden" }}>
                    <div style={{ width:isQueued ? "0%" : `${pct}%`, height:"100%", borderRadius:5, background:"linear-gradient(90deg,#0a84ff,#0071e3)", transition:"width .4s linear" }}></div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                    <HourlyRefreshInfo t={t} enabled={hourlyEnabled} style={{ marginTop:0, flex:1 }}/>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:13, fontWeight:600, color:"var(--accent)" }}>
                      {t("view_status")}<Icon name="chevron" size={15} stroke={2.2}/>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Available apps */}
      {availableApps.length > 0 && (
        <>
          <div id="apps-gallery" style={{ scrollMarginTop: 12 }}></div>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:16, flexWrap:"wrap", marginBottom:16 }}>
            <div>
              <h2 style={{ fontSize:21, fontWeight:700, letterSpacing:"-0.025em" }}>{t("available")}</h2>
              <p style={{ fontSize:14, color:"var(--text-2)", marginTop:2 }}>{t("available_sub")}</p>
            </div>
            <div style={{ position:"relative", flex:"0 1 360px", width:"min(100%, 360px)", display:"flex", alignItems:"center" }}>
              <Icon name="search" size={16} style={{ position:"absolute", left:13, color:"var(--text-3)", pointerEvents:"none" }}/>
              <input value={availableQuery}
                onChange={e => setAvailableQuery(e.target.value)}
                placeholder={t("available_search_placeholder")}
                style={{ width:"100%", height:40, padding:"0 40px 0 38px", borderRadius:11,
                  border:"1px solid var(--hairline-strong)", background:"#fff", outline:"none",
                  boxShadow:"var(--shadow-sm)", color:"var(--text)", fontSize:14, fontWeight:500,
                  transition:"box-shadow .15s, border-color .15s" }}
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 4px var(--accent-soft)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--hairline-strong)"; e.target.style.boxShadow = "var(--shadow-sm)"; }}/>
              {availableQuery && (
                <button onClick={() => setAvailableQuery("")} title={t("clear_search")} aria-label={t("clear_search")}
                  style={{ position:"absolute", right:7, width:28, height:28, borderRadius:8, display:"grid", placeItems:"center",
                    color:"var(--text-3)", background:"rgba(0,0,0,0.04)" }}>
                  <Icon name="x" size={14} stroke={2.1}/>
                </button>
              )}
            </div>
          </div>
          {available.length > 0 ? (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(248px, 1fr))", gap:14 }}>
              {available.map((row, i) => {
              const a = window.DATA.APPS[row.app];
              if (!a) return null;
              const needsCrawl = (row.totalReviews || 0) === 0 && (row.lastUpdated == null || row.lastUpdated >= 999);
              const hourlyEnabled = row.hourlyRefreshEnabled !== false;
              return (
                <button key={row.app} className="card"
                  onClick={() => needsCrawl ? onOpenCrawling(row.app, true) : onOpenDashboard(row.app)}
                  style={{ padding:18, textAlign:"left", display:"flex", flexDirection:"column", gap:14,
                    animation:`fadeUp .5s cubic-bezier(0.22,0.61,0.36,1) ${i*0.05}s both`,
                    transition:"transform .18s ease, box-shadow .18s, border-color .18s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="var(--shadow-md)"; e.currentTarget.style.borderColor="var(--hairline-strong)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="var(--shadow-sm)"; e.currentTarget.style.borderColor="var(--hairline)"; }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                    <AppGlyph app={row.app} size={46}/>
                    <HealthBadge health={row.health || "positive"} t={t}/>
                  </div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:600 }}>{a.name}</div>
                    <div style={{ fontSize:12.5, color:"var(--text-3)", display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                      <Icon name="clock" size={12.5}/>
                      {formatCrawlTimestamp(row.lastUpdatedAt, t)}
                    </div>
                    <HourlyRefreshInfo t={t} enabled={hourlyEnabled}/>
                  </div>
                  <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", borderTop:"1px solid var(--hairline)", paddingTop:12 }}>
                    <div>
                      <div className="mono" style={{ fontSize:19, fontWeight:700, letterSpacing:"-0.02em" }}>
                        {row.totalReviews > 0 ? row.totalReviews.toLocaleString() : "—"}
                      </div>
                      <div style={{ fontSize:11.5, color:"var(--text-3)", fontWeight:500 }}>{t("total_reviews")}</div>
                    </div>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:13, fontWeight:600, color:"var(--accent)" }}>
                      {needsCrawl ? t("start_crawl") : t("open_dashboard")}<Icon name="chevron" size={15} stroke={2.2}/>
                    </span>
                  </div>
                </button>
              );
              })}
            </div>
          ) : (
            <div className="card fade-in" style={{ padding:"34px 22px", textAlign:"center", color:"var(--text-3)" }}>
              <Icon name="search" size={28} style={{ marginBottom:10, opacity:0.5 }}/>
              <div style={{ fontSize:15, fontWeight:600, color:"var(--text-2)", marginBottom:4 }}>{t("available_no_results")}</div>
              <p style={{ fontSize:13.5, lineHeight:1.5 }}>{t("available_no_results_sub")}</p>
            </div>
          )}
        </>
      )}

      {availableApps.length === 0 && scrapingApps.length === 0 && phase === "empty" && (
        <div className="fade-in" style={{ textAlign:"center", padding:"48px 0 40px", color:"var(--text-3)" }}>
          <Icon name="search" size={34} style={{ marginBottom:14, opacity:0.4 }}/>
          <div style={{ fontSize:16, fontWeight:500, marginBottom:4 }}>{t("empty_title")}</div>
          <p style={{ fontSize:14, lineHeight:1.5 }}>{t("empty_sub")}</p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom:16 }}>
      <h2 style={{ fontSize:21, fontWeight:700, letterSpacing:"-0.025em" }}>{title}</h2>
      {sub && <p style={{ fontSize:14, color:"var(--text-2)", marginTop:2 }}>{sub}</p>}
    </div>
  );
}

function HourlyRefreshInfo({ t, enabled, style }) {
  return (
    <div style={{ marginTop:9, display:"flex", flexDirection:"column", alignItems:"flex-start", gap:4, minWidth:0, ...style }}>
      <span style={{ display:"inline-flex", alignItems:"center", gap:5,
        padding:"5px 9px", borderRadius:999, fontSize:11.5, fontWeight:700,
        color: enabled ? "var(--accent)" : "var(--text-3)",
        background: enabled ? "var(--accent-soft)" : "rgba(0,0,0,0.055)" }}>
        <Icon name="refresh" size={12} stroke={2}/>
        {enabled ? t("hourly_on") : t("hourly_off")}
      </span>
      <span style={{ fontSize:11.5, lineHeight:1.35, color:"var(--text-3)" }}>
        {t("hourly_admin_contact")}
      </span>
    </div>
  );
}

function SimilarityMeter({ score, t }) {
  const tone = score >= 85 ? "var(--positive)" : score >= 65 ? "var(--warning)" : "var(--text-3)";
  return (
    <div style={{ textAlign:"right", minWidth:84 }}>
      <div className="mono" style={{ fontSize:18, fontWeight:700, color:tone, letterSpacing:"-0.02em" }}>{score}%</div>
      <div style={{ fontSize:11, color:"var(--text-3)", fontWeight:600, marginBottom:4 }}>{t("similarity")}</div>
      <div style={{ width:84, height:4, borderRadius:3, background:"rgba(0,0,0,0.07)", overflow:"hidden" }}>
        <div style={{ width:`${score}%`, height:"100%", background:tone, borderRadius:3, transition:"width .6s ease" }}></div>
      </div>
    </div>
  );
}

Object.assign(window, { AppSelection, SectionHeader, HourlyRefreshInfo, SimilarityMeter });
