/* ============ Review Detail Table (expandable rows) ============ */
function ReviewTable({ t, filters, setFilters, title, sub, reviews }) {
  const [expanded, setExpanded] = useState(null);
  const [pageSize, setPageSize] = useState(50);
  const rows = useMemo(() => {
    const sourceRows = reviews || window.DATA.REVIEWS;
    return sourceRows.filter(r =>
      (filters.rating == null || r.rating === filters.rating) &&
      (filters.cat == null || r.cat === filters.cat) &&
      (filters.priority == null || r.priority === filters.priority) &&
      (filters.status == null || r.status === filters.status) &&
      (filters.sentiment == null || r.sentiment === filters.sentiment) &&
      (filters.platform == null || r.platform === filters.platform) &&
      (filters.actionId == null || (r.actionIds || []).includes(filters.actionId))
    );
  }, [filters, reviews]);
  const visibleRows = pageSize === "all" ? rows : rows.slice(0, pageSize);

  return (
    <div className="card" style={{ overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 22px 16px" }}>
        <div>
          <h3 style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.02em" }}>{title || t("table_title")}</h3>
          <p style={{ fontSize:13.5, color:"var(--text-2)", marginTop:2 }}>{sub || t("table_sub")}</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <ReviewLimitSelect t={t} value={pageSize} onChange={setPageSize}/>
          <span style={{ fontSize:13, color:"var(--text-3)", fontWeight:500 }} className="mono">{t("showing")} {visibleRows.length} {t("of")} {rows.length}</span>
        </div>
      </div>

      <ReviewFilterBar t={t} filters={filters} setFilters={setFilters}/>

      {/* header row */}
      <div className="rt-head" style={{ display:"grid", gridTemplateColumns:"112px 92px 96px 130px 1fr 110px 38px",
        gap:14, padding:"10px 22px", borderBottom:"1px solid var(--hairline)",
        background:"var(--card-2)", fontSize:11.5, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.03em" }}>
        <div>{t("col_review")}</div>
        <div>{t("col_date")}</div>
        <div>{t("col_rating")}</div>
        <div>{t("col_category")}</div>
        <div>{t("col_summary")}</div>
        <div>{t("col_priority")}</div>
        <div></div>
      </div>

      <div>
        {visibleRows.map((r, i) => {
          const open = expanded === r.id;
          return (
            <div key={r.id} style={{ borderBottom: i < visibleRows.length-1 || open ? "1px solid var(--hairline)" : "none" }}>
              <div className="rt-row" onClick={() => setExpanded(open ? null : r.id)}
                style={{ display:"grid", gridTemplateColumns:"112px 92px 96px 130px 1fr 110px 38px", gap:14,
                  padding:"14px 22px", alignItems:"center", cursor:"pointer", transition:"background .12s",
                  background: open ? "var(--card-2)" : "transparent" }}
                onMouseEnter={e => { if(!open) e.currentTarget.style.background="rgba(0,0,0,0.018)"; }}
                onMouseLeave={e => { if(!open) e.currentTarget.style.background="transparent"; }}>
                <div className="mono" style={{ fontSize:12.5, fontWeight:600, color:"var(--text-2)" }}>{r.id}</div>
                <div className="mono" style={{ fontSize:12.5, color:"var(--text-2)" }}>{r.date}</div>
                <div><Stars rating={r.rating} size={13}/></div>
                <div><CategoryTag cat={r.cat} t={t}/></div>
                <div style={{ fontSize:13.5, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r["summary_"+(t._lang)]}</div>
                <div><PriorityBadge priority={r.priority} t={t}/></div>
                <div style={{ display:"grid", placeItems:"center" }}>
                  <Icon name="chevronDown" size={17} style={{ color:"var(--text-3)", transition:"transform .25s", transform: open ? "rotate(180deg)":"none" }}/>
                </div>
              </div>

              {open && <ReviewExpand r={r} t={t}/>}
            </div>
          );
        })}
        {rows.length === 0 && (
          <div style={{ padding:"50px 22px", textAlign:"center", color:"var(--text-3)" }}>
            <Icon name="search" size={26} style={{ marginBottom:10, color:"var(--text-3)" }}/>
            <div style={{ fontSize:14, fontWeight:500 }}>{t("no_results")}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewLimitSelect({ t, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const options = [
    { value:50, label:"50" },
    { value:100, label:"100" },
    { value:200, label:"200" },
    { value:"all", label:t("all") },
  ];
  const current = (options.find(o => o.value === value) || options[0]).label;
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600,
          padding:"6px 10px", borderRadius:9, border:"1px solid var(--hairline-strong)",
          background:"#fff", color:"var(--text)", transition:"all .15s" }}>
        <span style={{ color:"var(--text-3)", fontWeight:600 }}>{t("rows_limit")}:</span>
        <span className="mono">{current}</span>
        <Icon name="chevronDown" size={14} style={{ color:"var(--text-3)", transition:"transform .2s", transform: open?"rotate(180deg)":"none" }}/>
      </button>
      {open && (
        <div className="scale-in" style={{ position:"absolute", top:"calc(100% + 6px)", right:0, minWidth:128, zIndex:50,
          background:"#fff", border:"1px solid var(--hairline)", borderRadius:13, boxShadow:"var(--shadow-pop)", padding:6,
          transformOrigin:"top right" }}>
          {options.map(o => {
            const selected = o.value === value;
            return (
              <button key={String(o.value)} onClick={() => { onChange(o.value); setOpen(false); }}
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, width:"100%", textAlign:"left",
                  padding:"8px 11px", borderRadius:8, fontSize:13.5, fontWeight:500,
                  background: selected ? "var(--accent-soft)":"transparent", color: selected?"var(--accent)":"var(--text)" }}
                onMouseEnter={e => { if(!selected) e.currentTarget.style.background="rgba(0,0,0,0.04)"; }}
                onMouseLeave={e => { if(!selected) e.currentTarget.style.background="transparent"; }}>
                <span>{o.label}</span>{selected && <Icon name="check" size={15} stroke={2.4}/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReviewExpand({ r, t }) {
  const L = t._lang;
  return (
    <div className="fade-in" style={{ padding:"4px 22px 22px", background:"var(--card-2)" }}>
      <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:20 }}>
        {/* Left: AI analysis */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Block icon="sparkle" label={t("ai_summary")} accent>
            <span style={{ fontSize:14, lineHeight:1.5 }}>{r["summary_"+L]}</span>
          </Block>
          <Block icon="reviews" label={t("original_review")}>
            <span style={{ fontSize:14, lineHeight:1.55, color:"var(--text-2)", fontStyle:"italic" }}>“{r["text_"+L]}”</span>
          </Block>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Block icon="alert" label={t("detected_issue")} tone={r.issue_en !== "—" ? "warning" : null}>
              <span style={{ fontSize:13.5, lineHeight:1.45 }}>{r["issue_"+L]}</span>
            </Block>
            <Block icon="trendUp" label={t("suggested_action")} tone="positive">
              <span style={{ fontSize:13.5, lineHeight:1.45 }}>{r["action_"+L]}</span>
            </Block>
          </div>
        </div>

        {/* Right: metadata + flags + actions */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div className="card" style={{ padding:"14px 16px", boxShadow:"none" }}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
              <SentimentBadge sentiment={r.sentiment} t={t}/>
              <FlagBadge flag={r.flag} t={t}/>
              <StatusBadge status={r.status} t={t}/>
            </div>
            <div style={{ fontSize:11.5, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.03em", marginBottom:10 }}>{t("metadata")}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px 14px" }}>
              <Meta label={t("meta_version")} value={r.version}/>
              <Meta label={t("meta_device")} value={r.device}/>
              <Meta label={t("meta_country")} value={r.country}/>
              <Meta label={t("meta_platform")} value={r.platform}/>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <button className="btn btn-primary btn-sm" style={{ width:"100%" }}><Icon name="check" size={15} stroke={2.4}/>{t("mark_fixed")}</button>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-secondary btn-sm" style={{ flex:1 }}><Icon name="ticket" size={15}/>{t("create_ticket")}</button>
              <button className="btn btn-secondary btn-sm" style={{ flex:1 }}><Icon name="reply" size={15}/>{t("reply_suggestion")}</button>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ width:"100%", color:"var(--text-2)" }}>{t("ignore")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Block({ icon, label, children, accent, tone }) {
  const color = tone === "warning" ? "var(--warning)" : tone === "positive" ? "var(--positive)" : accent ? "var(--accent)" : "var(--text-3)";
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6, color }}>
        <Icon name={icon} size={14}/>
        <span style={{ fontSize:11.5, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.03em" }}>{label}</span>
      </div>
      <div style={{ color:"var(--text)" }}>{children}</div>
    </div>
  );
}
function Meta({ label, value }) {
  return (
    <div>
      <div style={{ fontSize:11.5, color:"var(--text-3)", marginBottom:1 }}>{label}</div>
      <div style={{ fontSize:13.5, fontWeight:600 }}>{value}</div>
    </div>
  );
}

Object.assign(window, { ReviewTable, ReviewLimitSelect, ReviewExpand, Block, Meta });
