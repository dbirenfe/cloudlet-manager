from pydantic import BaseModel


class AppSource(BaseModel):
    repoURL: str
    targetRevision: str
    helm: dict | None = None


class AppConfig(BaseModel):
    name: str
    source: AppSource
    defined_at: str  # file path where this config comes from
    inherited_from: str | None = None  # file path of the broader definition being overridden
    branch_exists: bool | None = None


class ClusterInfo(BaseModel):
    name: str
    flavor: str
    env: str
    file_path: str


class ScopeApps(BaseModel):
    scope: str  # e.g. "standard/dev/cluster-dev-01"
    scope_type: str  # "root", "flavor", "env", "cluster"
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
    environments: dict[str, list[str]]  # flavor -> [envs]
    clusters: dict[str, list[ClusterInfo]]  # "flavor/env" -> [clusters]
