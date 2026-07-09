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
    parse_yaml,
)
from app.models import (
    AppConfig,
    AppSource,
    ClusterInfo,
    FieldInfo,
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


def _extract_values_file(app_data: dict) -> str | None:
    """Extract the first valuesFile from an app config, or None."""
    helm = app_data.get("source", {}).get("helm", {})
    if not isinstance(helm, dict):
        return None
    vf = helm.get("valuesFiles", [])
    if isinstance(vf, list) and vf:
        return vf[0]
    return None


def _extract_target_revision(app_data: dict) -> str | None:
    """Extract targetRevision from an app config, or None."""
    return app_data.get("source", {}).get("targetRevision")


def _extract_repo_url(app_data: dict) -> str | None:
    """Extract repoURL from an app config, or None."""
    return app_data.get("source", {}).get("repoURL")


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

    # Per-app, per-field tracking: list of (value, file_path) entries in layer order
    # Each entry means "this file sets this field to this value"
    app_fields: dict[str, dict[str, list[tuple[str, str]]]] = {}
    # Track which apps appear in which files
    app_files: dict[str, list[str]] = {}

    for _, path in layers:
        raw = await _load_apps_file(path)
        for app_name, app_data in raw.items():
            if not isinstance(app_data, dict):
                continue

            if app_name not in app_fields:
                app_fields[app_name] = {
                    "repoURL": [],
                    "targetRevision": [],
                    "valuesFiles": [],
                }
                app_files[app_name] = []

            app_files[app_name].append(path)

            repo = _extract_repo_url(app_data)
            if repo is not None:
                app_fields[app_name]["repoURL"].append((repo, path))

            tr = _extract_target_revision(app_data)
            if tr is not None:
                app_fields[app_name]["targetRevision"].append((tr, path))

            vf = _extract_values_file(app_data)
            if vf is not None:
                app_fields[app_name]["valuesFiles"].append((vf, path))

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

    for app_name, fields in app_fields.items():
        repo_entries = fields["repoURL"]
        tr_entries = fields["targetRevision"]
        vf_entries = fields["valuesFiles"]

        if not repo_entries:
            continue

        repo_url = repo_entries[-1][0]
        effective_branch = tr_entries[-1][0] if tr_entries else ""
        effective_values = vf_entries[-1][0] if vf_entries else ""

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

        # Build values FieldInfo
        if vf_entries:
            last_val, last_path = vf_entries[-1]
            is_local = last_path == current_scope_path
            parent_val = None
            if is_local and len(vf_entries) >= 2:
                parent_val = vf_entries[-2][0]
            elif not is_local:
                parent_val = last_val
            values_info = FieldInfo(
                value=last_val,
                defined_at=last_path,
                is_local=is_local,
                parent_value=parent_val,
            )
        else:
            values_info = FieldInfo(
                value="",
                defined_at="",
                is_local=False,
                parent_value=None,
            )

        files_list = app_files[app_name]
        defined_at = files_list[-1]
        inherited_from = files_list[-2] if len(files_list) >= 2 else None

        helm_data = None
        if effective_values:
            helm_data = {"valuesFiles": [effective_values]}

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


async def update_app_branch(
    file_path: str,
    app_name: str,
    new_branch: str,
) -> dict:
    """
    Update the targetRevision for a specific app in a specific file.
    If the app doesn't exist in the file yet, creates a minimal override entry.
    """
    s = get_settings()
    content = await get_file_content(s.github_spec_repo, file_path, s.github_spec_branch)
    data = parse_yaml(content)

    if app_name in data:
        if "source" not in data[app_name]:
            data[app_name]["source"] = {}
        old_branch = data[app_name]["source"].get("targetRevision", "inherited")
        data[app_name]["source"]["targetRevision"] = new_branch
    else:
        old_branch = "inherited"
        data[app_name] = {"source": {"targetRevision": new_branch}}

    new_content = yaml.dump(data, default_flow_style=False, sort_keys=False)
    message = f"cloudlet-manager: update {app_name} targetRevision from '{old_branch}' to '{new_branch}' in {file_path}"
    return await update_file(
        s.github_spec_repo, file_path, s.github_spec_branch, new_content, message
    )


async def update_app_values(
    file_path: str,
    app_name: str,
    values_file: str,
) -> dict:
    """
    Update the helm.valuesFiles for a specific app in a specific file.
    If the app doesn't exist in the file yet, creates a minimal override entry.
    """
    s = get_settings()
    content = await get_file_content(s.github_spec_repo, file_path, s.github_spec_branch)
    data = parse_yaml(content)

    if app_name in data:
        if "source" not in data[app_name]:
            data[app_name]["source"] = {}
        if "helm" not in data[app_name]["source"]:
            data[app_name]["source"]["helm"] = {}
        old_values = data[app_name]["source"]["helm"].get("valuesFiles", [])
        data[app_name]["source"]["helm"]["valuesFiles"] = [values_file]
    else:
        old_values = "inherited"
        data[app_name] = {"source": {"helm": {"valuesFiles": [values_file]}}}

    new_content = yaml.dump(data, default_flow_style=False, sort_keys=False)
    message = f"cloudlet-manager: update {app_name} valuesFiles from {old_values} to ['{values_file}'] in {file_path}"
    return await update_file(
        s.github_spec_repo, file_path, s.github_spec_branch, new_content, message
    )


async def inherit_field(
    file_path: str,
    app_name: str,
    field: str,
) -> dict:
    """
    Remove a field override from an app in a file so it inherits from the parent scope.
    If no overrides remain for the app, removes the entire app entry.
    """
    s = get_settings()
    content = await get_file_content(s.github_spec_repo, file_path, s.github_spec_branch)
    data = parse_yaml(content)

    if app_name not in data:
        raise ValueError(f"App '{app_name}' not found in {file_path}")

    removed_value = None

    if field == "targetRevision":
        source = data[app_name].get("source", {})
        removed_value = source.pop("targetRevision", None)
        if not source or source.keys() <= {"repoURL"}:
            if "helm" not in source:
                del data[app_name]
    elif field == "valuesFiles":
        helm = data[app_name].get("source", {}).get("helm", {})
        removed_value = helm.pop("valuesFiles", None)
        if not helm:
            data[app_name].get("source", {}).pop("helm", None)
        source = data[app_name].get("source", {})
        if not source or source.keys() <= {"repoURL"}:
            del data[app_name]
    else:
        raise ValueError(f"Unknown field: {field}")

    if not data:
        new_content = "# No overrides - inherits from parent scope\n"
    else:
        new_content = yaml.dump(data, default_flow_style=False, sort_keys=False)

    message = f"cloudlet-manager: inherit {field} for {app_name} from parent scope (removed '{removed_value}' from {file_path})"
    return await update_file(
        s.github_spec_repo, file_path, s.github_spec_branch, new_content, message
    )
