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

export interface AppSource {
  repoURL: string;
  targetRevision: string;
  helm?: Record<string, unknown>;
}

export interface AppConfig {
  name: string;
  source: AppSource;
  defined_at: string;
  inherited_from: string | null;
  branch_exists: boolean | null;
  branch_info: FieldInfo;
  values_info: FieldInfo;
}

export interface ScopeApps {
  scope: string;
  scope_type: string;
  apps: AppConfig[];
}

export interface ClusterInfo {
  name: string;
  flavor: string;
  env: string;
  file_path: string;
}

export interface RepoStructure {
  flavors: string[];
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

export async function fetchApps(
  flavor?: string,
  env?: string,
  cluster?: string
): Promise<ScopeApps> {
  const params = new URLSearchParams();
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

export async function updateValuesFile(
  filePath: string,
  appName: string,
  valuesFile: string
): Promise<UpdateResponse> {
  return request<UpdateResponse>("/api/update-values", {
    method: "POST",
    body: JSON.stringify({
      file_path: filePath,
      app_name: appName,
      values_file: valuesFile,
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

export async function fetchAuthConfig(): Promise<{
  enabled: boolean;
  url?: string;
  realm?: string;
  clientId?: string;
}> {
  return request("/api/auth/config");
}
