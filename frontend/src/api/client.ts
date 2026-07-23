const API_BASE = import.meta.env.VITE_API_URL || "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API ${res.status}: ${detail}`);
  }
  return res.json();
}

export interface FieldInfo {
  value: string;
  defined_at: string;
  is_local: boolean;
  parent_value: string | null;
}

export interface ValuesFieldInfo {
  values: string[];
  defined_at: string;
  is_local: boolean;
  parent_values: string[] | null;
}

export interface AppSource {
  repoURL: string;
  targetRevision: string;
  helm?: Record<string, unknown>;
}

export interface SyncPolicy {
  automated: { prune?: boolean; selfHeal?: boolean } | null;
  syncOptions: string[] | null;
}

export interface AppConfig {
  name: string;
  category: string;
  source: AppSource;
  defined_at: string;
  inherited_from: string | null;
  branch_exists: boolean | null;
  branch_info: FieldInfo;
  values_info: ValuesFieldInfo;
  sync_policy: SyncPolicy | null;
}

export interface ScopeApps {
  scope: string;
  scope_type: string;
  apps: AppConfig[];
}

export interface ClusterInfo {
  name: string;
  network: string;
  flavor: string;
  env: string;
  file_path: string;
}

export interface RepoStructure {
  networks: string[];
  flavors: Record<string, string[]>;
  environments: Record<string, string[]>;
  clusters: Record<string, ClusterInfo[]>;
}

export interface BranchList {
  repo_url: string;
  branches: string[];
}

export interface ValuesFileList {
  repo_url: string;
  branch: string;
  files: string[];
}

export interface UpdateResponse {
  success: boolean;
  message: string;
  commit_url: string | null;
}

export async function fetchStructure(): Promise<RepoStructure> {
  return request<RepoStructure>("/api/structure");
}

export interface UserInfo {
  username: string;
  name: string;
  email: string;
  groups: string[];
}

export async function fetchMe(): Promise<UserInfo> {
  return request<UserInfo>("/api/me");
}

export async function fetchApps(
  network?: string,
  flavor?: string,
  env?: string,
  cluster?: string
): Promise<ScopeApps> {
  const params = new URLSearchParams();
  if (network) params.set("network", network);
  if (flavor) params.set("flavor", flavor);
  if (env) params.set("env", env);
  if (cluster) params.set("cluster", cluster);
  return request<ScopeApps>(`/api/apps?${params.toString()}`);
}

export async function fetchBranches(repoUrl: string): Promise<BranchList> {
  return request<BranchList>(
    `/api/branches?repo_url=${encodeURIComponent(repoUrl)}`
  );
}

export async function updateBranch(
  filePath: string,
  appName: string,
  newBranch: string
): Promise<UpdateResponse> {
  return request<UpdateResponse>("/api/update-branch", {
    method: "POST",
    body: JSON.stringify({
      file_path: filePath,
      app_name: appName,
      new_branch: newBranch,
    }),
  });
}

export async function fetchValuesFiles(
  repoUrl: string,
  branch: string = "main"
): Promise<ValuesFileList> {
  return request<ValuesFileList>(
    `/api/values-files?repo_url=${encodeURIComponent(repoUrl)}&branch=${encodeURIComponent(branch)}`
  );
}

export async function updateValuesFiles(
  filePath: string,
  appName: string,
  valuesFiles: string[]
): Promise<UpdateResponse> {
  return request<UpdateResponse>("/api/update-values", {
    method: "POST",
    body: JSON.stringify({
      file_path: filePath,
      app_name: appName,
      values_files: valuesFiles,
    }),
  });
}

export async function inheritField(
  filePath: string,
  appName: string,
  field: string
): Promise<UpdateResponse> {
  return request<UpdateResponse>("/api/inherit-field", {
    method: "POST",
    body: JSON.stringify({
      file_path: filePath,
      app_name: appName,
      field: field,
    }),
  });
}

