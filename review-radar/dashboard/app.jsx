/* ============ Main App — routing + language + real backend integration ============ */
function App() {
  const [lang, setLang] = useState(() => localStorage.getItem("arm_lang") || "en");
  const [screen, setScreen] = useState("initializing");
  const [activeApp, setActiveApp] = useState(null);
  const [dashView, setDashView] = useState("overview");
  const [navCollapsed, setNavCollapsed] = useState(() => localStorage.getItem("arm_nav") === "1");
  const [dataVersion, setDataVersion] = useState(0);
  const [availVersion, setAvailVersion] = useState(0);  // bumps when app statuses refresh
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);

  useEffect(() => { localStorage.setItem("arm_lang", lang); }, [lang]);
  useEffect(() => { localStorage.setItem("arm_nav", navCollapsed ? "1" : "0"); }, [navCollapsed]);

  const dismissToast = (id) => setToasts(ts => ts.filter(x => x.id !== id));

  // Global poll: keep the gallery's per-app crawl status fresh and raise an
  // Apple-style toast the moment any app's scrape transitions analyzing -> idle.
  useEffect(() => {
    let cancelled = false, timer = null;
    const prevStatus = {};      // app_id -> last seen status
    let primed = false;         // skip toasts on the very first snapshot
    let lastSig = "";           // re-render only when the status set changes
    const poll = () => {
      window.ARM_Bridge.refreshApps().then(({ apps }) => {
        if (cancelled) return;
        apps.forEach(a => {
          const was = prevStatus[a.app_id];
          if (primed && was === "analyzing" && a.status === "idle") {
            const dict = window.DATA.I18N[langRef.current];
            const spec = window.DATA.APPS[a.app_id] || {};
            const n = (a.progress && a.progress.total) || 0;
            const sub = n > 0
              ? (dict.toast_scrape_done + " · +" + n + " " + dict.reviews_word)
              : dict.toast_scrape_done;
            const id = ++toastIdRef.current;
            setToasts(ts => [...ts, { id, app: a.app_id, title: spec.name || a.title || a.app_id, sub }].slice(-4));
          }
          prevStatus[a.app_id] = a.status;
        });
        primed = true;
        // Bump only when statuses (or in-progress counts) actually changed.
        const sig = apps.map(a => a.app_id + ":" + a.status + ":" + ((a.progress && a.progress.done) || 0)).join("|");
        if (sig !== lastSig) { lastSig = sig; setAvailVersion(v => v + 1); }
        const anyAnalyzing = apps.some(a => a.status === "analyzing");
        timer = setTimeout(poll, anyAnalyzing ? 2500 : 6000);
      }).catch(() => { if (!cancelled) timer = setTimeout(poll, 6000); });
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // Init: always land on the app gallery. The backend may still have an active
  // app for scheduled crawls, but the first screen should be "all available apps"
  // so users can choose what they want to inspect.
  useEffect(() => {
    window.ARM_Bridge.init().then(({ appId }) => {
      if (appId) setActiveApp(appId);
      setScreen("selection");
    }).catch(() => setScreen("selection"));
  }, []);

  const t = useMemo(() => {
    const dict = window.DATA.I18N[lang];
    const fn = (k) => (dict[k] != null ? dict[k] : k);
    fn._lang = lang;
    return fn;
  }, [lang]);

  const scrollTop = () => { const m = document.querySelector(".main-area"); if (m) m.scrollTop = 0; };
  const go = (s) => { setScreen(s); requestAnimationFrame(scrollTop); };

  // Called from Screen 1 when user confirms a new app from search results
  // appOrObj: raw backend app object (has title, gp_id/as_id, etc.) OR a string app_id
  const handleConfirm = (appOrObj, reviewLimit) => {
    let appObj, appId;
    if (typeof appOrObj === "string") {
      appId  = appOrObj;
      appObj = { app_id: appId, title: window.DATA.APPS[appId] ? window.DATA.APPS[appId].name : appId };
    } else {
      appObj = appOrObj;
      appId  = appObj.app_id || appObj.gp_id || appObj.as_id
               || (appObj.title || "").toLowerCase().replace(/[\s.]+/g, "_");
      // Ensure spec exists
      if (!window.DATA.APPS[appId]) {
        const name = appObj.title || appId;
        const stores = appObj.stores || [];
        const platform = stores.includes("app_store") && stores.includes("google_play")
          ? "App Store & Google Play"
          : stores.includes("app_store") ? "App Store"
          : stores.includes("google_play") ? "Google Play" : "—";
        window.DATA.APPS[appId] = {
          id: appId, name, logo: appObj.icon || "", glyph: name.slice(0, 2).toUpperCase(),
          grad: ["#0a84ff", "#0058c8"], publisher: appObj.developer || "", platform,
        };
      }
    }

    // Attach the user-chosen number of reviews to scrape (persisted per app).
    if (reviewLimit) appObj = Object.assign({}, appObj, { review_limit: reviewLimit });

    setActiveApp(appId);
    setDashView("overview");

    window.ARM_Bridge.track(appObj).then(res => {
      if (res && res.cached) {
        // Already crawled — load data and go straight to dashboard
        window.ARM_Bridge.loadDashboard(appId).then(() => {
          setDataVersion(v => v + 1);
          go("dashboard");
        }).catch(() => go("dashboard"));
      } else {
        go("crawling");
      }
    }).catch(() => go("crawling"));
  };

  // Called from Screen 1 when user opens an already-tracked app
  const handleOpenDashboard = (appId) => {
    setActiveApp(appId);
    setDashView("overview");
    go("dashboard"); // show dashboard immediately (may show stale/mock data briefly)
    window.ARM_Bridge.setActive(appId).then(() =>
      window.ARM_Bridge.loadDashboard(appId)
    ).then(() => {
      setDataVersion(v => v + 1);
    }).catch(console.warn);
  };

  // Called from Screen 1 when user clicks an app that is currently scraping
  const handleOpenCrawling = (appId) => {
    setActiveApp(appId);
    window.ARM_Bridge.setActive(appId).catch(() => {});
    go("crawling");
  };

  const onDashNav = (viewId) => { setDashView(viewId); requestAnimationFrame(scrollTop); };
  const refreshActiveDashboard = () => {
    if (!activeApp) return Promise.resolve();
    return window.ARM_Bridge.loadDashboard(activeApp).then(() => {
      setDataVersion(v => v + 1);
    });
  };

  // Loading splash
  if (screen === "initializing") {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", background:"var(--bg)" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ width:48, height:48, borderRadius:13, background:"linear-gradient(160deg,#0a84ff,#0058c8)",
            display:"grid", placeItems:"center", margin:"0 auto 18px",
            boxShadow:"0 3px 12px rgba(0,113,227,0.35)" }}>
            <Icon name="sparkle" size={22} stroke={2} style={{ color:"#fff" }}/>
          </div>
          <div style={{ fontSize:16, fontWeight:700, letterSpacing:"-0.02em" }}>App Review Monitor</div>
          <div style={{ fontSize:13, color:"var(--text-3)", marginTop:4 }}>Loading…</div>
          <div style={{ marginTop:18, display:"flex", justifyContent:"center" }}>
            <div style={{ width:20, height:20, borderRadius:"50%", border:"2px solid rgba(0,113,227,0.2)", borderTopColor:"var(--accent)", animation:"spin 0.8s linear infinite" }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Toaster toasts={toasts} onDismiss={dismissToast}/>
      <Sidebar screen={screen} lang={lang} setLang={setLang} t={t} go={go}
        activeApp={activeApp || "zalopay"} dashSection={dashView} onDashNav={onDashNav}
        collapsed={navCollapsed} onToggleNav={() => setNavCollapsed(c => !c)}/>
      <div className="main-area">
        {screen === "selection" && (
          <AppSelection key={"sel"+lang} t={t} lang={lang} availVersion={availVersion}
            onConfirm={handleConfirm} onOpenDashboard={handleOpenDashboard} onOpenCrawling={handleOpenCrawling}/>
        )}
        {screen === "crawling" && (
          <Crawling key={"crawl"+(activeApp||"app")} t={t} app={activeApp || "zalopay"}
            onDone={() => {
              window.ARM_Bridge.loadDashboard(activeApp).then(() => {
                setDataVersion(v => v + 1);
                go("dashboard");
              }).catch(() => go("dashboard"));
            }}
            onBack={() => go("selection")}/>
        )}
        {screen === "dashboard" && (
          <Dashboard key={"dash"+(activeApp||"app")+lang+dataVersion}
            t={t} app={activeApp || "zalopay"} onBack={() => go("selection")}
            view={dashView} onNav={onDashNav} onDataChanged={refreshActiveDashboard}/>
        )}
        {screen === "reports" && (
          <ReportsPage key={"rep"+lang} t={t}/>
        )}
        {screen === "compare" && (
          <ComparePage key={"cmp"+lang} t={t}/>
        )}
        {screen === "team" && (
          <TeamPage key={"team"+lang} t={t}/>
        )}
        {screen === "settings" && (
          <SettingsPage key={"set"+lang} t={t} lang={lang} setLang={setLang}/>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
