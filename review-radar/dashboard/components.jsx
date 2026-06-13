/* ============ Shared components ============ */
const { useState, useEffect, useRef, useMemo } = React;

/* ---------- Line icons (thin, consistent, Apple-like) ---------- */
function Icon({ name, size = 18, stroke = 1.7, className, style }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round",
    className, style };
  const paths = {
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    flag: <><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></>,
    report: <><path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M14 3v6h6M8 14h8M8 17h5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 7 2.6 1.6 1.6 0 0 0 8 1.1V1a2 2 0 0 1 4 0v.1A1.6 1.6 0 0 0 15 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" transform="scale(0.83) translate(2.4 2.4)"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    reviews: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></>,
    alert: <><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    check: <><path d="M20 6 9 17l-5-5"/></>,
    checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.3 2.3L15.5 9.5"/></>,
    heart: <><path d="M19 5.6a5 5 0 0 0-7 0l-.9 1-1-1a5 5 0 0 0-7 7l1 1 7 7 7-7 1-1a5 5 0 0 0 0-7Z" transform="scale(0.95) translate(0.6 0.5)"/></>,
    arrowUp: <><path d="M12 19V5M5 12l7-7 7 7"/></>,
    arrowDown: <><path d="M12 5v14M5 12l7 7 7 7" transform="translate(0 -2)"/></>,
    trendUp: <><path d="M3 17 9 11l4 4 8-8M21 7v5M21 7h-5"/></>,
    chevron: <><path d="m9 18 6-6-6-6"/></>,
    chevronDown: <><path d="m6 9 6 6 6-6"/></>,
    filter: <><path d="M4 5h16M7 12h10M10 19h4"/></>,
    bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></>,
    arrowLeft: <><path d="M19 12H5M12 19l-7-7 7-7"/></>,
    star: <><path d="m12 2 3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1Z"/></>,
    sliders: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    ticket: <><path d="M3 9a3 3 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a3 3 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1Z"/><path d="M15 5v14"/></>,
    reply: <><path d="M9 17 4 12l5-5M4 12h11a5 5 0 0 1 5 5v2"/></>,
    x: <><path d="M18 6 6 18M6 6l12 12"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    chart: <><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6" rx="0.5"/><rect x="13" y="7" width="3" height="10" rx="0.5"/></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"/></>,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M17.7 6.3l-2.4 2.4M8.7 15.3l-2.4 2.4"/></>,
    menu: <><path d="M3 6h18M3 12h18M3 18h18"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    lock: <><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    key: <><circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 7.2-7.2M16 6l2 2M18 4l2 2"/></>,
    panelLeft: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
  };
  return <svg {...p}>{paths[name] || null}</svg>;
}

/* ---------- App glyph (logo placeholder) ---------- */
function AppGlyph({ app, size = 44, fontSize }) {
  const a = window.DATA.APPS[app];
  if (!a) return null;
  // Real logo: set APPS[id].logo to an image path/URL to swap in the actual app icon.
  if (a.logo) {
    return <img src={a.logo} alt={a.name} className="app-glyph"
      style={{ width: size, height: size, objectFit: "cover", background: "#fff" }}/>;
  }
  const ratio = a.glyph.length > 1 ? 0.34 : 0.46;
  return (
    <div className="app-glyph" style={{
      width: size, height: size, letterSpacing: a.glyph.length > 1 ? "-0.04em" : "0",
      background: `linear-gradient(155deg, ${a.grad[0]}, ${a.grad[1]})`,
      fontSize: fontSize || size * ratio,
    }}>{a.glyph}</div>
  );
}

/* ---------- Badge helpers ---------- */
function PriorityBadge({ priority, t }) {
  const map = { critical:"badge-critical", high:"badge-warning", medium:"badge-neutral", low:"badge-muted" };
  return <span className={`badge ${map[priority]}`}><span className="dot" style={{background:"currentColor"}}></span>{t("pri_"+priority)}</span>;
}
function StatusBadge({ status, t }) {
  const map = { open:"badge-neutral", in_progress:"badge-warning", fixed:"badge-positive", ignored:"badge-spam" };
  return <span className={`badge ${map[status]}`}>{t("st_"+status)}</span>;
}
function FlagBadge({ flag, t }) {
  const map = { need_fix:"badge-critical", need_reply:"badge-neutral", need_investigation:"badge-warning", spam_review:"badge-spam" };
  return <span className={`badge ${map[flag]}`}>{t("flag_"+flag)}</span>;
}
function SentimentBadge({ sentiment, t }) {
  const map = { positive:"badge-positive", negative:"badge-critical", neutral:"badge-muted" };
  return <span className={`badge ${map[sentiment]}`}>{t("sent_"+sentiment)}</span>;
}
function CategoryTag({ cat, t }) {
  const color = `var(--cat-${cat})`;
  return <span className="badge" style={{ background:"transparent", color:"var(--text)", paddingLeft:0 }}>
    <span className="dot" style={{ background: color, width:8, height:8 }}></span>{t("cat_"+cat)}</span>;
}
function HealthBadge({ health, t }) {
  const map = { positive:["badge-positive","health_healthy"], warning:["badge-warning","health_warning"], critical:["badge-critical","health_critical"] };
  const [cls, key] = map[health];
  return <span className={`badge ${cls}`}><span className="dot" style={{background:"currentColor"}}></span>{t(key)}</span>;
}

