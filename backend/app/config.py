from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    github_token: str = ""
    github_spec_repo: str = "dbirenfe/cloudlets-spec"
    github_spec_branch: str = "main"
    github_api_url: str = "https://api.github.com"

    keycloak_url: str = ""
    keycloak_realm: str = ""
    keycloak_client_id: str = ""
    keycloak_client_secret: str = ""

    allowed_groups: list[str] = []

    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    branch_cache_ttl: int = 300

    model_config = {"env_prefix": "CLOUDLET_"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
