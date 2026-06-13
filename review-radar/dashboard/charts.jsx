/* ============ Charts — minimal, Apple-calm ============ */

/* ---------- Donut chart with center label ---------- */
function DonutChart({ data, t, activeCat, onSelect }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const size = 172, outerR = 86, innerR = 60;
  const center = size / 2;
  const [hover, setHover] = useState(null);
  let offset = 0;
  const segments = data.map(d => {
    const frac = total ? d.count / total : 0;
    const start = offset * 360 - 90;
    const end = (offset + frac) * 360 - 90;
    const seg = { ...d, frac, start, end };
    offset += frac;
    return seg;
  });

  const focus = hover != null ? data[hover] : (activeCat ? data.find(d => d.id === activeCat) : null);

  return (
    <div style={{ display:"flex", gap:14, alignItems:"flex-start", flexWrap:"wrap" }}>
      <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display:"block", overflow:"visible" }}>
          {segments.map((s, i) => {
            const dimmed = (activeCat && activeCat !== s.id) || (hover != null && hover !== i);
            const path = donutSlicePath(center, center, outerR, innerR, s.start, s.end);
            return (
              <path key={s.id} d={path} fill={s.color} fillRule="evenodd"
                style={{ opacity: dimmed ? 0.28 : 1, cursor:"pointer", transition:"opacity .2s, transform .15s",
                  transformOrigin:`${center}px ${center}px`, transform: hover === i ? "scale(1.015)" : "scale(1)" }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(s.id === activeCat ? null : s.id)} />
            );
          })}
        </svg>
        <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", textAlign:"center", pointerEvents:"none" }}>
          {focus ? (
            <div className="fade-in" key={focus.id}>
              <div style={{ fontSize:24, fontWeight:700, letterSpacing:"-0.03em" }} className="mono">{Math.round(focus.count/total*100)}%</div>
              <div style={{ fontSize:11.5, color:"var(--text-2)", fontWeight:600, maxWidth:86 }}>{t("cat_"+focus.id)}</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:24, fontWeight:700, letterSpacing:"-0.03em" }} className="mono">{formatDashboardCount(total)}</div>
              <div style={{ fontSize:11.5, color:"var(--text-3)", fontWeight:600 }}>{t("cat_total")}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex:"1 1 150px", minWidth:0, marginTop:3, display:"flex", flexDirection:"column", gap:1 }}>
        {segments.map((s, i) => {
          const sel = activeCat === s.id;
          return (
            <button key={s.id}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(s.id === activeCat ? null : s.id)}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 7px", borderRadius:8,
                background: sel ? "var(--accent-soft)" : (hover === i ? "rgba(0,0,0,0.03)" : "transparent"),
                transition:"background .15s", textAlign:"left", width:"100%" }}>
              <span style={{ width:8, height:8, borderRadius:3, background:s.color, flexShrink:0 }}></span>
              <span style={{ fontSize:13, fontWeight:500, flex:1, minWidth:0, color: sel ? "var(--accent)" : "var(--text)" }}>{t("cat_"+s.id)}</span>
              <span className="mono" style={{ fontSize:12.5, color:"var(--text-2)", fontWeight:600 }}>{s.count.toLocaleString()}</span>
              <span className="mono" style={{ fontSize:11.5, color:"var(--text-3)", fontWeight:600, width:30, textAlign:"right" }}>{Math.round(s.frac*100)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatDashboardCount(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1000000000) return `${(n / 1000000000).toFixed(1)}B`;
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  return Math.round(n).toLocaleString();
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const angle = angleDeg * Math.PI / 180;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function donutSlicePath(cx, cy, outerR, innerR, startAngle, endAngle) {
  const sweep = Math.max(0, endAngle - startAngle);
  if (sweep >= 359.99) {
    return [
      `M ${cx} ${cy - outerR}`,
      `A ${outerR} ${outerR} 0 1 1 ${cx - 0.01} ${cy - outerR}`,
      `A ${outerR} ${outerR} 0 1 1 ${cx} ${cy - outerR}`,
      `M ${cx} ${cy - innerR}`,
      `A ${innerR} ${innerR} 0 1 0 ${cx - 0.01} ${cy - innerR}`,
      `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR}`,
      "Z",
    ].join(" ");
  }
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = sweep > 180 ? 1 : 0;
  return [
    `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
    `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

/* ---------- Combined bar + line trend chart ---------- */
function TrendChart({ data, t, range }) {
  const slice = range === 7 ? data.slice(-7) : range === 90 ? data : data.slice(-30);
  if (!slice.length) {
    return (
      <div style={{ minHeight:240, display:"grid", placeItems:"center", color:"var(--text-3)", fontSize:14, fontWeight:500 }}>
        {t("no_results")}
      </div>
    );
  }
  const W = 760, H = 240, padL = 8, padR = 8, padT = 22, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const maxR = Math.max(1, Math.max(...slice.map(d => d.reviews)) * 1.12);
  const barW = Math.min(26, (iw / slice.length) * 0.55);
  const gap = iw / slice.length;
  const [hover, setHover] = useState(null);

  // health line points (0-100 mapped)
  const hMin = 0, hMax = 100;
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
