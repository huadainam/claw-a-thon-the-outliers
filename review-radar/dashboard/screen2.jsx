/* ============ Screen 2: Crawling / Processing State — polls real backend ============ */
function Crawling({ t, app, onDone, onBack }) {
  const STEPS = ["confirmed", "crawling", "categorizing", "building"];
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [collected, setCollected] = useState(0);
  const [notified, setNotified] = useState(false);
  const [estSec, setEstSec] = useState(null);   // null until a real measurement exists
  const a = window.DATA.APPS[app] || { name: app };
  // Anchor for an adaptive ETA: measured throughput (reviews/sec), not a guess.
  const rateAnchor = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let seenAnalyzing = false;
    let pollCount = 0;
    rateAnchor.current = null;
    setEstSec(null);

    const poll = async () => {
      if (cancelled) return;
      try {
        const meta = await window.ARM_Bridge.getCrawlProgress(app);
        const done  = (meta.progress && meta.progress.done)  || 0;
        const total = (meta.progress && meta.progress.total) || 1;
        const pct   = total > 0 ? Math.round(done / total * 100) : 0;

        if (meta.status === "analyzing") {
          seenAnalyzing = true;
          if (pct < 5) {
            setActive(0); setProgress(100);
          } else if (pct < 55) {
            setActive(1); setProgress(Math.round((pct / 55) * 100));
            setCollected(done);
          } else if (pct < 80) {
            setActive(2); setProgress(Math.round(((pct - 55) / 25) * 100));
            setCollected(total);
          } else {
            setActive(3); setProgress(Math.round(((pct - 80) / 20) * 100));
            setCollected(total);
          }
          // Adaptive ETA: anchor on the first observed (time, done) once analysis
          // is underway, then extrapolate from the measured classification rate.
          if (done > 0) {
            const now = Date.now();
            if (!rateAnchor.current) {
              rateAnchor.current = { t: now, done };
            } else {
              const elapsed = (now - rateAnchor.current.t) / 1000;     // seconds
              const processed = done - rateAnchor.current.done;        // reviews since anchor
              if (elapsed > 1.5 && processed > 0) {
                const rate = processed / elapsed;                      // reviews/sec
                const remaining = Math.max(0, total - done);
                setEstSec(Math.max(1, Math.round(remaining / rate)));
              }
            }
          }
        } else if (meta.status === "idle" && seenAnalyzing) {
          if (!cancelled) onDone();
          return;
        }

        pollCount++;
        if (!cancelled) setTimeout(poll, 2200);
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
                {current && i === 1 && (
                  <div className="mono fade-in" style={{ fontSize:13, fontWeight:600, color:"var(--accent)" }}>{Math.round(progress)}%</div>
                )}
                {done && <span className="badge badge-positive" style={{fontSize:11}}>✓</span>}
              </div>
            );
          })}
        </div>

        {/* Live stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:26 }}>
          <StatBox icon="clock" label={t("est_time")} value={estSec ? `~${estSec}s` : "…"}/>
          <StatBox icon="reviews" label={t("reviews_collected")} value={collected > 0 ? collected.toLocaleString() : "—"} accent/>
          <StatBox icon="sparkle" label={t("current_step")} value={t("step_"+STEPS[Math.min(active, STEPS.length-1)])} small/>
        </div>

        <p style={{ fontSize:13.5, color:"var(--text-3)", textAlign:"center", lineHeight:1.5, maxWidth:480, margin:"0 auto 26px" }}>{t("s2_note")}</p>

        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button className="btn btn-secondary" onClick={onBack}><Icon name="arrowLeft" size={16}/>{t("back_apps")}</button>
          <button className={`btn ${notified ? "btn-secondary" : "btn-primary"}`} onClick={() => setNotified(true)}>
            <Icon name="bell" size={16}/>{notified ? "✓ " : ""}{t("notify")}</button>
        </div>
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
