/* ============ Screen 1: App Selection / Setup — wired to real backend ============ */
function AppSelection({ t, lang, onConfirm, onOpenDashboard, onOpenCrawling, availVersion }) {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("empty"); // empty | searching | results
  const [suggestions, setSuggestions] = useState([]);
  const [confirmed, setConfirmed] = useState(null);
  const [reviewLimit, setReviewLimit] = useState(() => {
    const v = parseInt(localStorage.getItem("arm_review_limit"), 10);
    return [50, 100, 200, 500, 1000].includes(v) ? v : 100;
  });
  const inputRef = useRef(null);

  useEffect(() => { localStorage.setItem("arm_review_limit", String(reviewLimit)); }, [reviewLimit]);

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
      if (res.status === "matched" && res.app) {
        const id = ensureAppSpec(res.app);
        setSuggestions([{ app: id, score: 99, raw: res.app }]);
      } else if ((res.status === "ambiguous" || res.status === "not_found") && res.suggestions && res.suggestions.length) {
        const sugs = res.suggestions.slice(0, 4).map((s, i) => {
          const id = ensureAppSpec(s);
          return { app: id, score: Math.max(50, 95 - i * 15), raw: s };
        });
        setSuggestions(sugs);
      } else {
        setSuggestions([]);
      }
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
  const scrapingApps = allAvailable.filter(r => r.status === "analyzing");
  const available = allAvailable.filter(r => r.status !== "analyzing");

  return (
    <div style={{ maxWidth:1080, margin:"0 auto", padding:"54px 48px 80px" }}>
      {/* Hero search */}
      <div className="fade-up" style={{ textAlign:"center", marginBottom:38 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--accent)", letterSpacing:"0.02em", marginBottom:12, textTransform:"uppercase" }}>{t("s1_eyebrow")}</div>
        <h1 style={{ fontSize:42, fontWeight:700, letterSpacing:"-0.035em", lineHeight:1.05, marginBottom:14 }}>{t("s1_title")}</h1>
        <p style={{ fontSize:17, color:"var(--text-2)", maxWidth:560, margin:"0 auto", lineHeight:1.5 }}>{t("s1_subtitle")}</p>

        <div style={{ display:"flex", gap:10, maxWidth:560, margin:"30px auto 0" }}>
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
          {["ZaloPay","Shopee","MoMo"].map(s => (
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
          <SectionHeader title={t("scraping_title")} sub={t("scraping_sub")}/>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(248px, 1fr))", gap:14 }}>
            {scrapingApps.map((row, i) => {
              const a = window.DATA.APPS[row.app];
              if (!a) return null;
              const done = (row.progress && row.progress.done) || 0;
              const total = (row.progress && row.progress.total) || 0;
              const pct = total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0;
              return (
                <button key={row.app} className="card"
                  onClick={() => onOpenCrawling(row.app)}
                  style={{ padding:18, textAlign:"left", display:"flex", flexDirection:"column", gap:13,
                    borderColor:"var(--accent-soft-2)",
                    animation:`fadeUp .5s cubic-bezier(0.22,0.61,0.36,1) ${i*0.05}s both`,
                    transition:"transform .18s ease, box-shadow .18s, border-color .18s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="var(--shadow-md)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="var(--shadow-sm)"; }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                    <div style={{ position:"relative" }}>
                      <AppGlyph app={row.app} size={46}/>
                      <div style={{ position:"absolute", inset:-4, borderRadius:"30%", border:"2px solid var(--accent-soft-2)", animation:"pulse 1.8s ease-in-out infinite" }}></div>
                    </div>
                    <span className="badge" style={{ display:"inline-flex", alignItems:"center", gap:6, background:"var(--accent-soft)", color:"var(--accent)", fontWeight:600 }}>
                      <span className="spinner" style={{ width:11, height:11, borderColor:"var(--accent-soft-2)", borderTopColor:"var(--accent)" }}></span>
                      {t("status_scraping")}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:600 }}>{a.name}</div>
                    <div style={{ fontSize:12.5, color:"var(--text-3)", marginTop:3 }}>
                      {total > 0 ? `${done.toLocaleString()} / ${total.toLocaleString()} ${t("reviews_word")}` : t("s2_eyebrow")}
                    </div>
                  </div>
                  <div style={{ height:5, borderRadius:5, background:"rgba(0,0,0,0.06)", overflow:"hidden" }}>
                    <div style={{ width:`${pct}%`, height:"100%", borderRadius:5, background:"linear-gradient(90deg,#0a84ff,#0071e3)", transition:"width .4s linear" }}></div>
                  </div>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:13, fontWeight:600, color:"var(--accent)" }}>
                    {t("view_status")}<Icon name="chevron" size={15} stroke={2.2}/>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Available apps */}
      {available.length > 0 && (
        <>
          <SectionHeader title={t("available")} sub={t("available_sub")}/>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(248px, 1fr))", gap:14 }}>
            {available.map((row, i) => {
              const a = window.DATA.APPS[row.app];
              if (!a) return null;
              return (
                <button key={row.app} className="card"
                  onClick={() => onOpenDashboard(row.app)}
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
                      {row.lastUpdated != null && row.lastUpdated < 999
                        ? (row.lastUpdated < 60 ? `${row.lastUpdated}${t("min_ago")}` : `${Math.round(row.lastUpdated/60)}${t("hour_ago")}`)
                        : "—"}
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", borderTop:"1px solid var(--hairline)", paddingTop:12 }}>
                    <div>
                      <div className="mono" style={{ fontSize:19, fontWeight:700, letterSpacing:"-0.02em" }}>
                        {row.totalReviews > 0 ? row.totalReviews.toLocaleString() : "—"}
                      </div>
                      <div style={{ fontSize:11.5, color:"var(--text-3)", fontWeight:500 }}>{t("total_reviews")}</div>
                    </div>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:13, fontWeight:600, color:"var(--accent)" }}>
                      {t("open_dashboard")}<Icon name="chevron" size={15} stroke={2.2}/>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {available.length === 0 && scrapingApps.length === 0 && phase === "empty" && (
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

Object.assign(window, { AppSelection, SectionHeader, SimilarityMeter });
