import base64
from typing import Any
import httpx
import yaml
from cachetools import TTLCache
from app.config import get_settings


_branch_cache: TTLCache = TTLCache(maxsize=256, ttl=300)
_files_cache: TTLCache = TTLCache(maxsize=256, ttl=300)


def _headers() -> dict[str, str]:
    s = get_settings()
    return {
        "Authorization": f"token {s.github_token}",
        "Accept": "application/vnd.github.v3+json",
    }


async def _get(url: str) -> Any:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=_headers())
        resp.raise_for_status()
        return resp.json()


async def _put(url: str, body: dict) -> Any:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.put(url, headers=_headers(), json=body)
        resp.raise_for_status()
        return resp.json()


async def get_repo_tree(repo: str, branch: str) -> list[dict]:
    """Get the full file tree of a repo recursively."""
    s = get_settings()
    url = f"{s.github_api_url}/repos/{repo}/git/trees/{branch}?recursive=1"
    data = await _get(url)
    return data.get("tree", [])


async def get_file_content(repo: str, path: str, branch: str) -> str:
    """Fetch and decode a file from a GitHub repo."""
    s = get_settings()
    url = f"{s.github_api_url}/repos/{repo}/contents/{path}?ref={branch}"
    data = await _get(url)
    content = base64.b64decode(data["content"]).decode("utf-8")
    return content


async def get_file_sha(repo: str, path: str, branch: str) -> str:
    """Get the SHA of a file (needed for updates)."""
    s = get_settings()
    url = f"{s.github_api_url}/repos/{repo}/contents/{path}?ref={branch}"
    data = await _get(url)
    return data["sha"]


async def update_file(repo: str, path: str, branch: str, content: str, message: str) -> dict:
    """Update a file in the repo via the GitHub API."""
    s = get_settings()
    sha = await get_file_sha(repo, path, branch)
    url = f"{s.github_api_url}/repos/{repo}/contents/{path}"
    body = {
        "message": message,
        "content": base64.b64encode(content.encode("utf-8")).decode("utf-8"),
        "sha": sha,
        "branch": branch,
    }
    return await _put(url, body)


async def list_branches(repo_url: str) -> list[str]:
    """List branches for a given repo URL. Results are cached."""
    owner_repo = _parse_repo_url(repo_url)
    if not owner_repo:
        return []

    cache_key = owner_repo
    if cache_key in _branch_cache:
        return _branch_cache[cache_key]

    s = get_settings()
    branches: list[str] = []
    page = 1
    while True:
        url = f"{s.github_api_url}/repos/{owner_repo}/branches?per_page=100&page={page}"
        try:
            data = await _get(url)
        except httpx.HTTPStatusError:
            break
        if not data:
            break
        branches.extend(b["name"] for b in data)
        if len(data) < 100:
            break
        page += 1

    _branch_cache[cache_key] = branches
    return branches


async def list_values_files(repo_url: str, branch: str = "main") -> list[str]:
    """List YAML/YML files in a repo that could be used as Helm values files."""
    owner_repo = _parse_repo_url(repo_url)
    if not owner_repo:
        return []

    cache_key = f"{owner_repo}@{branch}:values"
    if cache_key in _files_cache:
        return _files_cache[cache_key]

    s = get_settings()
    try:
        url = f"{s.github_api_url}/repos/{owner_repo}/git/trees/{branch}?recursive=1"
        data = await _get(url)
        files = [
            item["path"]
            for item in data.get("tree", [])
            if item["type"] == "blob"
            and (item["path"].endswith(".yaml") or item["path"].endswith(".yml"))
        ]
        _files_cache[cache_key] = files
        return files
    except Exception:
        return []


async def branch_exists(repo_url: str, branch_name: str) -> bool:
    """Check if a branch exists in the given repo."""
    branches = await list_branches(repo_url)
    return branch_name in branches


def _parse_repo_url(url: str) -> str | None:
    """Extract owner/repo from a GitHub URL."""
    url = url.rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]
    for prefix in ("https://github.com/", "git@github.com:"):
        if url.startswith(prefix):
            return url[len(prefix):]
    return None


def parse_yaml(content: str) -> dict:
    """Parse YAML content, return empty dict on failure."""
    try:
        result = yaml.safe_load(content)
        return result if isinstance(result, dict) else {}
    except yaml.YAMLError:
        return {}
