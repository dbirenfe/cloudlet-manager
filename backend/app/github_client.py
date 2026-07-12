import asyncio
import base64
from urllib.parse import quote as urlquote
from typing import Any
import httpx
import yaml
from cachetools import TTLCache
from app.config import get_settings


_branch_cache: TTLCache = TTLCache(maxsize=256, ttl=300)
_files_cache: TTLCache = TTLCache(maxsize=256, ttl=300)
_content_cache: TTLCache = TTLCache(maxsize=512, ttl=120)


def _is_gitlab() -> bool:
    return get_settings().git_provider.lower() == "gitlab"


def _headers() -> dict[str, str]:
    s = get_settings()
    if _is_gitlab():
        return {"PRIVATE-TOKEN": s.github_token}
    return {
        "Authorization": f"token {s.github_token}",
        "Accept": "application/vnd.github.v3+json",
    }


async def _get(url: str) -> Any:
    async with httpx.AsyncClient(timeout=30, verify=False) as client:
        resp = await client.get(url, headers=_headers())
        resp.raise_for_status()
        return resp.json()


async def _put(url: str, body: dict) -> Any:
    async with httpx.AsyncClient(timeout=30, verify=False) as client:
        resp = await client.put(url, headers=_headers(), json=body)
        resp.raise_for_status()
        return resp.json()


async def _post(url: str, body: dict) -> Any:
    async with httpx.AsyncClient(timeout=30, verify=False) as client:
        resp = await client.post(url, headers=_headers(), json=body)
        resp.raise_for_status()
        return resp.json()


def _gl_project_id(repo: str) -> str:
    """URL-encode the project path for GitLab API (e.g., 'org/repo' -> 'org%2Frepo')."""
    return urlquote(repo, safe="")


# ── Repo Tree ──

async def get_repo_tree(repo: str, branch: str) -> list[dict]:
    s = get_settings()
    if _is_gitlab():
        return await _gl_get_tree(repo, branch)
    url = f"{s.github_api_url}/repos/{repo}/git/trees/{branch}?recursive=1"
    data = await _get(url)
    return data.get("tree", [])


async def _gl_get_tree(repo: str, branch: str) -> list[dict]:
    s = get_settings()
    pid = _gl_project_id(repo)
    items: list[dict] = []
    page = 1
    while True:
        url = f"{s.github_api_url}/projects/{pid}/repository/tree?ref={branch}&recursive=true&per_page=100&page={page}"
        data = await _get(url)
        if not data:
            break
        for item in data:
            items.append({
                "path": item["path"],
                "type": "blob" if item["type"] == "blob" else "tree",
            })
        if len(data) < 100:
            break
        page += 1
    return items


# ── File Content ──

async def get_file_content(repo: str, path: str, branch: str, use_cache: bool = True) -> str:
    cache_key = f"{repo}:{branch}:{path}"
    if use_cache and cache_key in _content_cache:
        return _content_cache[cache_key]

    s = get_settings()
    if _is_gitlab():
        pid = _gl_project_id(repo)
        encoded_path = urlquote(path, safe="")
        url = f"{s.github_api_url}/projects/{pid}/repository/files/{encoded_path}?ref={branch}"
        data = await _get(url)
        content = base64.b64decode(data["content"]).decode("utf-8")
    else:
        url = f"{s.github_api_url}/repos/{repo}/contents/{path}?ref={branch}"
        data = await _get(url)
        content = base64.b64decode(data["content"]).decode("utf-8")

    if use_cache:
        _content_cache[cache_key] = content
    return content


def invalidate_content_cache(repo: str, path: str, branch: str) -> None:
    cache_key = f"{repo}:{branch}:{path}"
    _content_cache.pop(cache_key, None)


# ── File Update ──

async def get_file_sha(repo: str, path: str, branch: str) -> str:
    """Get the SHA of a file (needed for GitHub updates)."""
    s = get_settings()
    url = f"{s.github_api_url}/repos/{repo}/contents/{path}?ref={branch}"
    data = await _get(url)
    return data["sha"]


