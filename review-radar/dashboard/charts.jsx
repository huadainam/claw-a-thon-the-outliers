/* ============ Charts — minimal, Apple-calm ============ */

/* ---------- Donut chart with center label ---------- */
function DonutChart({ data, t, activeCat, onSelect }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const size = 188, stroke = 26, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const [hover, setHover] = useState(null);
  let offset = 0;
  const segments = data.map(d => {
    const frac = d.count / total;
    const seg = { ...d, frac, dash: frac * c, offset: offset * c };
    offset += frac;
    return seg;
  });

  const focus = hover != null ? data[hover] : (activeCat ? data.find(d => d.id === activeCat) : null);

  return (
    <div style={{ display:"flex", gap:22, alignItems:"center", flexWrap:"wrap" }}>
      <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
        <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
          {segments.map((s, i) => {
            const dimmed = (activeCat && activeCat !== s.id) || (hover != null && hover !== i);
            return (
              <circle key={s.id} cx={size/2} cy={size/2} r={r} fill="none"
                stroke={s.color} strokeWidth={hover === i ? stroke + 4 : stroke}
                strokeDasharray={`${s.dash} ${c - s.dash}`} strokeDashoffset={-s.offset}
                strokeLinecap="butt"
                style={{ opacity: dimmed ? 0.28 : 1, cursor:"pointer", transition:"opacity .2s, stroke-width .15s" }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(s.id === activeCat ? null : s.id)} />
            );
          })}
        </svg>
        <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", textAlign:"center", pointerEvents:"none" }}>
          {focus ? (
            <div className="fade-in" key={focus.id}>
              <div style={{ fontSize:26, fontWeight:700, letterSpacing:"-0.03em" }} className="mono">{Math.round(focus.count/total*100)}%</div>
              <div style={{ fontSize:12, color:"var(--text-2)", fontWeight:600, maxWidth:90 }}>{t("cat_"+focus.id)}</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:25, fontWeight:700, letterSpacing:"-0.03em" }} className="mono">{(total/1000).toFixed(1)}k</div>
              <div style={{ fontSize:11.5, color:"var(--text-3)", fontWeight:600 }}>{t("cat_total")}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex:1, minWidth:170, display:"flex", flexDirection:"column", gap:2 }}>
        {segments.map((s, i) => {
          const sel = activeCat === s.id;
          return (
            <button key={s.id}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(s.id === activeCat ? null : s.id)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 9px", borderRadius:9,
                background: sel ? "var(--accent-soft)" : (hover === i ? "rgba(0,0,0,0.03)" : "transparent"),
                transition:"background .15s", textAlign:"left", width:"100%" }}>
              <span style={{ width:9, height:9, borderRadius:3, background:s.color, flexShrink:0 }}></span>
              <span style={{ fontSize:13.5, fontWeight:500, flex:1, color: sel ? "var(--accent)" : "var(--text)" }}>{t("cat_"+s.id)}</span>
              <span className="mono" style={{ fontSize:13, color:"var(--text-2)", fontWeight:600 }}>{s.count.toLocaleString()}</span>
              <span className="mono" style={{ fontSize:12, color:"var(--text-3)", fontWeight:600, width:34, textAlign:"right" }}>{Math.round(s.frac*100)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Combined bar + line trend chart ---------- */
function TrendChart({ data, t, range }) {
  const slice = range === 7 ? data.slice(-7) : range === 90 ? data : data.slice(-30);
  const W = 760, H = 240, padL = 8, padR = 8, padT = 22, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const maxR = Math.max(...slice.map(d => d.reviews)) * 1.12;
  const barW = Math.min(26, (iw / slice.length) * 0.55);
  const gap = iw / slice.length;
  const [hover, setHover] = useState(null);

  // health line points (0-100 mapped)
  const hMin = 60, hMax = 95;
  const pts = slice.map((d, i) => ({
    x: padL + gap * i + gap / 2,
    y: padT + ih - ((d.health - hMin) / (hMax - hMin)) * ih,
    d,
  }));
  const linePath = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${pts[pts.length-1].x} ${padT+ih} L${pts[0].x} ${padT+ih} Z`;

  return (
    <div style={{ position:"relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:"block", overflow:"visible" }}
        onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="healthArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0071e3" stopOpacity="0.14"/>
            <stop offset="100%" stopColor="#0071e3" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cfe2fb"/>
            <stop offset="100%" stopColor="#e6effb"/>
          </linearGradient>
        </defs>
        {/* gridlines */}
        {[0.25, 0.5, 0.75, 1].map(g => (
          <line key={g} x1={padL} x2={W-padR} y1={padT + ih*(1-g)} y2={padT + ih*(1-g)}
            stroke="rgba(0,0,0,0.05)" strokeWidth="1"/>
        ))}
        {/* bars */}
        {slice.map((d, i) => {
          const h = (d.reviews / maxR) * ih;
          const x = padL + gap * i + gap/2 - barW/2;
          const on = hover === i;
          return (
            <g key={i}>
              <rect x={padL + gap*i} y={padT} width={gap} height={ih} fill="transparent"
                onMouseEnter={() => setHover(i)} style={{ cursor:"pointer" }}/>
              <rect x={x} y={padT + ih - h} width={barW} height={h} rx={Math.min(5, barW/2)}
                fill={on ? "#0071e3" : "url(#barGrad)"}
                style={{ transition:"fill .15s", transformOrigin:`center ${padT+ih}px`,
                  animation:`barGrow .6s cubic-bezier(0.22,0.61,0.36,1) ${i*0.012}s both` }}/>
            </g>
          );
        })}
        {/* health area + line */}
        <path d={areaPath} fill="url(#healthArea)"/>
        <path d={linePath} fill="none" stroke="#0071e3" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p, i) => (hover === i || range === 7) && (
          <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 4.5 : 2.6} fill="#fff" stroke="#0071e3" strokeWidth="2.4"/>
        ))}
        {/* x labels — sparse */}
        {slice.map((d, i) => {
          const every = range === 7 ? 1 : range === 90 ? 12 : 5;
          if (i % every !== 0 && i !== slice.length-1) return null;
          return <text key={i} x={padL + gap*i + gap/2} y={H-7} fontSize="10.5" fill="var(--text-3)"
            textAnchor="middle" fontWeight="600">{d.label}</text>;
        })}
        {hover != null && <line x1={pts[hover].x} x2={pts[hover].x} y1={padT} y2={padT+ih} stroke="rgba(0,0,0,0.12)" strokeDasharray="3 3"/>}
      </svg>

      {hover != null && (
        <div className="fade-in" style={{ position:"absolute", top:0,
          left:`${(padL + gap*hover + gap/2) / W * 100}%`, transform:"translate(-50%,-6px)",
          pointerEvents:"none", zIndex:5 }}>
          <div style={{ background:"rgba(30,30,32,0.94)", color:"#fff", borderRadius:11, padding:"9px 12px",
            fontSize:12, whiteSpace:"nowrap", boxShadow:"var(--shadow-pop)", backdropFilter:"blur(8px)" }}>
            <div style={{ fontWeight:700, marginBottom:3, fontSize:12.5 }}>{slice[hover].label}</div>
            <div style={{ display:"flex", alignItems:"center", gap:6, opacity:0.92 }}>
              <span style={{ width:7,height:7,borderRadius:2,background:"#cfe2fb" }}></span>
              {slice[hover].reviews.toLocaleString()} {t("legend_reviews").toLowerCase()}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, opacity:0.92, marginTop:2 }}>
              <span style={{ width:7,height:7,borderRadius:2,background:"#0071e3" }}></span>
              {t("legend_health")}: {slice[hover].health}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { DonutChart, TrendChart });
