import base64
import json
import os
import subprocess
import time

import requests

IAM_TOKEN_URL = "https://iam.api.vngcloud.vn/accounts-api/v2/auth/token"
_TOKEN_SAFETY_MARGIN = 60  # refresh this many seconds before JWT exp

# Module-level token cache (shared across MemoryHTTP instances within a process).
_token_cache = {"value": None, "exp": 0}

# Module-level write-through cache of the latest document per session, keyed by
# (memory_id, actor_id, session_id). The events index is eventually consistent
# (a just-posted event can be briefly invisible to a list query), and the app
# does load -> modify -> save -> load within a single process. Caching the last
# written value gives read-your-writes consistency; on a fresh container the
# cache is empty so reads fall through to Memory (the persisted state). Safe
# because the runtime uses a single replica.
_doc_cache = {}


def _jwt_exp(token: str) -> int:
    """Best-effort decode of a JWT's exp claim. Returns 0 if undecodable."""
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)  # pad base64
        data = json.loads(base64.urlsafe_b64decode(payload))
        return int(data.get("exp", 0))
    except Exception:
        return 0


def _token_from_iam() -> str:
    """Fetch an IAM token using the service-account credentials that AgentBase
    Runtime auto-injects into the container (GREENNODE_CLIENT_ID/SECRET)."""
    cid = os.getenv("GREENNODE_CLIENT_ID")
    csec = os.getenv("GREENNODE_CLIENT_SECRET")
    if not cid or not csec:
        return ""
    resp = requests.post(
        IAM_TOKEN_URL,
        auth=(cid, csec),
        data={"grant_type": "client_credentials"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get("access_token", "")


def _token_from_script() -> str:
    """Local-dev fallback: use the AgentBase helper script at the repo root.
    Only works when running from review-radar/ with .claude/ one level up."""
    out = subprocess.run(
        ["bash", ".claude/skills/agentbase/scripts/get_token.sh"],
        capture_output=True, text=True, cwd="..",
    )
    return out.stdout.strip()


def _default_token_getter() -> str:
    """Return a cached IAM token, refreshing when missing or near expiry.

    In the deployed container the platform injects GREENNODE_CLIENT_ID/SECRET,
    so we mint the token directly via the IAM endpoint (the helper script is not
    bundled in the image). Locally we fall back to that script.
    """
    now = time.time()
    if _token_cache["value"] and _token_cache["exp"] - _TOKEN_SAFETY_MARGIN > now:
        return _token_cache["value"]

    token = _token_from_iam() or _token_from_script()
    if not token:
        raise RuntimeError(
            "Could not obtain an IAM token: set GREENNODE_CLIENT_ID/"
            "GREENNODE_CLIENT_SECRET (auto-injected on AgentBase) or run from the "
            "repo so .claude/skills/agentbase/scripts/get_token.sh is reachable."
        )
    exp = _jwt_exp(token)
    # Fall back to a 5-minute lifetime if the token is not a decodable JWT.
    _token_cache["value"] = token
    _token_cache["exp"] = exp if exp else int(now + 300)
    return token


class MemoryHTTP:
    """Thin client over the AgentBase Memory *events* API, used by MemoryStore as
    a key-value document log: each save appends one event whose ``message`` holds
    a JSON document; the newest event for a session is the current value."""

    # The service returns events newest-first and caps page size at 100, so the
    # current document (newest event) is always on page 1 regardless of how many
    # events have accumulated for the session.
    PAGE_SIZE = 100

    def __init__(self, base_url, session=None, token_getter=None):
        self.base_url = base_url.rstrip("/")
        self.session = session or requests.Session()
        self.token_getter = token_getter or _default_token_getter

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.token_getter()}",
            "Content-Type": "application/json",
        }

    def _events_url(self, memory_id, actor_id, session_id):
        return (
            f"{self.base_url}/memories/{memory_id}"
            f"/actors/{actor_id}/sessions/{session_id}/events"
        )

    def _send(self, method, url, attempts=3, **kwargs):
        """Issue a request, retrying transient failures (network errors and 5xx)
        with short backoff. The Memory service can return a 5xx on a cold read,
        which otherwise surfaced as a 500 on the first dashboard load."""
        last_exc = None
        for i in range(attempts):
            try:
                resp = self.session.request(method, url, headers=self._headers(),
                                            timeout=30, **kwargs)
                if resp.status_code >= 500:
                    last_exc = requests.HTTPError(f"{resp.status_code} from Memory")
                    time.sleep(0.4 * (i + 1))
                    continue
                resp.raise_for_status()
                return resp
            except requests.RequestException as e:
                last_exc = e
                time.sleep(0.4 * (i + 1))
        raise last_exc

    def post_event(self, memory_id, actor_id, session_id, content):
        url = self._events_url(memory_id, actor_id, session_id)
        body = {"payload": {"type": "conversational", "role": "assistant",
                            "message": content}}
        self._send("POST", url, json=body)
        _doc_cache[(memory_id, actor_id, session_id)] = content

    def list_events(self, memory_id, actor_id, session_id):
        """Return events for a session as ``[{"content": <message str>,
        "eventTimestamp": ...}]`` sorted oldest -> newest, so callers can take
        the last element as the current document."""
        cached = _doc_cache.get((memory_id, actor_id, session_id))
        if cached is not None:
            return [{"content": cached, "eventTimestamp": "~cache"}]
        url = self._events_url(memory_id, actor_id, session_id)
        resp = self._send("GET", url, params={"page": 1, "size": self.PAGE_SIZE})
        items = resp.json().get("listData", []) or []
        events = [
            {"content": (e.get("payload") or {}).get("message"),
             "eventTimestamp": e.get("eventTimestamp", "")}
            for e in items
            if (e.get("payload") or {}).get("message") is not None
        ]
        # ISO-8601 timestamps sort lexicographically; ensure newest is last
        # regardless of server-side ordering.
        events.sort(key=lambda e: e["eventTimestamp"])
        return events
