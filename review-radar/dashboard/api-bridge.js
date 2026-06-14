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

  function upsertAppSpec(ba) {
    var spec = makeAppSpec(ba);
    var current = window.DATA.APPS[spec.id];
    if (!current) {
      window.DATA.APPS[spec.id] = spec;
      return;
    }
    if (!current.logo && spec.logo) current.logo = spec.logo;
    if (!current.publisher && spec.publisher) current.publisher = spec.publisher;
    if ((!current.platform || current.platform === 'Unknown') && spec.platform) current.platform = spec.platform;
    if ((!current.name || current.name === spec.id) && spec.name) current.name = spec.name;
  }

  function minutesSince(value) {
    var time = value ? new Date(value).getTime() : NaN;
    if (!Number.isFinite(time)) return 999;
    return Math.max(0, Math.round((Date.now() - time) / 60000));
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function dateKeyFromDate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function parseReviewDate(value) {
    if (!value) return null;
    var d = new Date(String(value));
    if (Number.isNaN(d.getTime())) d = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function localDateKey(value) {
    var d = parseReviewDate(value);
    if (d) return dateKeyFromDate(d);
    return String(value || '').slice(0, 10);
  }

  function formatReviewDate(value) {
    var d = parseReviewDate(value);
    if (!d) return value ? String(value).slice(0, 16).replace('T', ' ') : '—';
    return dateKeyFromDate(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function makeAvailableEntry(ba, stats) {
    var s = stats || {};
    var byLabel = (s.by_label) || {};
    var total   = (s.total != null) ? s.total : (ba.total_reviews || ba.totalReviews || 0);
    var bugs    = (byLabel.BUG_REPORT || 0) + (byLabel.COMPLAINT || 0);
    var health  = ba.health || (bugs > 50 ? 'critical' : bugs > 10 ? 'warning' : 'positive');
    var lu = (s.meta && s.meta.last_updated) || ba.last_updated;
    var hourly = ba.hourly_refresh_enabled;
    if (hourly == null && ba.hourlyRefreshEnabled != null) hourly = ba.hourlyRefreshEnabled;
    return {
      app:          ba.app_id,
      lastUpdated:  minutesSince(lu),
      lastUpdatedAt: lu || null,
      hourlyRefreshEnabled: hourly === true,
      queuePosition: ba.queue_position != null ? ba.queue_position : (s.meta && s.meta.queue_position),
      queueWaitingCount: ba.queue_waiting_count != null ? ba.queue_waiting_count : (s.meta && s.meta.queue_waiting_count),
      queueRunning: !!(ba.queue_running || (s.meta && s.meta.queue_running)),
      lastRun: ba.last_run || (s.meta && s.meta.last_run) || null,
      error: ba.error || (s.meta && s.meta.error) || null,
      totalReviews: total,
      health:       health,
      status:       ba.status || (s.meta && s.meta.status) || 'idle',
      progress:     ba.progress || (s.meta && s.meta.progress) || null,
      trend:        null,
    };
  }

  function isZaloPay(entry) {
    var id = String(entry.app || entry.app_id || '').toLowerCase();
    var spec = window.DATA.APPS[entry.app || entry.app_id] || {};
    var name = String(entry.title || spec.name || '').toLowerCase();
    return id === '1112407590' || id.indexOf('zalopay') >= 0 || name.indexOf('zalopay') >= 0;
  }

  function appName(entry) {
    var id = entry.app || entry.app_id;
    var spec = window.DATA.APPS[id] || {};
    return String(entry.title || spec.name || id || '').toLocaleLowerCase('vi');
  }

  function sortAppsForGallery(items) {
    return (items || []).slice().sort(function(a, b) {
      var az = isZaloPay(a), bz = isZaloPay(b);
      if (az && !bz) return -1;
      if (!az && bz) return 1;
      return appName(a).localeCompare(appName(b), 'vi', { sensitivity: 'base' });
    });
  }

  function formatDashboardCount(value) {
    var n = Number(value) || 0;
    var abs = Math.abs(n);
    if (abs >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
    if (abs >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    return Math.round(n).toLocaleString();
  }

  function reviewDateKey(review) {
    var raw = review && review.at;
    if (!raw) return '';
    return localDateKey(raw);
  }

  function latestReviewDateKey(reviews) {
    var latest = '';
    (reviews || []).forEach(function(review) {
      var day = reviewDateKey(review);
      if (day && day > latest) latest = day;
    });
    return latest;
  }

  function sourceDateSummary(reviews, cutoffKey) {
    var key = latestReviewDateKey(reviews);
    return {
      key: key,
      count: key ? countReviewsOn(reviews, key) : 0,
      cutoffKey: cutoffKey || '',
    };
  }

  function countReviewsOn(reviews, dateKey) {
    return (reviews || []).filter(function(r) {
      return reviewDateKey(r) === dateKey;
    }).length;
  }

  function makeKPIs(stats, todos, reviews) {
    var total    = stats.total || 0;
    var byLabel  = stats.by_label || {};
    var todosArr = todos || [];
    var bugs     = byLabel.BUG_REPORT || 0;
    var fixed    = todosArr.filter(function(t){ return todoStatusToActionStatus(t.status) === 'fixed'; }).length;
    var pending  = todosArr.filter(function(t){
      var status = todoStatusToActionStatus(t.status);
      return status === 'open' || status === 'in_progress';
    }).length;
    var sourceDate = sourceDateSummary(reviews, stats.source_cutoff_day || (stats.meta && stats.meta.source_cutoff_day));
    var totalCats = Object.values(byLabel).reduce(function(a, b){ return a + b; }, 0) || 1;
    var pos = byLabel.POSITIVE || 0;
    var neg = (byLabel.COMPLAINT || 0) + (byLabel.BUG_REPORT || 0);
    var healthScore = Math.round(Math.max(0, Math.min(100, ((pos - neg * 0.5) / totalCats * 50) + 70)));

    return [
      { id:"total",    value: formatDashboardCount(total), raw: total, icon:"reviews", trend: null, sub:"all_time", tone:"neutral" },
      { id:"latest",   value: formatDashboardCount(sourceDate.count), raw: sourceDate.count, icon:"calendar", trend: null, sub:"source_latest_day", dateKey: sourceDate.key, tone:"neutral" },
      { id:"critical", value: formatDashboardCount(bugs), raw: bugs,  icon:"alert",    trend: null, sub:"need_fix",     tone:"critical", invert: true },
      { id:"fixed",    value: formatDashboardCount(fixed), raw: fixed, icon:"check",    trend: null, sub:"last_30d",     tone:"positive" },
      { id:"pending",  value: formatDashboardCount(pending), raw: pending, icon:"flag", trend: null, sub:"action_items", tone:"warning",  invert: true },
      { id:"health",   value: String(healthScore),     raw: healthScore, icon:"heart", trend: null, sub:"out_of_100",   tone:"positive", suffix:"/100" },
    ];
  }

  function todoStatusToActionStatus(status) {
    if (status === 'done' || status === 'fixed') return 'fixed';
    if (status === 'in_progress') return 'in_progress';
    if (status === 'ignored') return 'ignored';
    return 'open';
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

  function reviewHealth(review) {
    var score = Number(review && review.score);
    if (Number.isFinite(score) && score > 0) return Math.max(0, Math.min(100, Math.round(score * 20)));
    if (review && review.label === 'POSITIVE') return 90;
    if (review && (review.label === 'BUG_REPORT' || review.label === 'COMPLAINT')) return 35;
    return 65;
  }

  function makeTrend(reviews) {
    var byDay = {};
    (reviews || []).forEach(function(review) {
      var day = reviewDateKey(review);
      if (!day) return;
      if (!byDay[day]) byDay[day] = { reviews: 0, critical: 0, healthTotal: 0 };
      byDay[day].reviews += 1;
      if (review.label === 'BUG_REPORT') byDay[day].critical += 1;
      byDay[day].healthTotal += reviewHealth(review);
    });
    return Object.keys(byDay).sort().map(function(day) {
      var d = new Date(day + 'T00:00:00');
      var row = byDay[day];
      return {
        date: d,
        label: (d.getDate()) + '/' + (d.getMonth() + 1),
        reviews: row.reviews,
        critical: row.critical,
        health: Math.round(row.healthTotal / row.reviews),
      };
    });
  }

  function makeActions(todos, reviews) {
    todos = todos || [];
    reviews = reviews || [];
    var SEV_TO_PRI = { critical: 'critical', medium: 'high', low: 'medium' };
    return todos.map(function(todo) {
      var samples = todo.sample_reviews || [];
      // Count only reviews inside the visible source window, so action items
      // created from current-day partial reviews stay hidden until T+1.
      var linked = reviews.filter(function(r) { return todoMatchesReview(todo, r); }).length;
      return {
        id:       todo.id,
        priority: SEV_TO_PRI[todo.severity] || 'medium',
        flag:     'need_fix',
        status:   todoStatusToActionStatus(todo.status),
        cat:      'bug',
        title_en: todo.topic || '(unknown)',
        title_vi: todo.topic || '(unknown)',
        sampleReviews: samples,
        matchTopic: todo.topic || '',
        owner:    (todo.sources || []).map(function(s){ return s === 'app_store' ? 'App Store' : 'Google Play'; }).join(' / ') || 'Team',
        reviews:  linked,
        version:  '—',
      };
    }).filter(function(action) {
      return action.reviews > 0;
    });
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function todoMatchesReview(todo, review) {
    if (review.label !== 'BUG_REPORT') return false;
    var content = normalizeText(review.content);
    var samples = (todo.sample_reviews || []).map(normalizeText).filter(Boolean);
    if (samples.some(function(sample) { return sample === content; })) return true;

    var topic = normalizeText(todo.topic);
    var bugTopic = normalizeText(review.bug_topic);
    if (!topic || !bugTopic) return false;
    if (topic.length >= 8 && bugTopic.indexOf(topic) >= 0) return true;
    if (bugTopic.length >= 8 && topic.indexOf(bugTopic) >= 0) return true;

    var topicWords = topic.split(' ').filter(function(w) { return w.length > 2 && w !== 'loi'; });
    if (topicWords.length === 0) return false;
    var hits = topicWords.filter(function(w) { return bugTopic.indexOf(w) >= 0; }).length;
    return hits >= Math.min(2, topicWords.length);
  }

  function linkedActionIds(review, todos) {
    return (todos || [])
      .filter(function(todo) { return todoMatchesReview(todo, review); })
      .map(function(todo) { return todo.id; });
  }

  function makeReviews(reviews, todos) {
    reviews = reviews || [];
    return reviews.map(function(r, i) {
      var score = r.score || 3;
      var cat   = LABEL_TO_CAT[r.label] || 'feedback';
      var sent  = score >= 4 ? 'positive' : score <= 2 ? 'negative' : 'neutral';
      var pri   = (r.label === 'BUG_REPORT' && score <= 2) ? 'critical' : r.label === 'BUG_REPORT' ? 'high' : 'medium';
      var flag  = r.label === 'BUG_REPORT' ? 'need_fix' : r.label === 'SPAM' ? 'spam_review' : 'need_reply';
      var content = r.content || '';
      var summary = content.length > 120 ? content.slice(0, 120) + '…' : content;
      return {
        id:         'R-' + String(i + 1).padStart(5, '0'),
        date:       formatReviewDate(r.at),
        dateKey:    localDateKey(r.at),
        rating:     Math.round(Math.min(5, Math.max(1, score))),
        cat:        cat,
        sentiment:  sent,
        priority:   pri,
        flag:       flag,
        status:     'open',
        actionIds:  linkedActionIds(r, todos),
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
        country:    r.country || 'VN',
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

    _patch: function(url, body) {
      return fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(function(r) {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      });
    },

    init: function() {
      var self = this;
      return self._get('/api/apps?lite=1').then(function(data) {
        var apps = sortAppsForGallery(data.apps || []);
        apps.forEach(function(ba) {
          upsertAppSpec(ba);
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
        var apps = sortAppsForGallery(data.apps || []);
        var prevById = {};
        (window.DATA.AVAILABLE || []).forEach(function(e){ prevById[e.app] = e; });
        window.DATA.AVAILABLE = apps.map(function(ba) {
          upsertAppSpec(ba);
          var prev = prevById[ba.app_id] || {};
          var lu = ba.last_updated || prev.lastUpdatedAt || null;
          return {
            app:          ba.app_id,
            lastUpdated:  lu ? minutesSince(lu) : (prev.lastUpdated != null ? prev.lastUpdated : 999),
            lastUpdatedAt: lu,
            hourlyRefreshEnabled: ba.hourly_refresh_enabled === true,
            queuePosition: ba.queue_position,
            queueWaitingCount: ba.queue_waiting_count,
            queueRunning: !!ba.queue_running,
            lastRun: ba.last_run || null,
            error: ba.error || null,
            totalReviews: ba.total_reviews || prev.totalReviews || 0,
            health:       ba.health || prev.health || 'positive',
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

    runNow: function() {
      return this._post('/run', {});
    },

    setHourlyRefresh: function(appId, enabled) {
      return this._patch('/api/apps/' + encodeURIComponent(appId), {
        hourly_refresh_enabled: !!enabled,
      }).then(function(body) {
        window.DATA.AVAILABLE = (window.DATA.AVAILABLE || []).map(function(row) {
          if (row.app !== appId) return row;
          return Object.assign({}, row, { hourlyRefreshEnabled: !!enabled });
        });
        return body;
      });
    },

    patchTodo: function(appId, todoId, patch) {
      var q = appId ? ('?app_id=' + encodeURIComponent(appId)) : '';
      return fetch('/api/todos/' + encodeURIComponent(todoId) + q, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch || {}),
      }).then(function(r) {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      }).then(function(body) {
        if (!body || body.ok === false) throw new Error((body && body.error) || 'Todo update failed');
        return body;
      });
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
          upsertAppSpec(Object.assign({ app_id: appId }, stats.app));
        } else if (stats.app) {
          upsertAppSpec(Object.assign({ app_id: appId }, stats.app));
        }

        window.DATA.KPIS       = makeKPIs(stats, todos, reviews);
        window.DATA.CATEGORIES = makeCategories(stats.by_label);
        window.DATA.ACTIONS    = makeActions(todos, reviews);
        window.DATA.REVIEWS    = makeReviews(reviews, todos);
        window.DATA.SOURCE_DATE = sourceDateSummary(reviews, stats.source_cutoff_day || (stats.meta && stats.meta.source_cutoff_day));

        window.DATA.TREND = makeTrend(reviews);

        // Update the AVAILABLE entry for this app
        var avIdx = window.DATA.AVAILABLE.findIndex(function(a){ return a.app === appId; });
        var prevEntry = avIdx >= 0 ? window.DATA.AVAILABLE[avIdx] : {};
        var appMeta = Object.assign({ app_id: appId }, stats.app || {});
        if (appMeta.hourly_refresh_enabled == null && prevEntry.hourlyRefreshEnabled != null) {
          appMeta.hourly_refresh_enabled = prevEntry.hourlyRefreshEnabled;
        }
        var avEntry = makeAvailableEntry(appMeta, stats);
        if (avIdx >= 0) window.DATA.AVAILABLE[avIdx] = avEntry;
        else window.DATA.AVAILABLE.push(avEntry);
        window.DATA.AVAILABLE = sortAppsForGallery(window.DATA.AVAILABLE);

        return { stats: stats, todos: todos, reviews: reviews };
      }).catch(function(e) {
        console.warn('[ARM_Bridge] loadDashboard failed:', e);
        return null;
      });
    },

    getCrawlProgress: function(appId) {
      var q = appId ? ('?app_id=' + encodeURIComponent(appId)) : '';
      return this._get('/api/stats' + q).then(function(stats) {
        var meta = stats.meta || { status: 'idle', progress: { done: 0, total: 0 } };
        meta.total_reviews = stats.total || 0;
        return meta;
      }).catch(function() {
        return { status: 'idle', progress: { done: 0, total: 0 }, total_reviews: 0 };
      });
    },
  };

})();
