/* ============ Team & Feedback page ============ */
function TeamPage({ t }) {
  const members = [
    { key:"pic", role:"role_pic", name:"pic_name", desc:"pic_desc", contrib:"contrib_pic",
      logo:"assets/the-outliers-logo.png", lead:true },
    { key:"collab", role:"role_collab", name:"collab_name", desc:"collab_desc", contrib:"contrib_collab",
      initials:"CV", grad:["#7bd3ff","#0a84ff"] },
  ];

  return (
    <div style={{ maxWidth:920, margin:"0 auto", padding:"32px 40px 70px" }}>
      {/* Hero */}
      <div className="fade-up" style={{ display:"flex", alignItems:"center", gap:18, marginBottom:28 }}>
        <img src="assets/the-outliers-logo.png" alt="The Outliers" style={{ width:64, height:64, borderRadius:16, boxShadow:"var(--shadow-md)" }}/>
        <div>
          <h1 style={{ fontSize:30, fontWeight:700, letterSpacing:"-0.03em" }}>{t("team_title")}</h1>
          <p style={{ fontSize:15, color:"var(--text-2)", marginTop:3 }}>{t("team_sub")}</p>
        </div>
      </div>

      {/* Members */}
      <div style={{ fontSize:12.5, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:12 }}>{t("built_by")}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:30 }}>
        {members.map((m, i) => (
          <div key={m.key} className="card fade-up" style={{ padding:"20px 22px", display:"flex", gap:18, animationDelay:`${0.05+i*0.06}s`,
            borderColor: m.lead ? "var(--accent)" : "var(--hairline)",
            boxShadow: m.lead ? "0 0 0 3px var(--accent-soft), var(--shadow-sm)" : "var(--shadow-sm)" }}>
            {m.logo
              ? <img src={m.logo} alt="" style={{ width:56, height:56, borderRadius:14, flexShrink:0, boxShadow:"var(--shadow-sm)" }}/>
              : <div className="set-avatar" style={{ width:56, height:56, fontSize:19, borderRadius:14, background:`linear-gradient(145deg, ${m.grad[0]}, ${m.grad[1]})` }}>{m.initials}</div>}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap" }}>
                <span style={{ fontSize:17, fontWeight:700, letterSpacing:"-0.02em" }}>{t(m.name)}</span>
                <span className={"badge " + (m.lead ? "badge-neutral" : "badge-muted")}>{t(m.role)}</span>
              </div>
              <p style={{ fontSize:14, color:"var(--text-2)", marginTop:6, lineHeight:1.5, textWrap:"pretty" }}>{t(m.desc)}</p>
              <div style={{ display:"flex", alignItems:"flex-start", gap:7, marginTop:12, paddingTop:12, borderTop:"1px solid var(--hairline)" }}>
                <Icon name="sparkle" size={15} style={{ color:"var(--accent)", marginTop:1, flexShrink:0 }}/>
                <div>
                  <div style={{ fontSize:11.5, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.03em" }}>{t("contributions")}</div>
                  <div style={{ fontSize:13.5, color:"var(--text)", marginTop:2 }}>{t(m.contrib)}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Feedback */}
      <FeedbackBlock t={t}/>
    </div>
  );
}

function FeedbackBlock({ t }) {
  const [type, setType] = useState("idea");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const [items, setItems] = useState([
    { type:"praise", name:"Minh P.", text_en:"The dashboard feels genuinely premium — love the calm look.", text_vi:"Dashboard nhìn rất cao cấp — thích cảm giác nhẹ nhàng.", rating:5 },
    { type:"idea", name:"An N.", text_en:"Would love a weekly email digest once Outlook is wired up.", text_vi:"Mong có email tổng hợp tuần khi tích hợp Outlook xong.", rating:4 },
  ]);

  const types = [
    { id:"idea", icon:"sparkle", label:t("fb_idea") },
    { id:"bug", icon:"alert", label:t("fb_bug") },
    { id:"praise", icon:"heart", label:t("fb_praise") },
  ];

  const submit = () => {
    if (!msg.trim()) return;
    const L = t._lang;
    const entry = { type, name: name.trim() || (L==="vi"?"Ẩn danh":"Anonymous"), rating };
    entry["text_"+L] = msg.trim();
    entry["text_"+(L==="vi"?"en":"vi")] = msg.trim();
    setItems([entry, ...items]);
    setSent(true); setMsg(""); setName(""); setRating(0); setType("idea");
    setTimeout(() => setSent(false), 2800);
  };

  return (
    <div className="fade-up" style={{ animationDelay:".2s" }}>
      <div className="card" style={{ padding:"22px 24px", marginBottom:18 }}>
        <CardHead title={t("feedback_title")} sub={t("feedback_sub")}/>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginTop:18 }}>
          {/* Type */}
          <div>
            <label className="fb-label">{t("feedback_type")}</label>
            <div className="set-seg" style={{ width:"100%" }}>
              {types.map(ty => (
                <button key={ty.id} className={type===ty.id?"active":""} onClick={()=>setType(ty.id)} style={{ flex:1, display:"inline-flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                  <Icon name={ty.icon} size={14}/>{ty.label}
                </button>
              ))}
            </div>
          </div>
          {/* Name */}
          <div>
            <label className="fb-label">{t("feedback_name")}</label>
            <input className="set-input" style={{ width:"100%" }} value={name} onChange={e=>setName(e.target.value)} placeholder={t("feedback_name_ph")}/>
          </div>
        </div>

        {/* Message */}
        <div style={{ marginTop:14 }}>
          <label className="fb-label">{t("feedback_msg")}</label>
          <textarea className="set-input" style={{ width:"100%", minHeight:96, resize:"vertical", lineHeight:1.5 }}
            value={msg} onChange={e=>setMsg(e.target.value)} placeholder={t("feedback_msg_ph")}></textarea>
        </div>

        {/* Rating + submit */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:16, gap:16, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span className="fb-label" style={{ margin:0 }}>{t("feedback_rating")}</span>
            <div style={{ display:"flex", gap:3 }} onMouseLeave={()=>setHover(0)}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onMouseEnter={()=>setHover(n)} onClick={()=>setRating(n)} style={{ lineHeight:0, padding:1 }}>
                  <Icon name="star" size={22} stroke={1.5}
                    style={{ fill: n <= (hover||rating) ? "#f5a623" : "none", color: n <= (hover||rating) ? "#f5a623" : "#d2d2d7", transition:"all .12s" }}/>
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={submit} disabled={!msg.trim()}>
            <Icon name="reply" size={16}/>{t("feedback_send")}</button>
        </div>
      </div>

      {/* Recent feedback */}
      <div style={{ fontSize:12.5, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:10 }}>{t("feedback_recent")}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {items.map((it, i) => {
          const tone = it.type==="bug" ? "badge-critical" : it.type==="praise" ? "badge-positive" : "badge-neutral";
          const ic = it.type==="bug" ? "alert" : it.type==="praise" ? "heart" : "sparkle";
          return (
            <div key={i} className="card" style={{ padding:"14px 16px", display:"flex", gap:13, animation: i===0 && sent===false ? "none" : "none" }}>
              <div style={{ width:34, height:34, borderRadius:9, background:"var(--card-2)", color:"var(--text-2)", display:"grid", placeItems:"center", flexShrink:0 }}>
                <Icon name={ic} size={16}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                  <span style={{ fontSize:13.5, fontWeight:600 }}>{it.name}</span>
                  <span className={"badge "+tone} style={{ fontSize:10.5 }}>{t("fb_"+it.type)}</span>
                  {it.rating > 0 && <span style={{ marginLeft:"auto" }}><Stars rating={it.rating} size={12}/></span>}
                </div>
                <p style={{ fontSize:13.5, color:"var(--text-2)", lineHeight:1.45 }}>{it["text_"+t._lang]}</p>
              </div>
            </div>
          );
        })}
      </div>

      {sent && <div className="toast"><Icon name="checkCircle" size={16} stroke={2.2} style={{ color:"var(--positive)" }}/>{t("feedback_thanks")}</div>}
    </div>
  );
}

Object.assign(window, { TeamPage, FeedbackBlock });
