/* ============ Settings page ============ */
function SettingsPage({ t, lang, setLang }) {
  const [autocat, setAutocat] = useState(true);
  const [spam, setSpam] = useState(true);
  const [notifCrit, setNotifCrit] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(true);
  const [notifMentions, setNotifMentions] = useState(false);
  const [defaultFreq, setDefaultFreq] = useState("1h");
  const [toast, setToast] = useState(false);
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(false), 2400); };

  const freqOpts = [
    { value:"30m", label:t("every_30m") }, { value:"1h", label:t("every_hour") },
    { value:"6h", label:t("every_6h") }, { value:"12h", label:t("every_12h") }, { value:"24h", label:t("every_24h") },
  ];

  return (
    <div style={{ maxWidth:880, margin:"0 auto", padding:"32px 40px 70px" }}>
      <div className="fade-up" style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:700, letterSpacing:"-0.03em" }}>{t("nav_settings")}</h1>
          <p style={{ fontSize:15, color:"var(--text-2)", marginTop:3 }}>{t("settings_sub")}</p>
        </div>
        <button className="btn btn-primary" onClick={() => showToast(t("settings_saved"))}><Icon name="check" size={16} stroke={2.4}/>{t("save_changes")}</button>
      </div>

      {/* General */}
      <SettingsCard t={t} title={t("set_general")} icon="sliders" delay=".05s">
        <FieldRow label={t("set_workspace_name")}>
          <input className="set-input" defaultValue="The Outliers · App Review" style={{ width:280 }}/>
        </FieldRow>
        <FieldRow label={t("set_default_lang")} border>
          <div className="lang-switch" style={{ background:"rgba(0,0,0,0.05)" }}>
            <button className={lang==="en"?"active":""} onClick={()=>setLang("en")}>EN</button>
            <button className={lang==="vi"?"active":""} onClick={()=>setLang("vi")}>VI</button>
          </div>
        </FieldRow>
        <FieldRow label={t("set_timezone")} border>
          <span style={{ fontSize:14, fontWeight:500, color:"var(--text-2)" }}>GMT+7 · Indochina Time</span>
        </FieldRow>
      </SettingsCard>

      {/* Crawl defaults */}
      <SettingsCard t={t} title={t("set_crawl")} icon="refresh" delay=".1s">
        <FieldRow label={t("set_default_freq")}>
          <div className="set-seg">
            {freqOpts.map(o => (
              <button key={o.value} className={defaultFreq===o.value?"active":""} onClick={()=>setDefaultFreq(o.value)}>{o.label}</button>
            ))}
          </div>
        </FieldRow>
        <ToggleRow label={t("set_autocat")} desc={t("set_autocat_d")} checked={autocat} onChange={setAutocat} border/>
        <ToggleRow label={t("set_spam")} desc={t("set_spam_d")} checked={spam} onChange={setSpam} border/>
      </SettingsCard>

      {/* Notifications */}
      <SettingsCard t={t} title={t("set_notif")} icon="bell" delay=".15s">
        <ToggleRow label={t("opt_notify")} desc={t("opt_notify_d")} checked={notifCrit} onChange={setNotifCrit}/>
        <ToggleRow label={t("sch_weekly_bug")} desc={t("tpl_weekly_d")} checked={notifWeekly} onChange={setNotifWeekly} border/>
        <ToggleRow label={t("flag_need_reply")} desc={t("reviews_page_sub")} checked={notifMentions} onChange={setNotifMentions} border/>
      </SettingsCard>

      {/* Team */}
      <SettingsCard t={t} title={t("set_team")} icon="user" delay=".2s"
        action={<button className="btn btn-secondary btn-sm" onClick={()=>showToast(t("future_note"))}><Icon name="plus" size={15} stroke={2.2}/>{t("set_invite")}</button>}>
        {window.DATA.TEAM.map((m, i) => (
          <div key={m.email} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderTop: i>0?"1px solid var(--hairline)":"none" }}>
            <div className="set-avatar" style={{ background:`linear-gradient(145deg, ${m.color[0]}, ${m.color[1]})` }}>{m.initials}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:600 }}>{m.name}</div>
              <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{m.email}</div>
            </div>
            <span className={"badge " + (m.role==="role_admin"?"badge-neutral":"badge-muted")}>{t(m.role)}</span>
          </div>
        ))}
      </SettingsCard>

      {/* Integrations */}
      <SettingsCard t={t} title={t("set_integrations")} icon="grid" delay=".25s">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
          {window.DATA.INTEGRATIONS.map(ig => {
            const L = t._lang;
            const future = ig.status === "future";
            return (
              <div key={ig.id} style={{ display:"flex", alignItems:"center", gap:11, padding:"13px 14px", border:"1px solid var(--hairline)", borderRadius:13 }}>
                <IntegrationLogo id={ig.id}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600 }}>{ig.name}</div>
                  <div style={{ fontSize:12, color:"var(--text-3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ig["desc_"+L]}</div>
                </div>
                {future
                  ? <span className="badge badge-warning" style={{ fontSize:11, flexShrink:0 }}>{t("coming_soon")}</span>
                  : <button className="btn btn-secondary btn-xs" onClick={()=>showToast(t("future_note"))} style={{ flexShrink:0 }}>{t("connect")}</button>}
              </div>
            );
          })}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:14, padding:"11px 14px", background:"var(--warning-soft)", borderRadius:11, fontSize:13, color:"#9a5a00" }}>
          <Icon name="clock" size={15} stroke={2}/>
          <span>{t("future_note")} — Teams, Outlook, Jira & Slack.</span>
        </div>
      </SettingsCard>

      {/* API */}
      <SettingsCard t={t} title={t("set_api")} icon="key" delay=".3s">
        <p style={{ fontSize:13.5, color:"var(--text-2)", marginBottom:14, lineHeight:1.5 }}>{t("set_api_d")}</p>
        <FieldRow label={t("set_api_key")}>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <code className="api-key mono">arm_live_••••••••••••8f2a</code>
            <button className="btn btn-secondary btn-sm" onClick={()=>showToast(t("future_note"))}><Icon name="refresh" size={14}/>{t("set_regenerate")}</button>
          </div>
        </FieldRow>
      </SettingsCard>

      {toast && <div className="toast"><Icon name="checkCircle" size={16} stroke={2.2} style={{ color:"var(--positive)" }}/>{toast}</div>}
    </div>
  );
}

