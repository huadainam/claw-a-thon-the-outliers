/* ============ Functional filter controls (shared) ============ */

/* Controlled select — value=null means "All" */
function FilterSelect({ label, value, options, onChange, t, minWidth = 0 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const active = value != null;
  const current = active ? (options.find(o => o.value === value) || {}).label : t("all");
  const all = [{ value: null, label: t("all") }, ...options];
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600,
          padding:"6px 11px", borderRadius:9, minWidth,
          border:`1px solid ${active ? "var(--accent)" : "var(--hairline-strong)"}`,
          background: active ? "var(--accent-soft)" : "#fff", color: active ? "var(--accent)" : "var(--text)",
          transition:"all .15s" }}>
        <span style={{ color: active ? "var(--accent)" : "var(--text-3)", fontWeight:600 }}>{label}:</span>
        <span>{current}</span>
        <Icon name="chevronDown" size={14} style={{ color: active ? "var(--accent)" : "var(--text-3)", marginLeft:"auto", transition:"transform .2s", transform: open?"rotate(180deg)":"none" }}/>
      </button>
      {open && (
        <div className="scale-in" style={{ position:"absolute", top:"calc(100% + 6px)", left:0, minWidth:178, zIndex:50,
          background:"#fff", border:"1px solid var(--hairline)", borderRadius:13, boxShadow:"var(--shadow-pop)", padding:6,
          transformOrigin:"top left", maxHeight:300, overflowY:"auto" }}>
          {all.map(o => {
            const sel = o.value === value;
            return (
              <button key={String(o.value)} onClick={() => { onChange(o.value); setOpen(false); }}
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, width:"100%", textAlign:"left",
                  padding:"8px 11px", borderRadius:8, fontSize:13.5, fontWeight:500,
                  background: sel ? "var(--accent-soft)":"transparent", color: sel?"var(--accent)":"var(--text)" }}
                onMouseEnter={e => { if(!sel) e.currentTarget.style.background="rgba(0,0,0,0.04)"; }}
                onMouseLeave={e => { if(!sel) e.currentTarget.style.background="transparent"; }}>
                <span>{o.label}</span>{sel && <Icon name="check" size={15} stroke={2.4}/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Filter bar for reviews */
function ReviewFilterBar({ t, filters, setFilters }) {
  const set = (key, val) => setFilters({ ...filters, [key]: val });
  const anyActive = Object.values(filters).some(v => v != null);

  const ratingOpts = [5,4,3,2,1].map(n => ({ value:n, label:`${n} ★` }));
  const catOpts = window.DATA.CATEGORIES.map(c => ({ value:c.id, label:t("cat_"+c.id) }));
  const priOpts = ["critical","high","medium","low"].map(p => ({ value:p, label:t("pri_"+p) }));
  const stOpts  = ["open","in_progress","fixed","ignored"].map(s => ({ value:s, label:t("st_"+s) }));
  const senOpts = ["positive","neutral","negative"].map(s => ({ value:s, label:t("sent_"+s) }));

  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", padding:"14px 22px",
      borderTop:"1px solid var(--hairline)", background:"var(--card-2)" }}>
      <Icon name="filter" size={15} style={{ color:"var(--text-3)" }}/>
      <FilterSelect label={t("filter_rating")}   value={filters.rating}    options={ratingOpts} onChange={v=>set("rating",v)} t={t}/>
      <FilterSelect label={t("filter_category")} value={filters.cat}       options={catOpts}    onChange={v=>set("cat",v)} t={t}/>
      <FilterSelect label={t("filter_priority")} value={filters.priority}  options={priOpts}    onChange={v=>set("priority",v)} t={t}/>
      <FilterSelect label={t("filter_status") || "Status"} value={filters.status} options={stOpts} onChange={v=>set("status",v)} t={t}/>
      <FilterSelect label={t("filter_sentiment")} value={filters.sentiment} options={senOpts}   onChange={v=>set("sentiment",v)} t={t}/>
      {anyActive && (
        <button className="btn btn-ghost btn-xs" onClick={() => setFilters({ rating:null, cat:null, priority:null, status:null, sentiment:null, platform:null })}
          style={{ color:"var(--text-2)" }}><Icon name="x" size={13} stroke={2.4}/>{t("clear_all")}</button>
      )}
    </div>
  );
}

Object.assign(window, { FilterSelect, ReviewFilterBar });