export async function updateCombined(
  filePath: string,
  appName: string,
  opts: {
    branch?: string;
    valuesFiles?: string[];
    syncPolicy?: Record<string, unknown> | null;
    inheritBranch?: boolean;
    inheritValues?: boolean;
  }
): Promise<UpdateResponse> {
  return request<UpdateResponse>("/api/update-combined", {
    method: "POST",
    body: JSON.stringify({
      file_path: filePath,
      app_name: appName,
      branch: opts.branch ?? null,
      values_files: opts.valuesFiles ?? null,
      sync_policy: opts.syncPolicy !== undefined ? opts.syncPolicy : "__UNSET__",
      inherit_branch: opts.inheritBranch ?? false,
      inherit_values: opts.inheritValues ?? false,
    }),
  });
}

export async function fetchAuthConfig(): Promise<{
  enabled: boolean;
  url?: string;
  realm?: string;
  clientId?: string;
}> {
  return request("/api/auth/config");
}

export interface AuditEntry {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  files_changed: string[];
}

export interface AuditResponse {
  entries: AuditEntry[];
}

export async function fetchAuditLog(limit = 50): Promise<AuditResponse> {
  return request<AuditResponse>(`/api/audit?limit=${limit}`);
}

export interface SearchResult {
  app_name: string;
  field_matched: string;
  value: string;
  file_path: string;
  network: string;
  flavor: string;
  env: string;
  cluster: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export type SearchField = "branch" | "values" | "missing";

export async function searchApps(
  query: string,
  field: SearchField = "branch"
): Promise<SearchResponse> {
  const params = new URLSearchParams({ query, field });
  return request<SearchResponse>(`/api/search?${params.toString()}`);
}

export interface BulkTarget {
  file_path: string;
  app_name: string;
}

export interface BulkUpdateResult {
  file_path: string;
  app_name: string;
  success: boolean;
  message: string;
  commit_url?: string;
}

export interface BulkUpdateResponse {
  results: BulkUpdateResult[];
}

export async function bulkUpdate(
  targets: BulkTarget[],
  field: "targetRevision" | "valuesFiles",
  value: string
): Promise<BulkUpdateResponse> {
  return request<BulkUpdateResponse>("/api/bulk-update", {
    method: "POST",
    body: JSON.stringify({ targets, field, value }),
  });
}

export interface DiffPreviewResponse {
  before: string;
  after: string;
}

export async function undoLastChange(): Promise<UpdateResponse> {
  return request<UpdateResponse>("/api/undo", { method: "POST", body: JSON.stringify({}) });
}

export interface AddAppRequest {
  file_path: string;
  app_name: string;
  category: string;
  repo_url: string;
  target_revision: string;
  value_files: string[];
}

export async function addApp(req: AddAppRequest): Promise<UpdateResponse> {
  return request<UpdateResponse>("/api/add-app", { method: "POST", body: JSON.stringify(req) });
}

export async function removeApp(filePath: string, appName: string): Promise<UpdateResponse> {
  return request<UpdateResponse>("/api/remove-app", {
    method: "POST",
    body: JSON.stringify({ file_path: filePath, app_name: appName }),
  });
}

export async function updateSyncPolicy(
  filePath: string,
  appName: string,
  syncPolicy: SyncPolicy | Record<string, unknown> | null
): Promise<UpdateResponse> {
  return request<UpdateResponse>("/api/update-sync-policy", {
    method: "POST",
    body: JSON.stringify({
      file_path: filePath,
      app_name: appName,
      sync_policy: syncPolicy,
    }),
  });
}

export async function previewDiff(
  filePath: string,
  appName: string,
  opts: {
    branchAction?: "set" | "inherit";
    branchValue?: string;
    valuesAction?: "set" | "inherit";
    valuesValue?: string;
    syncPolicy?: Record<string, unknown> | null;
  }
): Promise<DiffPreviewResponse> {
  return request<DiffPreviewResponse>("/api/preview-diff", {
    method: "POST",
    body: JSON.stringify({
      file_path: filePath,
      app_name: appName,
      branch_action: opts.branchAction ?? null,
      branch_value: opts.branchValue ?? null,
      values_action: opts.valuesAction ?? null,
      values_value: opts.valuesValue ?? null,
      sync_policy: opts.syncPolicy !== undefined ? opts.syncPolicy : null,
    }),
  });
}
