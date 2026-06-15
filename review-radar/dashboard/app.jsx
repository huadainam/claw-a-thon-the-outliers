/* ============ Main App — routing + language + real backend integration ============ */
function formatToastCount(value) {
  return Math.max(0, Number(value) || 0).toLocaleString();
}

function buildCrawlToastSub(dict, appRow) {
  const run = appRow.last_run || {};
  const error = run.error || appRow.error;
  if (error) return `${dict.toast_crawl_error}: ${error}`;

  if (run.used_fallback) return dict.toast_crawl_fallback;

  const crawled = Number(run.crawled_reviews || 0);
  const classified = Number(run.classified_reviews || 0);
  const newReviews = Number(run.new_reviews || 0);
  const fallbackClassified = (appRow.progress && appRow.progress.total) || 0;
  // The real outcome of a refresh is how many genuinely NEW reviews were added —
  // the crawled total includes reviews already in the store (duplicates), so the
  // notification reports the new count, not the crawled count.
  const added = classified || newReviews || fallbackClassified;

  if (added > 0) {
    return `${dict.toast_added} ${formatToastCount(added)} ${dict.toast_new_reviews}`;
  }
  if (crawled > 0) {
    return dict.toast_no_new_reviews;
  }
  return dict.toast_no_reviews_fetched || dict.toast_scrape_done;
}

function App() {
  const [lang, setLang] = useState(() => localStorage.getItem("arm_lang") || "vi");
  const [screen, setScreen] = useState("initializing");
  const [activeApp, setActiveApp] = useState(null);
  const [dashView, setDashView] = useState("overview");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [availVersion, setAvailVersion] = useState(0);  // bumps when app statuses refresh
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);

  useEffect(() => { localStorage.setItem("arm_lang", lang); }, [lang]);
  useEffect(() => { localStorage.removeItem("arm_nav"); }, []);

  const dismissToast = (id) => setToasts(ts => ts.filter(x => x.id !== id));
  const isBusyStatus = (status) => status === "analyzing" || status === "queued";

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
          if (primed && isBusyStatus(was) && a.status === "idle") {
            const dict = window.DATA.I18N[langRef.current];
            const spec = window.DATA.APPS[a.app_id] || {};
            const sub = buildCrawlToastSub(dict, a);
            const id = ++toastIdRef.current;
            setToasts(ts => [...ts, { id, app: a.app_id, title: spec.name || a.title || a.app_id, sub }].slice(-4));
          }
          prevStatus[a.app_id] = a.status;
        });
        primed = true;
        // Bump only when statuses, queue positions, or in-progress counts changed.
        const sig = apps.map(a => [
          a.app_id,
          a.status,
          a.queue_position || "",
          a.last_updated || "",
          a.error || "",
          a.total_reviews != null ? a.total_reviews : "",
          a.hourly_refresh_enabled === false ? "0" : "1",
          a.last_run ? JSON.stringify(a.last_run) : "",
          (a.progress && a.progress.done) || 0,
        ].join(":")).join("|");
        if (sig !== lastSig) { lastSig = sig; setAvailVersion(v => v + 1); }
        const anyAnalyzing = apps.some(a => isBusyStatus(a.status));
        // Match the detail view's 2s cadence while a crawl runs so the gallery
        // progress bar stays in sync with it (not visibly lagging behind).
        timer = setTimeout(poll, anyAnalyzing ? 2000 : 6000);
      }).catch(() => { if (!cancelled) timer = setTimeout(poll, 6000); });
    };
    timer = setTimeout(poll, 1200);
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
  // Load an app's data, retrying on a failed fetch (the Memory backend can
  // return a transient error on the first cold read). Bumps dataVersion to
  // remount the dashboard once data is in. Without this, a failed first load
  // left the dashboard empty until the user manually backed out and re-entered.
  const loadDashboardWithRetry = (appId, tries = 4) =>
    window.ARM_Bridge.loadDashboard(appId).then(res => {
      if (res) { setDataVersion(v => v + 1); return res; }
      if (tries > 1) {
        return new Promise(r => setTimeout(r, 700)).then(() => loadDashboardWithRetry(appId, tries - 1));
      }
      return null;
    });

  const handleOpenDashboard = (appId) => {
    setActiveApp(appId);
    setDashView("overview");
    go("dashboard"); // show dashboard immediately; data fills in once loaded
    window.ARM_Bridge.setActive(appId).catch(() => {});
    loadDashboardWithRetry(appId).catch(console.warn);
  };

  // Called from Screen 1 when user clicks an app that is currently scraping
  const handleOpenCrawling = (appId, startRun = false) => {
    setActiveApp(appId);
    const activation = window.ARM_Bridge.setActive(appId);
    if (startRun) {
      activation
        .then(() => window.ARM_Bridge.runNow())
        .catch(console.warn);
    } else {
      activation.catch(() => {});
    }
    go("crawling");
  };

  const onDashNav = (viewId) => { setDashView(viewId); requestAnimationFrame(scrollTop); };
  const refreshActiveDashboard = () => {
    if (!activeApp) return Promise.resolve();
    return loadDashboardWithRetry(activeApp);
  };

  // Loading splash
  if (screen === "initializing") {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", background:"var(--bg)" }}>
        <div style={{ textAlign:"center" }}>
          <img src="assets/app-icon.png" alt="Review Radar"
            style={{ width:48, height:48, borderRadius:13, objectFit:"cover", display:"block", margin:"0 auto 18px",
              boxShadow:"0 3px 12px rgba(0,0,0,0.22)" }}/>
          <div style={{ fontSize:16, fontWeight:700, letterSpacing:"-0.02em" }}>Review Radar</div>
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
              loadDashboardWithRetry(activeApp).finally(() => go("dashboard"));
            }}
            onOpenDashboard={handleOpenDashboard}
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
