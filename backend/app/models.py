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


class AppConfig(BaseModel):
    name: str
    source: AppSource
    defined_at: str
    inherited_from: str | None = None
    branch_exists: bool | None = None
    branch_info: FieldInfo
    values_info: ValuesFieldInfo


class ClusterInfo(BaseModel):
    name: str
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
    flavors: list[str]
    environments: dict[str, list[str]]
    clusters: dict[str, list[ClusterInfo]]
