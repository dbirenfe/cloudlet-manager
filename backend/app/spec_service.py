"""Service layer for parsing the cloudlets-spec repo structure and resolving overrides."""

import asyncio
from app.config import get_settings
from app.github_client import (
    get_repo_tree,
    get_file_content,
    update_file,
    list_branches,
    list_values_files,
    branch_exists,
    parse_yaml,
)
from app.models import (
    AppConfig,
    AppSource,
    ClusterInfo,
    RepoStructure,
    ScopeApps,
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


async def _load_apps_file(path: str) -> dict:
    """Load and parse an _apps.yaml or cluster yaml file."""
    s = get_settings()
    try:
        content = await get_file_content(s.github_spec_repo, path, s.github_spec_branch)
        return parse_yaml(content)
    except Exception:
        return {}


def _merge_apps(base: dict, override: dict) -> dict:
    """
    Merge override apps into base. For each app in override, it fully replaces
    that app's config in the base. Apps not in override keep base config.
    """
    merged = dict(base)
    for app_name, app_config in override.items():
        if isinstance(app_config, dict):
            merged[app_name] = app_config
    return merged


async def get_apps_for_scope(
    flavor: str | None = None,
    env: str | None = None,
    cluster: str | None = None,
) -> ScopeApps:
    """
    Get the resolved app configurations for a given scope.
    Applies the override chain: root -> flavor -> env -> cluster
    """
    layers: list[tuple[str, str]] = []

    layers.append(("root", APPS_FILENAME))

    if flavor:
        layers.append(("flavor", f"{flavor}/{APPS_FILENAME}"))

    if flavor and env:
        layers.append(("env", f"{flavor}/{env}/{APPS_FILENAME}"))

    if flavor and env and cluster:
        layers.append(("cluster", f"{flavor}/{env}/{cluster}.yaml"))

    merged_apps: dict = {}
    app_origins: dict[str, str] = {}
    app_inherited: dict[str, str | None] = {}

    for scope_type, path in layers:
        raw = await _load_apps_file(path)
        for app_name in raw:
            if isinstance(raw[app_name], dict):
                if app_name in app_origins:
                    app_inherited[app_name] = app_origins[app_name]
                else:
                    app_inherited[app_name] = None
                app_origins[app_name] = path
        merged_apps = _merge_apps(merged_apps, raw)

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

    for app_name, app_data in merged_apps.items():
        if not isinstance(app_data, dict) or "source" not in app_data:
            continue
        source = app_data["source"]
        app = AppConfig(
            name=app_name,
            source=AppSource(
                repoURL=source.get("repoURL", ""),
                targetRevision=source.get("targetRevision", ""),
                helm=source.get("helm"),
            ),
            defined_at=app_origins.get(app_name, "unknown"),
            inherited_from=app_inherited.get(app_name),
        )
        apps.append(app)
        branch_checks.append(
            branch_exists(source.get("repoURL", ""), source.get("targetRevision", ""))
        )

    exists_results = await asyncio.gather(*branch_checks, return_exceptions=True)
    for i, result in enumerate(exists_results):
        if isinstance(result, bool):
            apps[i].branch_exists = result
        else:
            apps[i].branch_exists = None

    return ScopeApps(scope=scope_str, scope_type=scope_type, apps=apps)


async def get_raw_apps_at_path(file_path: str) -> dict:
    """Get the raw (non-merged) apps defined at a specific file path."""
    return await _load_apps_file(file_path)


async def update_app_branch(
    file_path: str,
    app_name: str,
    new_branch: str,
) -> dict:
    """
    Update the targetRevision for a specific app in a specific file.
    Returns commit info on success.
    """
    s = get_settings()
    content = await get_file_content(s.github_spec_repo, file_path, s.github_spec_branch)
    data = parse_yaml(content)

    if app_name not in data:
        raise ValueError(f"App '{app_name}' not found in {file_path}")

    old_branch = data[app_name].get("source", {}).get("targetRevision", "unknown")
    data[app_name]["source"]["targetRevision"] = new_branch

    import yaml
    new_content = yaml.dump(data, default_flow_style=False, sort_keys=False)

    message = f"cloudlet-manager: update {app_name} targetRevision from '{old_branch}' to '{new_branch}' in {file_path}"
    result = await update_file(
        s.github_spec_repo, file_path, s.github_spec_branch, new_content, message
    )
    return result


async def update_app_values(
    file_path: str,
    app_name: str,
    values_files: list[str],
) -> dict:
    """
    Update the helm.valuesFiles for a specific app in a specific file.
    Returns commit info on success.
    """
    s = get_settings()
    content = await get_file_content(s.github_spec_repo, file_path, s.github_spec_branch)
    data = parse_yaml(content)

    if app_name not in data:
        raise ValueError(f"App '{app_name}' not found in {file_path}")

    if "source" not in data[app_name]:
        raise ValueError(f"App '{app_name}' has no source in {file_path}")

    if "helm" not in data[app_name]["source"]:
        data[app_name]["source"]["helm"] = {}

    old_values = data[app_name]["source"]["helm"].get("valuesFiles", [])
    data[app_name]["source"]["helm"]["valuesFiles"] = values_files

    import yaml
    new_content = yaml.dump(data, default_flow_style=False, sort_keys=False)

    message = f"cloudlet-manager: update {app_name} valuesFiles from {old_values} to {values_files} in {file_path}"
    result = await update_file(
        s.github_spec_repo, file_path, s.github_spec_branch, new_content, message
    )
    return result
