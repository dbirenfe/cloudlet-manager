"""Service layer for parsing the cloudlets-spec repo structure and resolving overrides."""

import asyncio
import yaml
from app.config import get_settings
from app.github_client import (
    get_repo_tree,
    get_file_content,
    update_file,
    list_branches,
    list_values_files,
    branch_exists,
    get_commits,
    parse_yaml,
)
from app.models import (
    AppConfig,
    AppSource,
    ClusterInfo,
    FieldInfo,
    ValuesFieldInfo,
    RepoStructure,
    ScopeApps,
    AuditEntry,
    SearchResult,
    BulkTargetResult,
)

APPS_FILENAME = "_apps.yaml"
SKIP_DIRS = {".git", ".github"}


async def get_structure() -> RepoStructure:
    """Scan the repo tree and return the full structure of flavors, envs, and clusters."""
    s = get_settings()
    tree = await get_repo_tree(s.github_spec_repo, s.github_spec_branch)

    flavors: set[str] = set()
    environments: dict[str, list[str]] = {}
    clusters: dict[str, list[ClusterInfo]] = {}

    for item in tree:
        if item["type"] != "blob":
            continue
        path = item["path"]
        parts = path.split("/")

        if parts[0] in SKIP_DIRS or parts[0] == APPS_FILENAME:
            continue

        if len(parts) < 2:
            continue

        flavor = parts[0]
        flavors.add(flavor)

        if len(parts) >= 3 and parts[2] != APPS_FILENAME:
            env = parts[1]
            if not parts[1].startswith("_"):
                if flavor not in environments:
                    environments[flavor] = []
                if env not in environments[flavor]:
                    environments[flavor].append(env)

        if len(parts) == 3 and parts[2].endswith(".yaml") and parts[2] != APPS_FILENAME:
            env = parts[1]
            cluster_name = parts[2].replace(".yaml", "")
            key = f"{flavor}/{env}"
            if key not in clusters:
                clusters[key] = []
            clusters[key].append(
                ClusterInfo(
                    name=cluster_name,
                    flavor=flavor,
                    env=env,
                    file_path=path,
                )
            )

    return RepoStructure(
        flavors=sorted(flavors),
        environments={k: sorted(v) for k, v in environments.items()},
        clusters=clusters,
    )


CATEGORY_KEYS = {"edgeApps", "hubApps", "edge-apps", "hub-apps"}


def _flatten_apps(raw: dict) -> dict:
    """
    Flatten category-nested YAML into a flat app dict.
    Handles both flat format (app directly at top level) and
    category format (edgeApps/hubApps wrapping apps).
    """
    flat: dict = {}
    for key, value in raw.items():
        if not isinstance(value, dict):
            continue
        if key.lower().replace("-", "").replace("_", "") in {k.lower().replace("-", "") for k in CATEGORY_KEYS}:
            for app_name, app_data in value.items():
                if isinstance(app_data, dict):
                    app_data["_category"] = key
                    flat[app_name] = app_data
        else:
            if _get_source(value) is not None or "source" in value or "sources" in value:
                flat[key] = value
    return flat


def _get_source(app_data: dict) -> dict | None:
    """Get the source dict from an app, supporting both 'source' and 'sources'."""
    src = app_data.get("source")
    if isinstance(src, dict):
        return src
    src = app_data.get("sources")
    if isinstance(src, dict):
        return src
    if isinstance(src, list) and src:
        return src[0] if isinstance(src[0], dict) else None
    return None


async def _load_apps_file(path: str) -> dict:
    s = get_settings()
    try:
        content = await get_file_content(s.github_spec_repo, path, s.github_spec_branch)
        raw = parse_yaml(content)
        return _flatten_apps(raw)
    except Exception:
        return {}


def _values_key(helm: dict) -> str:
    """Detect whether the YAML uses 'valueFiles' or 'valuesFiles'."""
    if "valueFiles" in helm:
        return "valueFiles"
    return "valuesFiles"