function Stars({ rating, size = 13 }) {
  return <span style={{ display:"inline-flex", gap:1, color:"#f5a623" }}>
    {[1,2,3,4,5].map(i => (
      <Icon key={i} name="star" size={size} stroke={1.5}
        style={{ fill: i <= rating ? "#f5a623" : "none", color: i <= rating ? "#f5a623" : "#d2d2d7" }}/>
    ))}
  </span>;
}

/* ---------- Sidebar ---------- */
function Sidebar({ screen, lang, setLang, t, go, activeApp, dashSection, onDashNav, collapsed, onToggleNav }) {
  const inApp = screen === "dashboard";
  const a = activeApp && window.DATA.APPS[activeApp];
  const row = activeApp && window.DATA.AVAILABLE.find(r => r.app === activeApp);
  // action items belonging to THIS app that still need attention
  const openActions = window.DATA.ACTIONS.filter(x => x.status === "open" || x.status === "in_progress").length;

  const workspaceItems = [
    { id:"monitor", icon:"monitor", label:t("nav_monitor"), screen:"selection" },
    { id:"apps", icon:"grid", label:t("nav_apps"), screen:"selection" },
    { id:"compare", icon:"chart", label:t("nav_compare"), screen:"compare" },
    { id:"reports", icon:"report", label:t("nav_reports"), screen:"reports" },
  ];
  // The "selection" screen is the monitoring setup hero. Other screens
  // (settings, team, dashboard, initializing) highlight no workspace item.
  const wsActive = screen === "compare" ? "compare" : screen === "reports" ? "reports" : screen === "selection" ? "monitor" : null;

  const appItems = [
    { id:"overview", icon:"chart",   label:t("nav_overview") },
    { id:"actions",  icon:"flag",    label:t("nav_actions"), count: openActions },
    { id:"reviews",  icon:"reviews", label:t("nav_reviews") },
  ];

  return (
    <aside className={"sidebar" + (collapsed ? " collapsed" : "")}>
      <div className="sb-brand">
        <img className="sb-logo" src="assets/app-icon.png" alt="Review Radar"/>
        {!collapsed && <div className="sb-brand-text">Review<br/>Radar</div>}
        <button className="sb-burger" onClick={onToggleNav} title={t("toggle_nav")} aria-label={t("toggle_nav")}>
          <Icon name="menu" size={18}/>
        </button>
      </div>

      {inApp ? (
        <React.Fragment>
          {/* Back to workspace */}
          <button className="sb-item" onClick={() => go("selection")} title={t("all_apps")}>
            <Icon name="arrowLeft" size={19}/><span>{t("all_apps")}</span>
          </button>

          {/* Current app context */}
          <div className="sb-app-context" title={a.name}>
            <AppGlyph app={activeApp} size={34}/>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontSize:13.5, fontWeight:600, letterSpacing:"-0.01em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.name}</div>
              <div style={{ fontSize:11, color:"var(--text-3)" }}>{a.platform}</div>
            </div>
            {row && <span className="sb-dot" style={{ background:`var(--${row.health === "positive" ? "positive" : row.health})` }}></span>}
          </div>

          <div className="sb-section-label">{t("sb_this_app")}</div>
          {appItems.map(it => (
            <button key={it.id} className={`sb-item ${dashSection === it.id ? "active" : ""}`}
              title={it.label} onClick={() => onDashNav(it.id)}>
              <Icon name={it.icon} size={19}/>
              <span>{it.label}</span>
              {it.count != null && it.count > 0 && <span className="sb-count">{it.count}</span>}
            </button>
          ))}
        </React.Fragment>
      ) : (
        <React.Fragment>
          <div className="sb-section-label">{t("nav_section_main")}</div>
          {workspaceItems.map(it => (
            <button key={it.id} className={`sb-item ${wsActive === it.id ? "active" : ""}`}
              title={it.label} onClick={() => it.screen && go(it.screen)}>
              <Icon name={it.icon} size={19}/>
              <span>{it.label}</span>
            </button>
          ))}
        </React.Fragment>
      )}

      <div className="sb-section-label">{t("nav_section_account")}</div>
      <button className={`sb-item ${screen === "settings" ? "active" : ""}`} title={t("nav_settings")} onClick={() => go("settings")}><Icon name="settings" size={19}/><span>{t("nav_settings")}</span></button>

      <div className="sb-spacer"></div>

      {!collapsed && (
        <div style={{ padding:"0 8px 14px", display:"flex", justifyContent:"flex-start" }}>
          <div className="lang-switch">
            <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
            <button className={lang === "vi" ? "active" : ""} onClick={() => setLang("vi")}>VI</button>
          </div>
        </div>
      )}

      <div className="sb-foot">
        <button className={"sb-user" + (screen === "team" ? " active" : "")} style={{ textAlign:"left" }} title="The Outliers" onClick={() => go("team")}>
          <img src="assets/the-outliers-logo.png" alt="The Outliers" className="sb-team-logo"/>
          <div style={{ minWidth:0 }}>
            <div className="sb-user-name">{t("user_name")}</div>
            <div className="sb-user-role">{t("user_role")}</div>
          </div>
          <Icon name="chevron" size={15} className="sb-user-chevron" style={{ marginLeft:"auto", color:"var(--text-3)" }}/>
        </button>
      </div>
    </aside>
  );
}