async def update_file(repo: str, path: str, branch: str, content: str, message: str, retries: int = 3) -> dict:
    s = get_settings()
    if _is_gitlab():
        return await _gl_update_file(repo, path, branch, content, message, retries)

    url = f"{s.github_api_url}/repos/{repo}/contents/{path}"
    encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")

    for attempt in range(retries):
        sha = await get_file_sha(repo, path, branch)
        body = {
            "message": message,
            "content": encoded,
            "sha": sha,
            "branch": branch,
        }
        try:
            result = await _put(url, body)
            invalidate_content_cache(repo, path, branch)
            return result
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 409 and attempt < retries - 1:
                await asyncio.sleep(0.5 * (attempt + 1))
                continue
            raise


async def _gl_update_file(repo: str, path: str, branch: str, content: str, message: str, retries: int = 3) -> dict:
    s = get_settings()
    pid = _gl_project_id(repo)
    encoded_path = urlquote(path, safe="")
    url = f"{s.github_api_url}/projects/{pid}/repository/files/{encoded_path}"

    body = {
        "branch": branch,
        "content": content,
        "commit_message": message,
    }

    for attempt in range(retries):
        try:
            result = await _put(url, body)
            invalidate_content_cache(repo, path, branch)
            commit_url = f"{s.github_api_url.replace('/api/v4', '')}/{repo}/-/commit/{result.get('content', {}).get('commit_id', '')}" if result else ""
            return {"commit": {"html_url": commit_url}}
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (409, 400) and attempt < retries - 1:
                await asyncio.sleep(0.5 * (attempt + 1))
                continue
            raise


# ── Branches ──

async def list_branches(repo_url: str) -> list[str]:
    owner_repo = _parse_repo_url(repo_url)
    if not owner_repo:
        return []

    cache_key = owner_repo
    if cache_key in _branch_cache:
        return _branch_cache[cache_key]

    s = get_settings()
    branches: list[str] = []
    page = 1

    if _is_gitlab():
        pid = _gl_project_id(owner_repo)
        while True:
            url = f"{s.github_api_url}/projects/{pid}/repository/branches?per_page=100&page={page}"
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
    else:
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


# ── Values Files ──

async def list_values_files(repo_url: str, branch: str = "main") -> list[str]:
    owner_repo = _parse_repo_url(repo_url)
    if not owner_repo:
        return []

    cache_key = f"{owner_repo}@{branch}:values"
    if cache_key in _files_cache:
        return _files_cache[cache_key]

    try:
        s = get_settings()
        if _is_gitlab():
            tree = await _gl_get_tree(owner_repo, branch)
        else:
            url = f"{s.github_api_url}/repos/{owner_repo}/git/trees/{branch}?recursive=1"
            data = await _get(url)
            tree = data.get("tree", [])

        files = [
            item["path"]
            for item in tree
            if item["type"] == "blob"
            and (item["path"].endswith(".yaml") or item["path"].endswith(".yml"))
        ]
        _files_cache[cache_key] = files
        return files
    except Exception:
        return []


async def branch_exists(repo_url: str, branch_name: str) -> bool:
    branches = await list_branches(repo_url)
    return branch_name in branches


# ── Commits (Audit Log) ──

async def get_commits(repo: str, branch: str, limit: int = 50) -> list[dict]:
    s = get_settings()
    if _is_gitlab():
        pid = _gl_project_id(repo)
        url = f"{s.github_api_url}/projects/{pid}/repository/commits?ref_name={branch}&per_page={limit}"
        data = await _get(url)
        return [
            {
                "sha": c.get("id", ""),
                "commit": {
                    "message": c.get("message", ""),
                    "author": {
                        "name": c.get("author_name", "unknown"),
                        "date": c.get("committed_date", ""),
                    },
                },
                "html_url": c.get("web_url", ""),
                "files": [],
            }
            for c in data
        ]
    url = f"{s.github_api_url}/repos/{repo}/commits?sha={branch}&per_page={limit}"
    return await _get(url)


# ── URL Parsing ──

def _parse_repo_url(url: str) -> str | None:
    """Extract owner/repo from a git URL. Works for GitHub, GitLab, Gitea."""
    url = url.rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]

    for prefix in ("https://", "http://"):
        if url.startswith(prefix):
            path = url[len(prefix):]
            parts = path.split("/", 1)
            if len(parts) == 2:
                return parts[1]

    if url.startswith("git@"):
        _, path = url.split(":", 1)
        return path

    return None


def parse_yaml(content: str) -> dict:
    try:
        result = yaml.safe_load(content)
        return result if isinstance(result, dict) else {}
    except yaml.YAMLError:
        return {}