def _extract_values_files(app_data: dict) -> list[str] | None:
    src = _get_source(app_data)
    if not src:
        return None
    helm = src.get("helm", {})
    if not isinstance(helm, dict):
        return None
    key = _values_key(helm)
    vf = helm.get(key)
    if vf is None:
        return None
    if isinstance(vf, list):
        return [str(f) for f in vf]
    return None


def _extract_target_revision(app_data: dict) -> str | None:
    src = _get_source(app_data)
    if not src:
        return None
    return src.get("targetRevision") or "main"


def _extract_repo_url(app_data: dict) -> str | None:
    src = _get_source(app_data)
    if not src:
        return None
    return src.get("repoURL")


async def get_apps_for_scope(
    flavor: str | None = None,
    env: str | None = None,
    cluster: str | None = None,
) -> ScopeApps:
    """
    Get the resolved app configurations for a given scope.
    Uses deep field-level merge: root -> flavor -> env -> cluster.
    Each field (targetRevision, valuesFiles) is tracked independently.
    """
    layers: list[tuple[str, str]] = []

    layers.append(("root", APPS_FILENAME))
    if flavor:
        layers.append(("flavor", f"{flavor}/{APPS_FILENAME}"))
    if flavor and env:
        layers.append(("env", f"{flavor}/{env}/{APPS_FILENAME}"))
    if flavor and env and cluster:
        layers.append(("cluster", f"{flavor}/{env}/{cluster}.yaml"))

    current_scope_path = layers[-1][1]

    # Per-app tracking
    app_branch_entries: dict[str, list[tuple[str, str]]] = {}  # app -> [(value, path)]
    app_values_entries: dict[str, list[tuple[list[str], str]]] = {}  # app -> [([files], path)]
    app_repo_entries: dict[str, list[tuple[str, str]]] = {}  # app -> [(url, path)]
    app_files: dict[str, list[str]] = {}

    for _, path in layers:
        raw = await _load_apps_file(path)
        for app_name, app_data in raw.items():
            if not isinstance(app_data, dict):
                continue

            if app_name not in app_files:
                app_branch_entries[app_name] = []
                app_values_entries[app_name] = []
                app_repo_entries[app_name] = []
                app_files[app_name] = []

            app_files[app_name].append(path)

            repo = _extract_repo_url(app_data)
            if repo is not None:
                app_repo_entries[app_name].append((repo, path))

            tr = _extract_target_revision(app_data)
            if tr is not None:
                app_branch_entries[app_name].append((tr, path))

            vf = _extract_values_files(app_data)
            if vf is not None:
                app_values_entries[app_name].append((vf, path))

    # Build AppConfig list
    scope_parts = []
    if flavor:
        scope_parts.append(flavor)
    if env:
        scope_parts.append(env)
    if cluster:
        scope_parts.append(cluster)

    scope_str = "/".join(scope_parts) if scope_parts else "root"
    scope_type = "root"
    if cluster:
        scope_type = "cluster"
    elif env:
        scope_type = "env"
    elif flavor:
        scope_type = "flavor"

    apps: list[AppConfig] = []
    branch_checks = []

    for app_name in app_files:
        repo_entries = app_repo_entries[app_name]
        tr_entries = app_branch_entries[app_name]
        vf_entries = app_values_entries[app_name]

        if not repo_entries:
            continue

        repo_url = repo_entries[-1][0]
        effective_branch = tr_entries[-1][0] if tr_entries else ""
        effective_values = vf_entries[-1][0] if vf_entries else []

        # Build branch FieldInfo
        if tr_entries:
            last_val, last_path = tr_entries[-1]
            is_local = last_path == current_scope_path
            parent_val = None
            if is_local and len(tr_entries) >= 2:
                parent_val = tr_entries[-2][0]
            elif not is_local:
                parent_val = last_val
            branch_info = FieldInfo(
                value=last_val,
                defined_at=last_path,
                is_local=is_local,
                parent_value=parent_val,
            )
        else:
            branch_info = FieldInfo(
                value="",
                defined_at="",
                is_local=False,
                parent_value=None,
            )

        # Build values ValuesFieldInfo
        if vf_entries:
            last_vals, last_path = vf_entries[-1]
            is_local = last_path == current_scope_path
            parent_vals = None
            if is_local and len(vf_entries) >= 2:
                parent_vals = vf_entries[-2][0]
            elif not is_local:
                parent_vals = last_vals
            values_info = ValuesFieldInfo(
                values=last_vals,
                defined_at=last_path,
                is_local=is_local,
                parent_values=parent_vals,
            )
        else:
            values_info = ValuesFieldInfo(
                values=[],
                defined_at="",
                is_local=False,
                parent_values=None,
            )

        files_list = app_files[app_name]
        defined_at = files_list[-1]
        inherited_from = files_list[-2] if len(files_list) >= 2 else None

        helm_data = None
        if effective_values:
            helm_data = {"valuesFiles": effective_values}

        app = AppConfig(
            name=app_name,
            source=AppSource(
                repoURL=repo_url,
                targetRevision=effective_branch,
                helm=helm_data,
            ),
            defined_at=defined_at,
            inherited_from=inherited_from,
            branch_info=branch_info,
            values_info=values_info,
        )
        apps.append(app)
        branch_checks.append(branch_exists(repo_url, effective_branch))

    exists_results = await asyncio.gather(*branch_checks, return_exceptions=True)
    for i, result in enumerate(exists_results):
        if isinstance(result, bool):
            apps[i].branch_exists = result
        else:
            apps[i].branch_exists = None

    return ScopeApps(scope=scope_str, scope_type=scope_type, apps=apps)


