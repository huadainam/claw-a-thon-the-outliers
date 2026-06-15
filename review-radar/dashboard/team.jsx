/* ============ Team & Feedback page ============ */
function TeamPage({ t }) {
  const memberByEmail = Object.fromEntries((window.DATA.TEAM || []).map(m => [m.email, m]));
  const members = [
    { key:"pic", role:"role_pic", name:"pic_name", person:memberByEmail["namhd@vng.com.vn"], lead:true },
  ];

  return (
    <div style={{ maxWidth:920, margin:"0 auto", padding:"32px 40px 70px" }}>
      {/* Hero */}
      <div className="fade-up" style={{ display:"flex", alignItems:"center", gap:18, marginBottom:28 }}>
        <img src="assets/TheOutlier-icon.png" alt="The Outlier" style={{ width:64, height:64, borderRadius:16, boxShadow:"var(--shadow-md)" }}/>
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
            {m.person && m.person.avatar
              ? <img src={m.person.avatar} alt={m.person.name} style={{ width:56, height:56, borderRadius:14, flexShrink:0, objectFit:"cover", boxShadow:"var(--shadow-sm)" }}/>
              : <div className="set-avatar" style={{ width:56, height:56, fontSize:19, borderRadius:14,
                  background:`linear-gradient(145deg, ${(m.person && m.person.color && m.person.color[0]) || "#7bd3ff"}, ${(m.person && m.person.color && m.person.color[1]) || "#0a84ff"})` }}>
                  {(m.person && m.person.initials) || "?"}
                </div>}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap" }}>
                <span style={{ fontSize:17, fontWeight:700, letterSpacing:"-0.02em" }}>{(m.person && m.person.name) || t(m.name)}</span>
                <span className={"badge " + (m.lead ? "badge-neutral" : "badge-muted")}>{t(m.role)}</span>
              </div>
              {m.person && m.person.email && (
                <div style={{ fontSize:12.5, color:"var(--text-3)", marginTop:2 }}>{m.person.email}</div>
              )}
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
    { type:"bug", name:"Huy T.", text_en:"The trend chart sometimes overlaps the labels on small screens.", text_vi:"Biểu đồ xu hướng đôi khi đè lên nhãn ngày trên màn hình nhỏ.", rating:3 },
    { type:"idea", name:"Lan V.", text_en:"Please add CSV export for the review detail table.", text_vi:"Mong có xuất CSV cho bảng chi tiết đánh giá.", rating:4 },
    { type:"praise", name:"Quang Đ.", text_en:"Auto-grouping bugs into action items saves us so much time.", text_vi:"Tự gom bug thành việc cần xử lý tiết kiệm rất nhiều thời gian.", rating:5 },
    { type:"idea", name:"Thảo N.", text_en:"A dark mode would be perfect for late-night monitoring.", text_vi:"Có chế độ tối thì theo dõi ban đêm sẽ tuyệt hơn.", rating:4 },
  ]);

  const types = [
    { id:"idea", icon:"sparkle", label:t("fb_idea") },
    { id:"bug", icon:"alert", label:t("fb_bug") },
    { id:"praise", icon:"heart", label:t("fb_praise") },
  ];

  // Load the shared, persisted feedback log so it survives reloads and everyone
  // sees the same entries. The dummy items above show only until this resolves
  // (and stay as a friendly placeholder when no real feedback exists yet).
  useEffect(() => {
    let alive = true;
    window.ARM_Bridge.getFeedback().then(list => {
      if (alive && Array.isArray(list) && list.length) setItems(list);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const submit = () => {
    if (!msg.trim()) return;
    const L = t._lang;
    const text = msg.trim();
    const optimistic = { type, name: name.trim() || (L==="vi"?"Ẩn danh":"Anonymous"),
                         rating, text_vi:text, text_en:text };
    setItems([optimistic, ...items]);               // show instantly
    setSent(true); setMsg(""); setName(""); setRating(0); setType("idea");
    setTimeout(() => setSent(false), 2800);
    // Persist to the shared store; reconcile with the authoritative list on success.
    window.ARM_Bridge.submitFeedback({ type: optimistic.type, name: optimistic.name, text: text, rating: optimistic.rating })
      .then(res => { if (res && Array.isArray(res.items)) setItems(res.items); })
      .catch(() => { /* keep the optimistic entry if the network call fails */ });
  };

  return (
    <div className="fade-up" style={{ animationDelay:".2s" }}>
      <div className="card" style={{ padding:"22px 24px", marginBottom:18 }}>
        <CardHead title={t("feedback_title")} sub={t("feedback_sub")}/>
        <div style={{ display:"inline-flex", alignItems:"center", gap:7, marginTop:10, padding:"7px 10px",
          borderRadius:10, background:"var(--accent-soft)", color:"var(--accent)", fontSize:12.5, fontWeight:600 }}>
          <Icon name="mail" size={14}/>
          <span>{t("feedback_contact")}</span>
        </div>

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