/* ---------- Trend indicator pill (legacy, top-right) ---------- */
function TrendPill({ value, invert }) {
  if (value == null) return null;
  const up = value > 0;
  // invert: for "bad" metrics (critical bugs), up is bad → red
  const good = invert ? !up : up;
  const color = good ? "var(--positive)" : "var(--critical)";
  const bg = good ? "var(--positive-soft)" : "var(--critical-soft)";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:2, fontSize:12.5, fontWeight:700,
      color, background:bg, padding:"2px 7px 2px 5px", borderRadius:7 }}>
      <Icon name={up ? "arrowUp" : "arrowDown"} size={13} stroke={2.4}/>{Math.abs(value)}%
    </span>
  );
}

/* ---------- Trend delta (number + filled triangle, sits below the metric) ---------- */
function TrendDelta({ value, invert, size = 14 }) {
  if (value == null) return null;
  const up = value > 0;
  // `good` decides the color by the metric's real meaning:
  // invert=true  → an increase is BAD (e.g. critical bugs ↑ = red)
  // invert=false → an increase is GOOD (e.g. bugs fixed ↑ = green)
  const good = invert ? !up : up;
  const color = good ? "var(--positive)" : "var(--critical)";
  const tri = up ? "M6 1.2 11.2 10H0.8z" : "M6 10.8 0.8 2h10.4z";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, color, fontWeight:700, fontSize: size }}>
      <span className="mono">{up ? "+" : "−"}{Math.abs(value)}%</span>
      <svg width={size - 2} height={size - 2} viewBox="0 0 12 12" aria-hidden="true">
        <path d={tri} fill="currentColor"/>
      </svg>
    </span>
  );
}

/* ---------- iOS-style toggle switch ---------- */
function Toggle({ checked, onChange }) {
  return (
    <button type="button" className="ios-toggle" data-on={checked} onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span className="ios-knob"></span>
    </button>
  );
}

/* ---------- Modal (backdrop blur, scale-in, Esc/click-out to close) ---------- */
function Modal({ open, onClose, children, width = 460 }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card scale-in" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ---- Apple-style toast notifications (top-right) ---- */
function ToastCard({ toast, onDismiss }) {
  const [leaving, setLeaving] = useState(false);
  const close = React.useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [toast.id, onDismiss]);
  useEffect(() => {
    const id = setTimeout(close, 5200);
    return () => clearTimeout(id);
  }, [close]);
  return (
    <div className={"toast" + (leaving ? " toast-leaving" : "")} onClick={close} role="status">
      <div className="toast-glyph">
        {window.DATA.APPS[toast.app]
          ? <AppGlyph app={toast.app} size={40} fontSize={17}/>
          : <div className="toast-check"><Icon name="check" size={20} stroke={2.6}/></div>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div className="toast-title">{toast.title}</div>
        <div className="toast-sub">{toast.sub}</div>
      </div>
      <div className="toast-badge"><Icon name="check" size={13} stroke={3}/></div>
    </div>
  );
}

function Toaster({ toasts, onDismiss }) {
  if (!toasts || !toasts.length) return null;
  return (
    <div className="toast-wrap">
      {toasts.map(tt => <ToastCard key={tt.id} toast={tt} onDismiss={onDismiss}/>)}
    </div>
  );
}

Object.assign(window, {
  Icon, AppGlyph, PriorityBadge, StatusBadge, FlagBadge, SentimentBadge,
  CategoryTag, HealthBadge, Stars, Sidebar, TrendPill, TrendDelta, Toggle, Modal,
  Toaster, ToastCard,
});
