/* ============ Dashboard sub-views: full Action Items & Reviews pages ============ */

function PageHeader({ t, title, sub, onBack, right }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
      <button className="btn-icon" onClick={onBack}
        style={{ width:34, height:34, borderRadius:9, display:"grid", placeItems:"center", background:"rgba(0,0,0,0.04)", flexShrink:0 }}>
        <Icon name="arrowLeft" size={18} style={{ color:"var(--text-2)" }}/>
      </button>
      <div style={{ flex:1 }}>
        <h2 style={{ fontSize:23, fontWeight:700, letterSpacing:"-0.03em" }}>{title}</h2>
        {sub && <p style={{ fontSize:14, color:"var(--text-2)", marginTop:1 }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/* ---------- Full Action Items page ---------- */
function ActionsPage({ t, onBack, onViewReviews }) {
  const [filters, setFilters] = useState({ priority:null, status:null, flag:null });
  const set = (k, v) => setFilters({ ...filters, [k]: v });

  const rows = window.DATA.ACTIONS.filter(a =>
    (filters.priority == null || a.priority === filters.priority) &&
    (filters.status == null || a.status === filters.status) &&
    (filters.flag == null || a.flag === filters.flag)
  );
  const openCount = window.DATA.ACTIONS.filter(a => a.status === "open" || a.status === "in_progress").length;

  const priOpts  = ["critical","high","medium","low"].map(p => ({ value:p, label:t("pri_"+p) }));
  const stOpts   = ["open","in_progress","fixed","ignored"].map(s => ({ value:s, label:t("st_"+s) }));
  const flagOpts = ["need_fix","need_reply","need_investigation","spam_review"].map(f => ({ value:f, label:t("flag_"+f) }));
  const anyActive = Object.values(filters).some(v => v != null);

  return (
    <div className="fade-up">
      <PageHeader t={t} onBack={onBack} title={t("nav_actions")} sub={t("actions_page_sub")}
        right={<span className="badge badge-warning" style={{ fontSize:13, padding:"6px 11px" }}>{openCount} {t("open_count")}</span>}/>

      {/* Filters */}
      <div className="card" style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", padding:"12px 16px", marginBottom:14 }}>
        <Icon name="filter" size={15} style={{ color:"var(--text-3)" }}/>
        <FilterSelect label={t("filter_priority")} value={filters.priority} options={priOpts} onChange={v=>set("priority",v)} t={t}/>
        <FilterSelect label={t("filter_status") || "Status"} value={filters.status} options={stOpts} onChange={v=>set("status",v)} t={t}/>
        <FilterSelect label={t("filter_flag") || "Action"} value={filters.flag} options={flagOpts} onChange={v=>set("flag",v)} t={t}/>
        {anyActive && (
          <button className="btn btn-ghost btn-xs" onClick={() => setFilters({ priority:null, status:null, flag:null })} style={{ color:"var(--text-2)" }}>
            <Icon name="x" size={13} stroke={2.4}/>{t("clear_all")}</button>
        )}
        <span className="mono" style={{ marginLeft:"auto", fontSize:13, color:"var(--text-3)", fontWeight:500 }}>{t("showing")} {rows.length} {t("of")} {window.DATA.ACTIONS.length}</span>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {rows.map(it => <ActionRow key={it.id} it={it} t={t} onViewReviews={onViewReviews}/>)}
        {rows.length === 0 && (
          <div className="card" style={{ padding:"50px 22px", textAlign:"center", color:"var(--text-3)" }}>
            <Icon name="flag" size={26} style={{ marginBottom:10, color:"var(--text-3)" }}/>
            <div style={{ fontSize:14, fontWeight:500 }}>{t("no_actions")}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Full Reviews page ---------- */
function ReviewsPage({ t, onBack, filters, setFilters, ctx, onClearCtx }) {
  return (
    <div className="fade-up">
      <PageHeader t={t} onBack={onBack} title={t("nav_reviews")} sub={t("reviews_page_sub")}/>

      {ctx && (
        <div className="card" style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", marginBottom:14,
          borderColor:"var(--accent)", boxShadow:"0 0 0 3px var(--accent-soft)" }}>
          <div style={{ width:32, height:32, borderRadius:9, background:"var(--accent-soft)", color:"var(--accent)", display:"grid", placeItems:"center", flexShrink:0 }}>
            <Icon name="flag" size={16}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, color:"var(--text-2)" }}>{t("reviews_for")} <span className="mono" style={{ fontWeight:600, color:"var(--text)" }}>{ctx.id}</span></div>
            <div style={{ fontSize:14, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ctx["title_"+t._lang]}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClearCtx}>{t("clear_context")}</button>
        </div>
      )}

      <ReviewTable t={t} filters={filters} setFilters={setFilters} title={t("nav_reviews")} sub={t("table_sub")}/>
    </div>
  );
}

Object.assign(window, { PageHeader, ActionsPage, ReviewsPage });
