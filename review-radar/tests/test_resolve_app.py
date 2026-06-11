from scraper import resolve_app

def gp_search(name):
    data = {
        "zalo": [{"title": "Zalo", "developer": "VNG", "icon": "i", "app_id": "com.zing.zalo", "store": "google_play"}],
        "zlp": [
            {"title": "ZaloPay", "developer": "VNG", "icon": "i", "app_id": "vn.com.vng.zalopay", "store": "google_play"},
            {"title": "Zalo", "developer": "VNG", "icon": "i", "app_id": "com.zing.zalo", "store": "google_play"},
            {"title": "Zip", "developer": "X", "icon": "i", "app_id": "com.zip", "store": "google_play"},
        ],
        "zzxxqq": [],
    }
    return data.get(name.lower(), [])

def as_search(name):
    data = {
        "zalo": [{"title": "Zalo", "developer": "VNG", "icon": "i", "app_id": "579523206", "store": "app_store"}],
        "zlp": [{"title": "ZaloPay", "developer": "VNG", "icon": "i", "app_id": "1112407880", "store": "app_store"}],
        "zzxxqq": [],
    }
    return data.get(name.lower(), [])

def test_matched_returns_single_app_with_both_ids():
    res = resolve_app("zalo", gp_search=gp_search, as_search=as_search)
    assert res["status"] == "matched"
    assert res["app"]["title"] == "Zalo"
    assert res["app"]["gp_id"] == "com.zing.zalo"
    assert res["app"]["as_id"] == "579523206"

def test_ambiguous_returns_suggestions():
    res = resolve_app("zlp", gp_search=gp_search, as_search=as_search)
    assert res["status"] == "ambiguous"
    titles = [s["title"] for s in res["suggestions"]]
    assert "ZaloPay" in titles
    assert "Zalo" in titles

def test_not_found():
    res = resolve_app("zzxxqq", gp_search=gp_search, as_search=as_search)
    assert res["status"] == "not_found"
    assert "message" in res

def test_matched_when_official_title_has_long_suffix():
    # Regression: real store titles append a tagline (e.g. "Zalopay-Thanh toán &
    # Tài chính"). Full-title similarity scored this 0.378 — below threshold — so
    # the real app was dropped while shorter names ranked above it.
    def gp(name):
        return [{"title": "ZaloPay Merchant", "developer": "VNG", "icon": "i",
                 "app_id": "vn.com.vng.zalopay.mep.merchant", "store": "google_play"}]
    def asr(name):
        return [
            {"title": "Zalopay-Thanh toán & Tài chính", "developer": "VNG", "icon": "i",
             "app_id": "1112407590", "store": "app_store"},
            {"title": "Zalo", "developer": "VNG", "icon": "i",
             "app_id": "579523206", "store": "app_store"},
            {"title": "ZaloPay Merchant", "developer": "VNG", "icon": "i",
             "app_id": "1444720973", "store": "app_store"},
        ]
    res = resolve_app("zalopay", gp_search=gp, as_search=asr)
    assert res["status"] == "matched"
    assert res["app"]["title"] == "Zalopay-Thanh toán & Tài chính"
    assert res["app"]["as_id"] == "1112407590"
