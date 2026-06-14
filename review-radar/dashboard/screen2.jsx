/* ============ Screen 2: Crawling / Processing State — polls real backend ============ */
function Crawling({ t, app, onDone, onBack, onOpenDashboard }) {
  const STEPS = ["confirmed", "crawling", "categorizing", "building"];
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [counts, setCounts] = useState({ done: 0, total: 0 });  // reviews classified / total
  const [queueInfo, setQueueInfo] = useState(null);
  const [hasExistingData, setHasExistingData] = useState(() => {
    const row = (window.DATA.AVAILABLE || []).find(r => r.app === app);
    return ((row && row.totalReviews) || 0) > 0;
  });
  const [notified, setNotified] = useState(false);
  const a = window.DATA.APPS[app] || { name: app };

  useEffect(() => {
    let cancelled = false;
    let seenAnalyzing = false;
    let idleBeforeStart = 0;

    const poll = async () => {
      if (cancelled) return;
      try {
        const meta = await window.ARM_Bridge.getCrawlProgress(app);
        const done  = (meta.progress && meta.progress.done)  || 0;
        const total = (meta.progress && meta.progress.total) || 0;
        setHasExistingData((meta.total_reviews || 0) > 0);

        if (meta.status === "queued") {
          setQueueInfo({ position: meta.queue_position, waitingCount: meta.queue_waiting_count });
          setActive(1);
          setProgress(0);
        } else if (meta.status === "analyzing") {
          // Scraping is done by the time the backend reports "analyzing";
          // done/total is the live classification progress.
          seenAnalyzing = true;
          idleBeforeStart = 0;
          setQueueInfo(null);
          setCounts({ done, total });
          if (total > 0 && done >= total) {
            setActive(3); setProgress(100);              // all classified → building dashboard
          } else {
            setActive(2);                                // classifying reviews
            setProgress(total > 0 ? Math.round(done / total * 100) : 0);
          }
        } else if (meta.status === "idle") {
          setQueueInfo(null);
          if (!seenAnalyzing && done === 0 && total === 0 && idleBeforeStart < 3) {
            idleBeforeStart += 1;
            setActive(1);
            setProgress(100);
            if (!cancelled) setTimeout(poll, 2000);
            return;
          }
          setActive(3);
          setProgress(100);
          if (seenAnalyzing) setCounts(c => ({ done: c.total || c.done, total: c.total }));
          if (!cancelled) onDone();
          return;
        } else if (!seenAnalyzing) {
          setQueueInfo(null);
          setActive(1); setProgress(100);                // still collecting reviews
        }

        if (!cancelled) setTimeout(poll, 2000);
      } catch(e) {
        if (!cancelled) setTimeout(poll, 3000);
      }
    };

    // Immediately show "confirmed" step as done, then start polling
    setActive(0); setProgress(0);
    const t1 = setTimeout(() => { setActive(0); setProgress(100); }, 600);
    const t2 = setTimeout(poll, 1400);

    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2); };
  }, [app]);

  const totalProgress = ((active + progress / 100) / STEPS.length) * 100;
  const canOpenDashboard = active >= 2 || hasExistingData;
  const isWaitingWithExistingData = active < 2 && hasExistingData;
  const openDashboardNow = () => {
    setActive(3);
    setProgress(100);
    if (onOpenDashboard) onOpenDashboard(app);
    else onDone();
  };

  return (
    <div style={{ maxWidth:720, margin:"0 auto", padding:"72px 48px 80px", minHeight:"100%", display:"flex", flexDirection:"column", justifyContent:"center" }}>
      <div className="scale-in">
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--accent)", letterSpacing:"0.02em", marginBottom:18, textTransform:"uppercase" }}>{t("s2_eyebrow")}</div>
          <div style={{ display:"inline-flex", flexDirection:"column", alignItems:"center", gap:16 }}>
            <div style={{ position:"relative" }}>
              <AppGlyph app={app} size={84} fontSize={40}/>
              <div style={{ position:"absolute", inset:-6, borderRadius:"26%", border:"2px solid var(--accent-soft-2)",
                animation:"pulse 1.8s ease-in-out infinite" }}></div>
            </div>
            <div>
              <div style={{ fontSize:14, color:"var(--text-2)", marginBottom:4 }}>{t("s2_title")}</div>
              <h1 style={{ fontSize:30, fontWeight:700, letterSpacing:"-0.03em" }}>{a.name}</h1>
            </div>
          </div>
        </div>

        {/* Overall progress bar */}
        <div style={{ marginBottom:30 }}>
          <div style={{ height:6, borderRadius:6, background:"rgba(0,0,0,0.06)", overflow:"hidden" }}>
            <div style={{ width:`${totalProgress}%`, height:"100%", borderRadius:6,
              background:"linear-gradient(90deg,#0a84ff,#0071e3)", transition:"width .4s linear" }}></div>
          </div>
        </div>

        {/* Stepper */}
        <div className="card" style={{ padding:"10px 8px", marginBottom:22 }}>
          {STEPS.map((s, i) => {
            const done = i < active, current = i === active;
            return (
              <div key={s} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px",
                borderBottom: i < STEPS.length-1 ? "1px solid var(--hairline)" : "none" }}>
                <div style={{ width:30, height:30, borderRadius:"50%", flexShrink:0, display:"grid", placeItems:"center",
                  background: done ? "var(--positive)" : current ? "var(--accent)" : "rgba(0,0,0,0.06)",
                  color: (done||current) ? "#fff" : "var(--text-3)", transition:"background .3s",
                  boxShadow: current ? "0 0 0 5px var(--accent-soft)" : "none" }}>
                  {done ? <Icon name="check" size={16} stroke={2.6}/>
                    : current ? <div className="spinner" style={{ width:15, height:15, borderColor:"rgba(255,255,255,0.4)", borderTopColor:"#fff" }}></div>
                    : <span style={{ fontSize:13, fontWeight:700 }}>{i+1}</span>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:600, color: (done||current) ? "var(--text)" : "var(--text-3)" }}>{t("step_"+s)}</div>
                  <div style={{ fontSize:13, color:"var(--text-3)", marginTop:1 }}>{t("step_"+s+"_d")}</div>
                </div>
                {current && i === 2 && counts.total > 0 && (
                  <div className="mono fade-in" style={{ fontSize:13, fontWeight:700, color:"var(--accent)", whiteSpace:"nowrap" }}>
                    {counts.done.toLocaleString()}/{counts.total.toLocaleString()}
                    <span style={{ fontWeight:500, color:"var(--text-3)" }}> · {Math.round(progress)}%</span>
                  </div>
                )}
                {done && <span className="badge badge-positive" style={{fontSize:11}}>✓</span>}
              </div>
            );
          })}
        </div>

        {queueInfo && (
          <div className="card fade-in" style={{ padding:"13px 16px", marginBottom:18, display:"flex", alignItems:"center", gap:10,
            borderColor:"var(--warning-soft)", background:"var(--warning-soft)", color:"var(--warning)" }}>
            <Icon name="clock" size={17} stroke={2.1}/>
            <div style={{ fontSize:13.5, fontWeight:600, lineHeight:1.35 }}>
              <div>
                {queueInfo.position ? `${t("status_queued")} #${queueInfo.position}` : t("queue_starting")}
                <span style={{ fontWeight:500 }}> · {t("queue_next")}</span>
              </div>
              {hasExistingData && (
                <div style={{ fontWeight:500, color:"var(--text-2)", marginTop:2 }}>{t("queued_existing_data")}</div>
              )}
            </div>
          </div>
        )}

        <p style={{ fontSize:13.5, color:"var(--text-3)", textAlign:"center", lineHeight:1.5, maxWidth:480, margin:"6px auto 26px" }}>{t("s2_note")}</p>

        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button className="btn btn-secondary" onClick={onBack}><Icon name="arrowLeft" size={16}/>{t("back_apps")}</button>
          <button className={`btn ${notified ? "btn-secondary" : "btn-primary"}`} onClick={() => setNotified(true)}>
            <Icon name="bell" size={16}/>{notified ? "✓ " : ""}{t("notify")}</button>
          {canOpenDashboard && (
            <button className="btn btn-primary fade-in" onClick={openDashboardNow}>
              {isWaitingWithExistingData ? t("open_existing_dashboard") : t("skip_now")}<Icon name="chevron" size={16} stroke={2.2}/></button>
          )}
        </div>
        {canOpenDashboard && (
          <p className="fade-in" style={{ fontSize:12.5, color:"var(--text-3)", textAlign:"center", marginTop:12 }}>
            {isWaitingWithExistingData ? t("existing_dashboard_hint") : t("skip_hint")}
          </p>
        )}
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, accent, small }) {
  return (
    <div className="card" style={{ padding:"13px 15px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, color:"var(--text-3)", marginBottom:7 }}>
        <Icon name={icon} size={14}/>
        <span style={{ fontSize:11.5, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.02em" }}>{label}</span>
      </div>
      <div className={accent ? "mono" : ""} style={{ fontSize: small ? 14 : 20, fontWeight:700, letterSpacing:"-0.02em",
        color: accent ? "var(--accent)" : "var(--text)", lineHeight:1.2 }}>{value}</div>
    </div>
  );
}

Object.assign(window, { Crawling, StatBox });