def _find_app_in_raw(data: dict, app_name: str) -> tuple[dict | None, str | None]:
    """Find an app in raw YAML, checking both flat and category-nested structures.
    Returns (app_dict, category_key) or (None, None)."""
    if app_name in data and isinstance(data[app_name], dict):
        return data[app_name], None
    for cat_key in CATEGORY_KEYS:
        if cat_key in data and isinstance(data[cat_key], dict):
            if app_name in data[cat_key] and isinstance(data[cat_key][app_name], dict):
                return data[cat_key][app_name], cat_key
    for key, val in data.items():
        if isinstance(val, dict) and app_name in val and isinstance(val[app_name], dict):
            src = val[app_name].get("source") or val[app_name].get("sources")
            if src:
                return val[app_name], key
    return None, None


def _get_or_create_source(app_data: dict) -> dict:
    """Get or create the source dict, supporting both 'source' and 'sources'."""
    if "source" in app_data and isinstance(app_data["source"], dict):
        return app_data["source"]
    if "sources" in app_data and isinstance(app_data["sources"], dict):
        return app_data["sources"]
    app_data["source"] = {}
    return app_data["source"]


async def update_app_branch(
    file_path: str,
    app_name: str,
    new_branch: str,
    username: str = "unknown",
) -> dict:
    s = get_settings()
    content = await get_file_content(s.github_spec_repo, file_path, s.github_spec_branch)
    data = parse_yaml(content)

    app_data, _ = _find_app_in_raw(data, app_name)
    if app_data:
        src = _get_or_create_source(app_data)
        old_branch = src.get("targetRevision", "inherited")
        src["targetRevision"] = new_branch
    else:
        old_branch = "inherited"
        data[app_name] = {"source": {"targetRevision": new_branch}}

    new_content = yaml.dump(data, default_flow_style=False, sort_keys=False)
    message = f"[{username}] update {app_name} targetRevision from '{old_branch}' to '{new_branch}' in {file_path}"
    return await update_file(
        s.github_spec_repo, file_path, s.github_spec_branch, new_content, message
    )


async def update_app_values(
    file_path: str,
    app_name: str,
    values_files: list[str],
    username: str = "unknown",
) -> dict:
    s = get_settings()
    content = await get_file_content(s.github_spec_repo, file_path, s.github_spec_branch)
    data = parse_yaml(content)

    if not values_files:
        return await inherit_field(file_path, app_name, "valuesFiles", username=username)

    app_data, _ = _find_app_in_raw(data, app_name)
    if app_data:
        src = _get_or_create_source(app_data)
        if "helm" not in src:
            src["helm"] = {}
        key = _values_key(src["helm"])
        old_values = src["helm"].get(key, [])
        src["helm"][key] = values_files
    else:
        old_values = "inherited"
        data[app_name] = {"source": {"helm": {"valueFiles": values_files}}}

    new_content = yaml.dump(data, default_flow_style=False, sort_keys=False)
    message = f"[{username}] update {app_name} valuesFiles from {old_values} to {values_files} in {file_path}"
    return await update_file(
        s.github_spec_repo, file_path, s.github_spec_branch, new_content, message
    )


