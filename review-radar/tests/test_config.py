import importlib

def test_config_reads_env(monkeypatch):
    monkeypatch.setenv("STORE_BACKEND", "memory")
    monkeypatch.setenv("MEMORY_ID", "mem-123")
    monkeypatch.setenv("MODEL_NAME", "my-model")
    monkeypatch.setenv("OPENAI_API_KEY", "key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://llm.example")
    import config
    importlib.reload(config)
    cfg = config.get_config()
    assert cfg.store_backend == "memory"
    assert cfg.memory_id == "mem-123"
    assert cfg.model_name == "my-model"

def test_config_defaults(monkeypatch):
    monkeypatch.delenv("STORE_BACKEND", raising=False)
    monkeypatch.delenv("MODEL_NAME", raising=False)
    import config
    importlib.reload(config)
    cfg = config.get_config()
    assert cfg.store_backend == "local"
    assert cfg.model_name == "gpt-4o-mini"

def test_config_review_limit(monkeypatch):
    monkeypatch.delenv("REVIEW_LIMIT", raising=False)
    monkeypatch.delenv("REFRESH_REVIEW_LIMIT", raising=False)
    import config
    importlib.reload(config)
    assert config.get_config().review_limit == 500
    assert config.get_config().refresh_review_limit == 100
    monkeypatch.setenv("REVIEW_LIMIT", "200")
    monkeypatch.setenv("REFRESH_REVIEW_LIMIT", "75")
    importlib.reload(config)
    assert config.get_config().review_limit == 200
    assert config.get_config().refresh_review_limit == 75
