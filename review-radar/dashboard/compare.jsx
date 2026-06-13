/* ============ App Comparison ============ */
function ComparePage({ t }) {
  const [selected, setSelected] = useState(["zalopay", "momo", "grab"]);
  const [phase, setPhase] = useState("select"); // select | result
  const apps = window.DATA.AVAILABLE.map(r => r.app);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

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
            <button className="btn btn-primary"><Icon name="download" size={16}/>{t("export_compare")}</button>
          </div>
        )}
      </div>

      {phase === "select"
        ? <CompareSelect t={t} apps={apps} selected={selected} toggle={toggle} onCompare={() => setPhase("result")}/>
        : <CompareResult t={t} selected={selected}/>}
    </div>
  );
}

function CompareSelect({ t, apps, selected, toggle, onCompare }) {
  return (
    <div className="fade-up">
      <div style={{ marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.02em" }}>{t("compare_select_title")}</h2>
        <p style={{ fontSize:14, color:"var(--text-2)", marginTop:2 }}>{t("compare_select_sub")}</p>
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
        <button className="btn btn-primary" disabled={selected.length < 2} onClick={onCompare}>
          <Icon name="chart" size={16}/>{t("compare_cta")} {selected.length >= 2 ? `(${selected.length})` : `· ${t("compare_min")}`}
        </button>
      </div>
    </div>
  );
}

function CompareResult({ t, selected }) {
  const stats = selected.map(id => ({ id, a: window.DATA.APPS[id], s: window.DATA.COMPARE[id] }));
  // ranking by health
  const ranked = [...stats].sort((x, y) => y.s.health - x.s.health);

  const metrics = [
    { key:"health",   label:t("m_health"),   get:s=>s.health, fmt:v=>v, suffix:"/100", best:"max" },
    { key:"rating",   label:t("m_rating"),   get:s=>s.rating, fmt:v=>v.toFixed(1), best:"max" },
    { key:"total",    label:t("m_total"),    get:s=>s.totalReviews, fmt:v=>v.toLocaleString(), best:"max" },
    { key:"today",    label:t("m_today"),    get:s=>s.today, fmt:v=>v.toLocaleString(), best:"max" },
    { key:"critical", label:t("m_critical"), get:s=>s.critical, fmt:v=>v, best:"min" },
    { key:"positive", label:t("m_positive"), get:s=>s.sentiment.positive, fmt:v=>v+"%", best:"max" },
  ];
  const bestFor = (m) => {
    const vals = stats.map(x => m.get(x.s));
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
                  <span className="mono" style={{ fontSize:30, fontWeight:700, letterSpacing:"-0.03em" }}>{x.s.health}</span>
                  <span style={{ fontSize:13, color:"var(--text-3)", fontWeight:600 }}>/100</span>
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
                  const isBest = v === bv;
                  return (
                    <div key={x.id} style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <span className="mono" style={{ fontSize:15, fontWeight:isBest?700:600, color: isBest ? "var(--positive)" : "var(--text)" }}>
                        {m.fmt(v)}{m.suffix && <span style={{ fontSize:11, color:"var(--text-3)", fontWeight:600 }}>{m.suffix}</span>}
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
                    <span className="mono" style={{ fontSize:13, fontWeight:700, color:"#f5a623" }}>★ {x.s.rating.toFixed(1)}</span>
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