async def inherit_field(
    file_path: str,
    app_name: str,
    field: str,
    username: str = "unknown",
) -> dict:
    s = get_settings()
    content = await get_file_content(s.github_spec_repo, file_path, s.github_spec_branch)
    data = parse_yaml(content)

    app_data, cat_key = _find_app_in_raw(data, app_name)
    if not app_data:
        raise ValueError(f"App '{app_name}' not found in {file_path}")

    removed_value = None
    src = _get_source(app_data) or {}

    if field == "targetRevision":
        removed_value = src.pop("targetRevision", None)
    elif field == "valuesFiles":
        helm = src.get("helm", {})
        key = _values_key(helm)
        removed_value = helm.pop(key, None)
        if not helm:
            src.pop("helm", None)
    else:
        raise ValueError(f"Unknown field: {field}")

    if not data:
        new_content = "# No overrides - inherits from parent scope\n"
    else:
        new_content = yaml.dump(data, default_flow_style=False, sort_keys=False)

    message = f"[{username}] inherit {field} for {app_name} from parent scope (removed '{removed_value}' from {file_path})"
    return await update_file(
        s.github_spec_repo, file_path, s.github_spec_branch, new_content, message
    )


async def get_audit_log(limit: int = 50) -> list[AuditEntry]:
    s = get_settings()
    commits = await get_commits(s.github_spec_repo, s.github_spec_branch, limit)
    entries: list[AuditEntry] = []
    import re
    for c in commits:
        commit_data = c.get("commit", {})
        author_data = commit_data.get("author", {})
        message = commit_data.get("message", "")
        files = [f["filename"] for f in c.get("files", [])]
        match = re.match(r"^\[(.+?)\] ", message)
        author = match.group(1) if match else author_data.get("name", "unknown")
        entries.append(
            AuditEntry(
                timestamp=author_data.get("date", ""),
                author=author,
                message=message,
                sha=c.get("sha", ""),
                files_changed=files,
            )
        )
    return entries


async def search_all_apps(query: str, field: str = "branch") -> list[SearchResult]:
    s = get_settings()
    tree = await get_repo_tree(s.github_spec_repo, s.github_spec_branch)

    yaml_paths = [
        item["path"]
        for item in tree
        if item["type"] == "blob" and item["path"].endswith(".yaml") and "/" in item["path"]
    ]

    file_contents = await asyncio.gather(
        *[_load_apps_file(p) for p in yaml_paths],
        return_exceptions=True,
    )

    results: list[SearchResult] = []
    missing_checks: list[tuple[str, str, str, str, str, str]] = []

    for path, raw in zip(yaml_paths, file_contents):
        if isinstance(raw, Exception) or not isinstance(raw, dict):
            continue

        parts = path.split("/")
        flavor = parts[0]
        env = parts[1] if len(parts) >= 3 else ""
        cluster = parts[2].replace(".yaml", "") if len(parts) == 3 else ""

        q = query.lower()

        for app_name, app_data in raw.items():
            if not isinstance(app_data, dict):
                continue

            if field == "missing":
                repo_url = _extract_repo_url(app_data)
                tr = _extract_target_revision(app_data)
                if repo_url and tr:
                    if not q or q in app_name.lower() or q in tr.lower() or q in path.lower() or q in flavor.lower() or q in env.lower() or q in cluster.lower():
                        missing_checks.append((app_name, tr, repo_url, path, flavor, env, cluster))
                continue

            if field == "branch":
                tr = _extract_target_revision(app_data)
                if tr and q in tr.lower():
                    results.append(
                        SearchResult(
                            app_name=app_name,
                            field_matched="targetRevision",
                            value=tr,
                            file_path=path,
                            flavor=flavor,
                            env=env,
                            cluster=cluster,
                        )
                    )

            elif field == "values":
                vf = _extract_values_files(app_data)
                if vf:
                    for v in vf:
                        if q in v.lower():
                            results.append(
                                SearchResult(
                                    app_name=app_name,
                                    field_matched="valuesFiles",
                                    value=v,
                                    file_path=path,
                                    flavor=flavor,
                                    env=env,
                                    cluster=cluster,
                                )
                            )
                            break

    if missing_checks:
        exists_results = await asyncio.gather(
            *[branch_exists(mc[2], mc[1]) for mc in missing_checks],
            return_exceptions=True,
        )
        for (app_name, tr, _, path, flavor, env, cluster), exists in zip(missing_checks, exists_results):
            if isinstance(exists, bool) and not exists:
                results.append(
                    SearchResult(
                        app_name=app_name,
                        field_matched="branch_exists",
                        value=tr,
                        file_path=path,
                        flavor=flavor,
                        env=env,
                        cluster=cluster,
                    )
                )

    return results


