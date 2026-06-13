/* ============ API Bridge: connects the React design to the real Flask backend ============ */
(function () {

  const GRAD_PALETTE = [
    ['#0a84ff', '#0058c8'], ['#34c759', '#248a3d'], ['#ff375f', '#c0002a'],
    ['#ff9f0a', '#c07000'], ['#af52de', '#7a1fa2'], ['#32ade6', '#1d7ea8'],
    ['#ff6961', '#c0392b'], ['#5ac8fa', '#1a7fa8'], ['#ffcc00', '#b88000'],
    ['#ff2d55', '#b00028'], ['#4cd964', '#2e8b44'], ['#007aff', '#0040c8'],
  ];

  function gradFor(id) {
    var hash = 0;
    for (var i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
    return GRAD_PALETTE[Math.abs(hash) % GRAD_PALETTE.length];
  }

  var LABEL_TO_CAT = {
    BUG_REPORT: 'bug',
    FEATURE_REQUEST: 'feature',
    COMPLAINT: 'negative',
    POSITIVE: 'positive',
    SPAM: 'spam',
    FEEDBACK: 'feedback',
  };

  var CAT_COLORS = {
    positive:    'var(--cat-positive)',
    feedback:    'var(--cat-feedback)',
    bug:         'var(--cat-bug)',
    negative:    'var(--cat-negative)',
    feature:     'var(--cat-feature)',
    criticalbug: 'var(--cat-criticalbug)',
    spam:        'var(--cat-spam)',
  };

  function makeAppSpec(ba) {
    var id   = ba.app_id || ba.gp_id || ba.as_id || (ba.title || 'unknown').toLowerCase().replace(/[\s.]+/g, '_');
    var name = ba.title || id;
    var stores = ba.stores || [];
    var platform = (stores.indexOf('app_store') >= 0 && stores.indexOf('google_play') >= 0)
      ? 'App Store & Google Play'
      : stores.indexOf('app_store') >= 0 ? 'App Store'
      : stores.indexOf('google_play') >= 0 ? 'Google Play'
      : ba.platform || 'Unknown';
    return {
      id: id,
      name: name,
      logo: ba.icon || '',
      glyph: name.slice(0, 2).toUpperCase(),
      grad: gradFor(id),
      publisher: ba.developer || '',
      platform: platform,
    };
  }

  function makeAvailableEntry(ba, stats) {
    var s = stats || {};
    var byLabel = (s.by_label) || {};
    var total   = s.total || 0;
    var bugs    = (byLabel.BUG_REPORT || 0) + (byLabel.COMPLAINT || 0);
    var health  = bugs > 50 ? 'critical' : bugs > 10 ? 'warning' : 'positive';
    var lu = (s.meta && s.meta.last_updated) || ba.last_updated;
    var minAgo = lu ? Math.round((Date.now() - new Date(lu).getTime()) / 60000) : 999;
    return {
      app:          ba.app_id,
      lastUpdated:  minAgo,
      totalReviews: total,
      health:       health,
      status:       ba.status || (s.meta && s.meta.status) || 'idle',
      progress:     ba.progress || (s.meta && s.meta.progress) || null,
      trend:        null,
    };
  }

  function makeKPIs(stats, todos) {
    var total    = stats.total || 0;
    var byLabel  = stats.by_label || {};
    var todosArr = todos || [];
    var bugs     = byLabel.BUG_REPORT || 0;
    var fixed    = todosArr.filter(function(t){ return t.status === 'done'; }).length;
    var pending  = todosArr.filter(function(t){ return t.status === 'open'; }).length;
    var totalCats = Object.values(byLabel).reduce(function(a, b){ return a + b; }, 0) || 1;
    var pos = byLabel.POSITIVE || 0;
    var neg = (byLabel.COMPLAINT || 0) + (byLabel.BUG_REPORT || 0);
    var healthScore = Math.round(Math.max(0, Math.min(100, ((pos - neg * 0.5) / totalCats * 50) + 70)));

    return [
      { id:"total",    value: total.toLocaleString(),  raw: total,    icon:"reviews",  trend: null, sub:"all_time",     tone:"neutral" },
      { id:"today",    value: "—",                     raw: 0,        icon:"calendar", trend: null, sub:"vs_yesterday", tone:"neutral" },
      { id:"critical", value: String(bugs),            raw: bugs,     icon:"alert",    trend: null, sub:"need_fix",     tone:"critical", invert: true },
      { id:"fixed",    value: String(fixed),           raw: fixed,    icon:"check",    trend: null, sub:"last_30d",     tone:"positive" },
      { id:"pending",  value: String(pending),         raw: pending,  icon:"flag",     trend: null, sub:"action_items", tone:"warning",  invert: true },
      { id:"health",   value: String(healthScore),     raw: healthScore, icon:"heart", trend: null, sub:"out_of_100",   tone:"positive", suffix:"/100" },
    ];
  }

  function makeCategories(byLabel) {
    byLabel = byLabel || {};
    var merged = {};
    Object.entries(byLabel).forEach(function(entry) {
      var label = entry[0], count = entry[1];
      var cat = LABEL_TO_CAT[label] || 'feedback';
      if (merged[cat]) merged[cat].count += count;
      else merged[cat] = { id: cat, count: count, color: CAT_COLORS[cat] || 'var(--cat-feedback)' };
    });
    return Object.values(merged).filter(function(e){ return e.count > 0; }).sort(function(a, b){ return b.count - a.count; });
  }

  function makeTrend(bugByDay) {
    bugByDay = bugByDay || {};
    var days = Object.keys(bugByDay).sort();
    if (days.length === 0) return window.DATA.TREND;
    return days.map(function(day) {
      var d = new Date(day + 'T00:00:00');
      return {
        date: d,
        label: (d.getDate()) + '/' + (d.getMonth() + 1),
        reviews: bugByDay[day] || 0,
        critical: bugByDay[day] || 0,
        health: 80,
      };
    });
  }

  function makeActions(todos) {
    todos = todos || [];
    var SEV_TO_PRI = { critical: 'critical', medium: 'high', low: 'medium' };
    return todos.map(function(todo) {
      return {
        id:       todo.id,
        priority: SEV_TO_PRI[todo.severity] || 'medium',
        flag:     'need_fix',
        status:   todo.status === 'done' ? 'fixed' : 'open',
        cat:      'bug',
        title_en: todo.topic || '(unknown)',
        title_vi: todo.topic || '(unknown)',
        owner:    (todo.sources || []).map(function(s){ return s === 'app_store' ? 'App Store' : 'Google Play'; }).join(' / ') || 'Team',
        reviews:  todo.mention_count || 0,
        version:  '—',
      };
    });
  }

  function makeReviews(reviews) {
    reviews = reviews || [];
    return reviews.slice(0, 200).map(function(r, i) {
      var score = r.score || 3;
      var cat   = LABEL_TO_CAT[r.label] || 'feedback';
      var sent  = score >= 4 ? 'positive' : score <= 2 ? 'negative' : 'neutral';
      var pri   = (r.label === 'BUG_REPORT' && score <= 2) ? 'critical' : r.label === 'BUG_REPORT' ? 'high' : 'medium';
      var flag  = r.label === 'BUG_REPORT' ? 'need_fix' : r.label === 'SPAM' ? 'spam_review' : 'need_reply';
      var content = r.content || '';
      var summary = content.length > 120 ? content.slice(0, 120) + '…' : content;
      return {
        id:         'R-' + String(i + 1).padStart(5, '0'),
        date:       r.at ? r.at.slice(0, 16).replace('T', ' ') : '—',
        rating:     Math.round(Math.min(5, Math.max(1, score))),
        cat:        cat,
        sentiment:  sent,
        priority:   pri,
        flag:       flag,
        status:     'open',
        summary_en: summary,
        summary_vi: summary,
        text_en:    content,
        text_vi:    content,
        issue_en:   '—',
        issue_vi:   '—',
        action_en:  '—',
        action_vi:  '—',
        version:    r.version || '—',
        device:     r.source === 'app_store' ? 'iPhone' : 'Android',
        country:    'VN',
        platform:   r.source === 'app_store' ? 'App Store' : 'Google Play',
      };
    });
  }

  window.ARM_Bridge = {

    _get: function(url) {
      return fetch(url, { cache: 'no-store' }).then(function(r) {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      });
    },

    _post: function(url, body) {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(function(r) {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      });
    },

    init: function() {
      var self = this;
      return self._get('/api/apps').then(function(data) {
        var apps = data.apps || [];
        apps.forEach(function(ba) {
          if (!window.DATA.APPS[ba.app_id]) {
            window.DATA.APPS[ba.app_id] = makeAppSpec(ba);
          }
        });
        window.DATA.AVAILABLE = apps.map(function(ba){ return makeAvailableEntry(ba, null); });
        return { hasActiveApp: !!data.active_app_id, appId: data.active_app_id, apps: apps };
      }).catch(function(e) {
        console.warn('[ARM_Bridge] init failed:', e);
        return { hasActiveApp: false, appId: null, apps: [] };
      });
    },

    // Lightweight poll: refresh per-app crawl status, preserving any review
    // totals/health already learned from opening an app. Returns the app list
    // (each with .status) so the caller can detect scrape completion.
    refreshApps: function() {
      return this._get('/api/apps').then(function(data) {
        var apps = data.apps || [];
        var prevById = {};
        (window.DATA.AVAILABLE || []).forEach(function(e){ prevById[e.app] = e; });
        window.DATA.AVAILABLE = apps.map(function(ba) {
          if (!window.DATA.APPS[ba.app_id]) window.DATA.APPS[ba.app_id] = makeAppSpec(ba);
          var prev = prevById[ba.app_id] || {};
          var lu = ba.last_updated;
          var minAgo = lu ? Math.round((Date.now() - new Date(lu).getTime()) / 60000)
                          : (prev.lastUpdated != null ? prev.lastUpdated : 999);
          return {
            app:          ba.app_id,
            lastUpdated:  minAgo,
            totalReviews: prev.totalReviews || 0,
            health:       prev.health || 'positive',
            status:       ba.status || 'idle',
            progress:     ba.progress || null,
            trend:        null,
          };
        });
        return { apps: apps, activeAppId: data.active_app_id };
      }).catch(function(e) {
        console.warn('[ARM_Bridge] refreshApps failed:', e);
        return { apps: [], activeAppId: null };
      });
    },

    resolve: function(name) {
      return this._post('/api/resolve', { name: name });
    },

    track: function(appObj) {
      return this._post('/api/track', appObj);
    },

    setActive: function(appId) {
      return this._post('/api/active', { app_id: appId });
    },

    loadDashboard: function(appId) {
      var self = this;
      // Pass app_id explicitly so each app fetches its own data via a distinct
      // URL — independent of the server's active-app state and the HTTP cache.
      var q = appId ? ('?app_id=' + encodeURIComponent(appId)) : '';
      return Promise.all([
        self._get('/api/stats' + q),
        self._get('/api/todos' + q),
        self._get('/api/reviews' + q),
      ]).then(function(results) {
        var stats   = results[0];
        var todos   = results[1];
        var reviews = results[2];

        if (stats.app && !window.DATA.APPS[appId]) {
          window.DATA.APPS[appId] = makeAppSpec(Object.assign({ app_id: appId }, stats.app));
        }

        window.DATA.KPIS       = makeKPIs(stats, todos);
        window.DATA.CATEGORIES = makeCategories(stats.by_label);
        window.DATA.ACTIONS    = makeActions(todos);
        window.DATA.REVIEWS    = makeReviews(reviews);

        var trend = makeTrend(stats.bug_by_day);
        if (trend !== window.DATA.TREND) window.DATA.TREND = trend;

        // Update the AVAILABLE entry for this app
        var avIdx = window.DATA.AVAILABLE.findIndex(function(a){ return a.app === appId; });
        var avEntry = makeAvailableEntry({ app_id: appId }, stats);
        if (avIdx >= 0) window.DATA.AVAILABLE[avIdx] = avEntry;
        else window.DATA.AVAILABLE.push(avEntry);

        return { stats: stats, todos: todos, reviews: reviews };
      }).catch(function(e) {
        console.warn('[ARM_Bridge] loadDashboard failed:', e);
        return null;
      });
    },

    getCrawlProgress: function(appId) {
      var q = appId ? ('?app_id=' + encodeURIComponent(appId)) : '';
      return this._get('/api/stats' + q).then(function(stats) {
        return stats.meta || { status: 'idle', progress: { done: 0, total: 0 } };
      }).catch(function() {
        return { status: 'idle', progress: { done: 0, total: 0 } };
      });
    },
  };

})();
