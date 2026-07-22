import { type CSSProperties, useEffect, useState } from "react";
import type { ScopeApps, AddAppRequest, RepoStructure, AuditEntry } from "../api/client";
import { fetchApps, addApp, fetchBranches, fetchValuesFiles, fetchAuditLog } from "../api/client";
import AppCard from "./AppCard";

interface AppsPanelProps {
  network: string | null;
  flavor: string | null;
  env: string | null;
  cluster: string | null;
  onNavigate: (
    network: string | null,
    flavor: string | null,
    env: string | null,
    cluster: string | null
  ) => void;
  structure: RepoStructure | null;
}

const s: Record<string, CSSProperties> = {
  panel: {
    flex: 1,
    padding: 32,
    overflowY: "auto",
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: "var(--text-muted)",
    marginBottom: 8,
  },
  breadcrumbPart: {
    color: "var(--text-secondary)",
    fontWeight: 500,
    cursor: "pointer",
    borderRadius: 4,
    padding: "2px 6px",
    transition: "background 0.12s, color 0.12s",
  },
  breadcrumbPartActive: {
    color: "var(--text-primary)",
    fontWeight: 600,
  },
  breadcrumbSep: {
    color: "var(--text-muted)",
  },
  heading: {
    fontSize: 24,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 6,
  },
  scopeType: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--accent)",
    background: "var(--accent-muted)",
    padding: "2px 10px",
    borderRadius: 6,
    display: "inline-block",
    marginBottom: 20,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  stats: {
    display: "flex",
    gap: 20,
    marginBottom: 24,
  },
  stat: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "12px 20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  statLabel: {
    fontSize: 11,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
    maxWidth: 1200,
    gap: 12,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap" as const,
  },
  filterBtn: {
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 500,
    border: "1px solid #2d3148",
    borderRadius: 6,
    cursor: "pointer",
    transition: "all 0.12s",
    background: "transparent",
    color: "var(--text-secondary)",
    outline: "none",
    WebkitAppearance: "none" as const,
    boxShadow: "none",
  },
  filterBtnActive: {
    background: "var(--accent-muted)",
    color: "var(--accent)",
    border: "1px solid var(--accent)",
    fontWeight: 600,
  },
  scopeSearch: {
    padding: "6px 12px",
    fontSize: 12,
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    outline: "none",
    width: 200,
    marginLeft: "auto",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 200,
    color: "var(--text-muted)",
    fontSize: 14,
  },
  error: {
    background: "var(--danger-bg)",
    color: "var(--danger)",
    padding: 16,
    borderRadius: "var(--radius)",
    fontSize: 14,
  },
  empty: {
    textAlign: "center" as const,
    padding: 60,
    color: "var(--text-muted)",
    fontSize: 15,
  },
  addBtn: {
    padding: "5px 12px",
    background: "var(--accent-muted)",
    color: "var(--accent)",
    border: "1px solid transparent",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
    outline: "none",
    whiteSpace: "nowrap" as const,
  },
  modalOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 500,
  },
  modal: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    width: 460,
    padding: 24,
    boxShadow: "var(--shadow)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 18,
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "var(--text-muted)",
    marginBottom: 6,
    display: "block",
  },
  formInput: {
    width: "100%",
    padding: "8px 12px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
  },
  formSelect: {
    width: "100%",
    padding: "8px 12px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
    cursor: "pointer",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    padding: "8px 16px",
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s",
  },
  modalSubmitBtn: {
    padding: "8px 16px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s",
  },
  modalSubmitBtnDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
};

