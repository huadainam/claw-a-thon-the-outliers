import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass
class Config:
    store_backend: str
    memory_id: str
    memory_base_url: str
    openai_api_key: str
    openai_base_url: str
    model_name: str
    review_limit: int
    refresh_review_limit: int

def get_config() -> Config:
    return Config(
        store_backend=os.getenv("STORE_BACKEND", "local"),
        memory_id=os.getenv("MEMORY_ID", ""),
        memory_base_url=os.getenv(
            "MEMORY_BASE_URL", "https://agentbase.api.vngcloud.vn/memory"
        ),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        openai_base_url=os.getenv("OPENAI_BASE_URL", ""),
        model_name=os.getenv("MODEL_NAME", "gpt-4o-mini"),
        review_limit=int(os.getenv("REVIEW_LIMIT", "100")),
        refresh_review_limit=int(os.getenv("REFRESH_REVIEW_LIMIT", "100")),
    )
