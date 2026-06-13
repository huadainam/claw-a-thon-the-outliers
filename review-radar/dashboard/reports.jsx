/* ============ Reports page ============ */
function ReportsPage({ t }) {
  const [toast, setToast] = useState(false);
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(false), 2400); };

  const templates = [
    { id:"weekly",   icon:"calendar", tone:"neutral" },
    { id:"critical", icon:"alert",    tone:"critical" },
    { id:"category", icon:"chart",    tone:"purple" },
    { id:"compare",  icon:"grid",     tone:"positive" },
  ];

  return (
    <div style={{ maxWidth:1080, margin:"0 auto", padding:"32px 40px 70px" }}>
      <div className="fade-up" style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:700, letterSpacing:"-0.03em" }}>{t("nav_reports")}</h1>
          <p style={{ fontSize:15, color:"var(--text-2)", marginTop:3 }}>{t("reports_sub")}</p>
        </div>
        <button className="btn btn-primary" onClick={() => showToast(t("future_note"))}><Icon name="report" size={16}/>{t("new_report")}</button>
      </div>

      {/* Delivery channels — future note */}
      <div className="card fade-up" style={{ padding:"20px 22px", marginBottom:20, animationDelay:".05s" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
          <CardHead title={t("delivery_title")} sub={t("delivery_sub")}/>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12, marginTop:16 }}>
          <ChannelCard t={t} icon="teams" name={t("ch_teams")} desc={t("ch_teams_d")} future grad={["#6264a7","#4b4d8f"]} glyph="T"/>
          <ChannelCard t={t} icon="outlook" name={t("ch_outlook")} desc={t("ch_outlook_d")} future grad={["#0a84ff","#0058c8"]} glyph="O"/>
          <ChannelCard t={t} icon="download" name={t("ch_download")} desc={t("ch_download_d")} grad={["#86868b","#6e6e73"]} glyph="↓"/>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:16, padding:"11px 14px", background:"var(--warning-soft)", borderRadius:11, fontSize:13, color:"#9a5a00" }}>
          <Icon name="clock" size={15} stroke={2}/>
          <span>{t("future_note")} — Microsoft Teams & Outlook integration.</span>
        </div>
      </div>

      {/* Templates */}
      <div className="fade-up" style={{ animationDelay:".1s", marginBottom:14 }}>
        <CardHead title={t("templates_title")} sub={t("templates_sub")}/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:14, marginBottom:28 }}>
        {templates.map((tpl, i) => {
          const tc = { neutral:"var(--accent)", critical:"var(--critical)", purple:"var(--purple)", positive:"var(--positive)" }[tpl.tone];
          const ts = { neutral:"var(--accent-soft)", critical:"var(--critical-soft)", purple:"var(--purple-soft)", positive:"var(--positive-soft)" }[tpl.tone];
          return (
            <div key={tpl.id} className="card report-tpl fade-up" style={{ padding:"18px 20px", animationDelay:`${0.12+i*0.05}s`,
              display:"flex", flexDirection:"column", gap:14, transition:"transform .18s, box-shadow .18s, border-color .18s" }}
              onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="var(--shadow-md)"; e.currentTarget.style.borderColor="var(--hairline-strong)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="var(--shadow-sm)"; e.currentTarget.style.borderColor="var(--hairline)"; }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:13 }}>
                <div style={{ width:42, height:42, borderRadius:11, background:ts, color:tc, display:"grid", placeItems:"center", flexShrink:0 }}>
                  <Icon name={tpl.icon} size={20}/>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15.5, fontWeight:600, letterSpacing:"-0.01em" }}>{t("tpl_"+tpl.id)}</div>
                  <p style={{ fontSize:13, color:"var(--text-2)", marginTop:3, lineHeight:1.45, textWrap:"pretty" }}>{t("tpl_"+tpl.id+"_d")}</p>
                </div>
              </div>
              <div style={{ display:"flex", gap:8, borderTop:"1px solid var(--hairline)", paddingTop:13 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => showToast(t("future_note"))}><Icon name="report" size={14}/>{t("generate")}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => showToast(t("future_note"))} style={{ color:"var(--text-2)" }}><Icon name="download" size={14}/>{t("export_pdf")}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => showToast(t("future_note"))} style={{ marginLeft:"auto", color:"var(--accent)" }}><Icon name="clock" size={14}/>{t("schedule_btn")}</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scheduled */}
      <div className="fade-up" style={{ animationDelay:".25s", marginBottom:14 }}>
        <CardHead title={t("scheduled_title")} sub={t("scheduled_sub")}/>
      </div>
      <div className="card fade-up" style={{ overflow:"hidden", animationDelay:".3s" }}>
        {window.DATA.SCHEDULED.map((s, i) => (
          <div key={s.id} style={{ display:"flex", alignItems:"center", gap:16, padding:"15px 20px",
            borderBottom: i < window.DATA.SCHEDULED.length-1 ? "1px solid var(--hairline)" : "none" }}>
            <div style={{ width:38, height:38, borderRadius:10, background:"var(--accent-soft)", color:"var(--accent)", display:"grid", placeItems:"center", flexShrink:0 }}>
              <Icon name="report" size={18}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14.5, fontWeight:600 }}>{t(s.id)}</div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:3, fontSize:12.5, color:"var(--text-3)", flexWrap:"wrap" }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}><Icon name="refresh" size={12.5}/>{s.freq}</span>
                <span style={{ width:3, height:3, borderRadius:"50%", background:"var(--text-3)" }}></span>
                <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}><Icon name="user" size={12.5}/>{s.recipients}</span>
                <span style={{ width:3, height:3, borderRadius:"50%", background:"var(--text-3)" }}></span>
                <span>{t("next_run")}: {s.next}</span>
              </div>
            </div>
            <span className="badge badge-muted">{s.format}</span>
            <Toggle checked={true} onChange={() => showToast(t("future_note"))}/>
          </div>
        ))}
      </div>

      {toast && <div className="toast"><Icon name="clock" size={16} stroke={2.2} style={{ color:"var(--warning)" }}/>{toast}</div>}
    </div>
  );
}

function ChannelCard({ t, name, desc, future, grad, glyph }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:11, padding:"15px 16px", border:"1px solid var(--hairline)", borderRadius:14, background:"var(--card-2)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div className="app-glyph" style={{ width:34, height:34, fontSize:16, background:`linear-gradient(155deg, ${grad[0]}, ${grad[1]})` }}>{glyph}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:600 }}>{name}</div>
        </div>
        {future
          ? <span className="badge badge-warning" style={{ fontSize:11 }}>{t("coming_soon")}</span>
          : <span className="badge badge-positive" style={{ fontSize:11 }}>{t("available_badge")}</span>}
      </div>
      <p style={{ fontSize:12.5, color:"var(--text-2)", lineHeight:1.45 }}>{desc}</p>
    </div>
  );
}

Object.assign(window, { ReportsPage, ChannelCard });