export default function AppsPanel({ network, flavor, env, cluster, onNavigate, structure }: AppsPanelProps) {
  const [data, setData] = useState<ScopeApps | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "edgeApps" | "hubApps">("all");
  const [scopeSearch, setScopeSearch] = useState("");
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [showAddApp, setShowAddApp] = useState(false);
  const [addCategory, setAddCategory] = useState("edgeApps");
  const [addName, setAddName] = useState("");
  const [addRepoUrl, setAddRepoUrl] = useState("");
  const [addRevision, setAddRevision] = useState("main");
  const [addValueFiles, setAddValueFiles] = useState<string[]>(["values.yaml"]);
  const [addingApp, setAddingApp] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addBranches, setAddBranches] = useState<string[]>([]);
  const [addBranchesLoading, setAddBranchesLoading] = useState(false);
  const [addValuesOptions, setAddValuesOptions] = useState<string[]>([]);
  const [addValuesLoading, setAddValuesLoading] = useState(false);

  useEffect(() => {
    setAddBranches([]);
    setAddRevision("main");
    setAddValuesOptions([]);
    setAddValueFiles(["values.yaml"]);
    if (!addRepoUrl.trim() || !addRepoUrl.startsWith("http")) return;
    const timer = setTimeout(() => {
      setAddBranchesLoading(true);
      fetchBranches(addRepoUrl.trim())
        .then((d) => setAddBranches(d.branches))
        .catch(() => setAddBranches([]))
        .finally(() => setAddBranchesLoading(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [addRepoUrl]);

  useEffect(() => {
    setAddValuesOptions([]);
    setAddValueFiles(["values.yaml"]);
    if (!addRepoUrl.trim() || !addRevision) return;
    setAddValuesLoading(true);
    fetchValuesFiles(addRepoUrl.trim(), addRevision)
      .then((d) => setAddValuesOptions(d.files))
      .catch(() => setAddValuesOptions([]))
      .finally(() => setAddValuesLoading(false));
  }, [addRevision, addRepoUrl]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCategoryFilter("all");
    setScopeSearch("");
    setShowMissingOnly(false);

    fetchApps(network ?? undefined, flavor ?? undefined, env ?? undefined, cluster ?? undefined)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [network, flavor, env, cluster, refreshKey]);

  const breadcrumbParts: string[] = [];
  if (network) breadcrumbParts.push(network);
  if (flavor) breadcrumbParts.push(flavor);
  if (env) breadcrumbParts.push(env);
  if (cluster) breadcrumbParts.push(cluster);

  const handleAddApp = async () => {
    if (!addName.trim() || !addRepoUrl.trim()) return;
    setAddingApp(true);
    setAddError(null);
    try {
      const req: AddAppRequest = {
        file_path: scopeFile,
        app_name: addName.trim(),
        category: addCategory,
        repo_url: addRepoUrl.trim(),
        target_revision: addRevision.trim() || "main",
        value_files: addValueFiles.length > 0 ? addValueFiles : ["values.yaml"],
      };
      await addApp(req);
      setShowAddApp(false);
      setAddName("");
      setAddRepoUrl("");
      setAddRevision("main");
      setAddValueFiles(["values.yaml"]);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add app");
    } finally {
      setAddingApp(false);
    }
  };

  const [recentChanges, setRecentChanges] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!network && !flavor && !env && !cluster) {
      fetchAuditLog(8).then((d) => setRecentChanges(d.entries)).catch(() => {});
    }
  }, [network, flavor, env, cluster]);

  const isRoot = !network && !flavor && !env && !cluster;

  if (isRoot && structure) {
    const totalNetworks = structure.networks?.length || 0;
    const totalFlavors = Object.values(structure.flavors || {}).reduce((a, b) => a + b.length, 0);
    const totalEnvs = Object.values(structure.environments || {}).reduce((a, b) => a + b.length, 0);
    const totalClusters = Object.values(structure.clusters || {}).reduce((a, b) => a + b.length, 0);

    return (
      <div style={s.panel}>
        <h1 style={{ ...s.heading, fontSize: 28, marginBottom: 4 }}>Cloudlet Manager</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 28 }}>
          GitOps branch management dashboard
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 32 }}>
          {[
            { label: "Networks", value: totalNetworks, color: "var(--accent)" },
            { label: "Flavors", value: totalFlavors, color: "var(--text-primary)" },
            { label: "Environments", value: totalEnvs, color: "var(--text-primary)" },
            { label: "Clusters", value: totalClusters, color: "var(--success)" },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)", padding: "20px 18px",
              display: "flex", flexDirection: "column" as const, gap: 4,
            }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>
              Networks
            </h2>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
              {(structure.networks || []).map((net) => {
                const flavorCount = (structure.flavors?.[net] || []).length;
                const clusterCount = Object.entries(structure.clusters || {})
                  .filter(([k]) => k.startsWith(net + "/"))
                  .reduce((a, [, v]) => a + v.length, 0);
                return (
                  <div
                    key={net}
                    onClick={() => onNavigate(net, null, null, null)}
                    style={{
                      background: "var(--bg-card)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius)", padding: "14px 16px",
                      cursor: "pointer", transition: "all 0.12s",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                      (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                      (e.currentTarget as HTMLElement).style.background = "var(--bg-card)";
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{net}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        {flavorCount} flavor{flavorCount !== 1 ? "s" : ""} · {clusterCount} cluster{clusterCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "var(--text-muted)" }}>
                      <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>
              Recent Activity
            </h2>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
              {recentChanges.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 12 }}>Loading...</div>
              )}
              {recentChanges.map((entry, i) => {
                const timeAgo = (() => {
                  const diff = Date.now() - new Date(entry.timestamp).getTime();
                  const mins = Math.floor(diff / 60000);
                  if (mins < 60) return `${mins}m ago`;
                  const hrs = Math.floor(mins / 60);
                  if (hrs < 24) return `${hrs}h ago`;
                  return `${Math.floor(hrs / 24)}d ago`;
                })();
                return (
                  <div key={entry.sha + i} style={{
                    background: "var(--bg-card)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius)", padding: "10px 14px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{entry.author}</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{timeAgo}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                      {entry.message.replace(/^\[.*?\]\s*/, "")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayName = cluster || env || flavor || network || "Dashboard";
  const warningCount =
    data?.apps.filter((a) => a.branch_exists === false).length ?? 0;

  let scopeFile = "_apps.yaml";
  const prefix = network ? `${network}/` : "";
  if (flavor && env && cluster) {
    scopeFile = `${prefix}${flavor}/${env}/${cluster}.yaml`;
  } else if (flavor && env) {
    scopeFile = `${prefix}${flavor}/${env}/_apps.yaml`;
  } else if (flavor) {
    scopeFile = `${prefix}${flavor}/_apps.yaml`;
  } else if (network) {
    scopeFile = `${network}/_apps.yaml`;
  }

  return (
    <div style={s.panel}>
      <div style={s.breadcrumb}>
        <span
          style={{ ...s.breadcrumbPart, ...(!network && !flavor ? s.breadcrumbPartActive : {}) }}
          onClick={() => onNavigate(null, null, null, null)}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          root
        </span>
        {network && (
          <>
            <span style={s.breadcrumbSep}>/</span>
            <span
              style={{ ...s.breadcrumbPart, ...(!flavor ? s.breadcrumbPartActive : {}) }}
              onClick={() => onNavigate(network, null, null, null)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {network}
            </span>
          </>
        )}
        {flavor && (
          <>
            <span style={s.breadcrumbSep}>/</span>
            <span
              style={{ ...s.breadcrumbPart, ...(!env ? s.breadcrumbPartActive : {}) }}
              onClick={() => onNavigate(network, flavor, null, null)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {flavor}
            </span>
          </>
        )}
        {env && (
          <>
            <span style={s.breadcrumbSep}>/</span>
            <span
              style={{ ...s.breadcrumbPart, ...(!cluster ? s.breadcrumbPartActive : {}) }}
              onClick={() => onNavigate(network, flavor, env, null)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {env}
            </span>
          </>
        )}
        {cluster && (
          <>
            <span style={s.breadcrumbSep}>/</span>
            <span style={{ ...s.breadcrumbPart, ...s.breadcrumbPartActive }}>
              {cluster}
            </span>
          </>
        )}
      </div>

      <h1 style={s.heading}>{displayName}</h1>
      {data && <div style={s.scopeType}>{data.scope_type} scope</div>}

      {loading && <div style={s.loading}>Loading apps...</div>}
      {error && <div style={s.error}>{error}</div>}

      {data && !loading && (
        <>
          <div style={{ ...s.stats, alignItems: "center" }}>
            <div style={s.stat}>
              <span style={s.statValue}>{data.apps.length}</span>
              <span style={s.statLabel}>Apps</span>
            </div>
            <div
              style={{
                ...s.stat,
                cursor: warningCount > 0 ? "pointer" : "default",
                border: showMissingOnly ? "1px solid var(--warning)" : "1px solid var(--border)",
                background: showMissingOnly ? "var(--warning-bg)" : "var(--bg-card)",
                transition: "all 0.12s",
              }}
              onClick={() => warningCount > 0 && setShowMissingOnly((v) => !v)}
              onMouseEnter={(e) => {
                if (warningCount > 0 && !showMissingOnly)
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--warning)";
              }}
              onMouseLeave={(e) => {
                if (!showMissingOnly)
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            >
              <span
                style={{
                  ...s.statValue,
                  color: warningCount > 0 ? "var(--warning)" : "var(--success)",
                }}
              >
                {warningCount}
              </span>
              <span style={s.statLabel}>
                Missing Branches
              </span>
            </div>
          </div>

          {data.apps.length === 0 ? (
            <div style={s.empty}>
              No apps defined at this scope level.
              <br />
              <span style={{ fontSize: 13 }}>
                Apps may be inherited from a broader scope.
              </span>
            </div>
          ) : (
            <>
              <div style={s.toolbar}>
                {(["all", "edgeApps", "hubApps"] as const).map((f) => (
                  <button
                    key={f}
                    style={{
                      ...s.filterBtn,
                      ...(categoryFilter === f ? s.filterBtnActive : {}),
                    }}
                    onClick={() => setCategoryFilter(f)}
                  >
                    {f === "all" ? "All" : f === "edgeApps" ? "Edge Apps" : "Hub Apps"}
                    <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>
                      {f === "all"
                        ? data.apps.length
                        : data.apps.filter((a) => a.category === f).length}
                    </span>
                  </button>
                ))}
                <input
                  style={s.scopeSearch}
                  placeholder="Filter apps..."
                  value={scopeSearch}
                  onChange={(e) => setScopeSearch(e.target.value)}
                />
                <button
                  style={s.addBtn}
                  onClick={() => setShowAddApp(true)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                    (e.currentTarget as HTMLElement).style.background = "var(--accent)";
                    (e.currentTarget as HTMLElement).style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                    (e.currentTarget as HTMLElement).style.background = "var(--accent-muted)";
                    (e.currentTarget as HTMLElement).style.color = "var(--accent)";
                  }}
                >
                  + Add App
                </button>
              </div>
              <div style={s.grid}>
                {data.apps
                  .filter((app) => categoryFilter === "all" || app.category === categoryFilter)
                  .filter((app) => !showMissingOnly || app.branch_exists === false)
                  .filter((app) => !scopeSearch.trim() || app.name.toLowerCase().includes(scopeSearch.toLowerCase()))
                  .map((app) => (
                    <AppCard
                      key={`${app.name}-${app.defined_at}`}
                      app={app}
                      scopeFile={scopeFile}
                      onUpdated={() => setRefreshKey((k) => k + 1)}
                    />
                  ))}
              </div>
            </>
          )}
        </>
      )}

      {showAddApp && (
        <div
          style={s.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && setShowAddApp(false)}
        >
          <div style={s.modal}>
            <div style={s.modalTitle}>Add App</div>

            <div style={s.formGroup}>
              <label style={s.formLabel}>Category</label>
              <select
                style={s.formSelect}
                value={addCategory}
                onChange={(e) => setAddCategory(e.target.value)}
              >
                <option value="edgeApps">edgeApps</option>
                <option value="hubApps">hubApps</option>
              </select>
            </div>

            <div style={s.formGroup}>
              <label style={s.formLabel}>App Name</label>
              <input
                style={s.formInput}
                placeholder="my-app"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.formLabel}>Repo URL</label>
              <input
                style={s.formInput}
                placeholder="https://github.com/org/repo"
                value={addRepoUrl}
                onChange={(e) => setAddRepoUrl(e.target.value)}
              />
            </div>

            {addBranchesLoading && (
              <div style={{ fontSize: 12, color: "var(--accent)", padding: "8px 0" }}>
                Loading branches...
              </div>
            )}

            {addBranches.length > 0 && (
              <>
                <div style={s.formGroup}>
                  <label style={s.formLabel}>Target Revision</label>
                  <select
                    style={s.formSelect}
                    value={addRevision}
                    onChange={(e) => setAddRevision(e.target.value)}
                  >
                    {addBranches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div style={s.formGroup}>
                  <label style={s.formLabel}>
                    Value Files
                    {addValuesLoading && <span style={{ fontSize: 10, color: "var(--accent)", marginLeft: 8 }}>Loading...</span>}
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 6 }}>
                    {addValueFiles.map((vf, idx) => (
                      <span key={`${vf}-${idx}`} style={{
                        display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12,
                        background: "var(--bg-input)", border: "1px solid var(--border)",
                        borderRadius: 6, padding: "4px 8px", color: "var(--text-primary)",
                      }}>
                        {vf}
                        <button
                          onClick={() => setAddValueFiles((prev) => prev.filter((_, i) => i !== idx))}
                          style={{
                            background: "none", border: "none", color: "var(--text-muted)",
                            cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px",
                          }}
                        >&times;</button>
                      </span>
                    ))}
                    {addValuesOptions.length > 0 && (
                      <select
                        style={{ ...s.formSelect, maxWidth: 200, fontSize: 12, padding: "4px 8px" }}
                        value=""
                        onChange={(e) => {
                          if (e.target.value && !addValueFiles.includes(e.target.value)) {
                            setAddValueFiles((prev) => [...prev, e.target.value]);
                          }
                        }}
                      >
                        <option value="">+ Add...</option>
                        {addValuesOptions
                          .filter((f) => !addValueFiles.includes(f))
                          .map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>
              </>
            )}

            {addError && (
              <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 10 }}>
                {addError}
              </div>
            )}

            <div style={s.modalActions}>
              <button
                style={s.modalCancelBtn}
                onClick={() => setShowAddApp(false)}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
              >
                Cancel
              </button>
              <button
                style={{
                  ...s.modalSubmitBtn,
                  ...(!addName.trim() || !addRepoUrl.trim() || addingApp ? s.modalSubmitBtnDisabled : {}),
                }}
                disabled={!addName.trim() || !addRepoUrl.trim() || addingApp}
                onClick={handleAddApp}
                onMouseEnter={(e) => {
                  if (addName.trim() && addRepoUrl.trim() && !addingApp)
                    (e.currentTarget as HTMLElement).style.background = "var(--accent-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--accent)";
                }}
              >
                {addingApp ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