async def bulk_update(
    targets: list[dict],
    field: str,
    value: str,
    username: str = "unknown",
) -> list[BulkTargetResult]:
    results: list[BulkTargetResult] = []
    for target in targets:
        file_path = target["file_path"]
        app_name = target["app_name"]
        try:
            if field == "targetRevision":
                result = await update_app_branch(file_path, app_name, value, username=username)
            elif field == "valuesFiles":
                result = await update_app_values(file_path, app_name, [value], username=username)
            else:
                raise ValueError(f"Unsupported field: {field}")
            commit_url = result.get("commit", {}).get("html_url", "")
            results.append(
                BulkTargetResult(
                    file_path=file_path,
                    app_name=app_name,
                    success=True,
                    message="Updated successfully",
                    commit_url=commit_url,
                )
            )
        except Exception as e:
            results.append(
                BulkTargetResult(
                    file_path=file_path,
                    app_name=app_name,
                    success=False,
                    message=str(e),
                )
            )
    return results


async def preview_diff(
    file_path: str,
    app_name: str,
    branch_action: str | None = None,
    branch_value: str | None = None,
    values_action: str | None = None,
    values_value: str | None = None,
) -> tuple[str, str]:
    """
    Preview the file as it would look after applying changes.
    action: "set" to write a value, "inherit" to remove the field.
    None means no change for that field.
    """
    s = get_settings()
    try:
        content = await get_file_content(s.github_spec_repo, file_path, s.github_spec_branch)
    except Exception:
        return "# File not found or empty\n", "# File not found or empty\n"
    before = content
    data = parse_yaml(content)
    if not data:
        return before, before

    app_data, _ = _find_app_in_raw(data, app_name)

    if branch_action == "inherit":
        if app_data:
            src = _get_source(app_data) or {}
            src.pop("targetRevision", None)
    elif branch_action == "set" and branch_value is not None:
        if app_data:
            src = _get_or_create_source(app_data)
            src["targetRevision"] = branch_value
        else:
            data[app_name] = {"source": {"targetRevision": branch_value}}

    def _remove_values() -> None:
        if app_data:
            src = _get_source(app_data) or {}
            helm = src.get("helm", {})
            key = _values_key(helm)
            helm.pop(key, None)
            if not helm:
                src.pop("helm", None)

    if values_action == "inherit":
        _remove_values()
    elif values_action == "set" and values_value is not None:
        values_list = [v.strip() for v in values_value.split(",") if v.strip()]
        if not values_list:
            _remove_values()
        elif app_data:
            src = _get_or_create_source(app_data)
            if "helm" not in src:
                src["helm"] = {}
            key = _values_key(src["helm"])
            src["helm"][key] = values_list
        else:
            data[app_name] = {"source": {"helm": {"valueFiles": values_list}}}

    if not data:
        after = "# No overrides - inherits from parent scope\n"
    else:
        after = yaml.dump(data, default_flow_style=False, sort_keys=False)
    return before, after
