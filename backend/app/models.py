from pydantic import BaseModel


class FieldInfo(BaseModel):
    value: str
    defined_at: str
    is_local: bool
    parent_value: str | None = None


class ValuesFieldInfo(BaseModel):
    values: list[str]
    defined_at: str
    is_local: bool
    parent_values: list[str] | None = None


class AppSource(BaseModel):
    repoURL: str
    targetRevision: str
    helm: dict | None = None


class SyncPolicy(BaseModel):
    automated: dict | None = None
    syncOptions: list[str] | None = None


class AppConfig(BaseModel):
    name: str
    category: str = ""
    source: AppSource
    sync_policy: SyncPolicy | None = None
    defined_at: str
    inherited_from: str | None = None
    branch_exists: bool | None = None
    branch_info: FieldInfo
    values_info: ValuesFieldInfo


class ClusterInfo(BaseModel):
    name: str
    network: str
    flavor: str
    env: str
    file_path: str


class ScopeApps(BaseModel):
    scope: str
    scope_type: str
    apps: list[AppConfig]


class BranchList(BaseModel):
    repo_url: str
    branches: list[str]


class BranchUpdateRequest(BaseModel):
    file_path: str
    app_name: str
    new_branch: str


class ValuesUpdateRequest(BaseModel):
    file_path: str
    app_name: str
    values_files: list[str]


class InheritFieldRequest(BaseModel):
    file_path: str
    app_name: str
    field: str  # "targetRevision" or "valuesFiles"


class ValuesFileList(BaseModel):
    repo_url: str
    branch: str
    files: list[str]


class UpdateResponse(BaseModel):
    success: bool
    message: str
    commit_url: str | None = None


class BranchUpdateResponse(BaseModel):
    success: bool
    message: str
    commit_url: str | None = None


class RepoStructure(BaseModel):
    networks: list[str]
    flavors: dict[str, list[str]]
    environments: dict[str, list[str]]
    clusters: dict[str, list[ClusterInfo]]


class AuditEntry(BaseModel):
    timestamp: str
    author: str
    message: str
    sha: str
    files_changed: list[str]


class AuditLog(BaseModel):
    entries: list[AuditEntry]


class SearchResult(BaseModel):
    app_name: str
    field_matched: str
    value: str
    file_path: str
    network: str
    flavor: str
    env: str
    cluster: str


class SearchResponse(BaseModel):
    query: str
    field: str
    results: list[SearchResult]


class BulkTarget(BaseModel):
    file_path: str
    app_name: str


class BulkUpdateRequest(BaseModel):
    targets: list[BulkTarget]
    field: str
    value: str


class BulkTargetResult(BaseModel):
    file_path: str
    app_name: str
    success: bool
    message: str
    commit_url: str | None = None


class BulkUpdateResponse(BaseModel):
    results: list[BulkTargetResult]


class CombinedUpdateRequest(BaseModel):
    file_path: str
    app_name: str
    branch: str | None = None
    values_files: list[str] | None = None
    sync_policy: dict | None = "__UNSET__"
    inherit_branch: bool = False
    inherit_values: bool = False


class DiffPreviewRequest(BaseModel):
    file_path: str
    app_name: str
    branch_action: str | None = None
    branch_value: str | None = None
    values_action: str | None = None
    values_value: str | None = None
    sync_policy: dict | None = None


class DiffPreviewResponse(BaseModel):
    before: str
    after: str


class UndoRequest(BaseModel):
    commit_sha: str | None = None


class UndoResponse(BaseModel):
    success: bool
    message: str
    commit_url: str | None = None


class AddAppRequest(BaseModel):
    file_path: str
    app_name: str
    category: str
    repo_url: str
    target_revision: str = "main"
    value_files: list[str] | None = None


class RemoveAppRequest(BaseModel):
    file_path: str
    app_name: str


class UpdateSyncPolicyRequest(BaseModel):
    file_path: str
    app_name: str
    sync_policy: dict