function IntegrationLogo({ id }) {
  const logos = {
    teams: "assets/integrations/teams.jpeg",
    outlook: "assets/integrations/outlook.jpeg",
    jira: "assets/integrations/jira.jpeg",
    slack: "assets/integrations/slack.png",
  };
  if (logos[id]) {
    return (
      <div style={{
        width:36, height:36, borderRadius:9, background:"#fff", border:"1px solid rgba(0,0,0,0.06)",
        display:"grid", placeItems:"center", flexShrink:0, overflow:"hidden",
      }}>
        <img
          src={logos[id]}
          alt={`${id} logo`}
          style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
          loading="lazy"
        />
      </div>
    );
  }
  return <div className="app-glyph" style={{ width:36, height:36, fontSize:16 }}>{String(id || "?").slice(0, 1).toUpperCase()}</div>;
}

function SettingsCard({ t, title, icon, children, action, delay }) {
  return (
    <div className="card fade-up" style={{ padding:"18px 22px 20px", marginBottom:16, animationDelay:delay }}>
      <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom:6 }}>
        <div style={{ width:30, height:30, borderRadius:8, background:"var(--card-2)", color:"var(--text-2)", display:"grid", placeItems:"center", flexShrink:0 }}>
          <Icon name={icon} size={16}/>
        </div>
        <h3 style={{ fontSize:16.5, fontWeight:700, letterSpacing:"-0.02em", flex:1 }}>{title}</h3>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

function FieldRow({ label, children, border }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, padding:"13px 0", borderTop: border?"1px solid var(--hairline)":"none" }}>
      <div style={{ fontSize:14, fontWeight:500 }}>{label}</div>
      {children}
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange, border }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 0", borderTop: border?"1px solid var(--hairline)":"none" }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, fontWeight:500 }}>{label}</div>
        <div style={{ fontSize:12.5, color:"var(--text-3)", marginTop:1, lineHeight:1.4 }}>{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange}/>
    </div>
  );
}

Object.assign(window, { SettingsPage, SettingsCard, FieldRow, ToggleRow });
