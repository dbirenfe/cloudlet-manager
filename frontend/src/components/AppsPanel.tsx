import { type CSSProperties, useEffect, useState } from "react";
import type { ScopeApps, AddAppRequest } from "../api/client";
import { fetchApps, addApp } from "../api/client";
import AppCard from "./AppCard";

interface AppsPanelProps {
  flavor: string | null;
  env: string | null;
  cluster: string | null;
  onNavigate: (
    flavor: string | null,
    env: string | null,
    cluster: string | null
  ) => void;
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
    gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))",
    gap: 16,
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
    padding: "8px 16px",
    background: "var(--accent-muted)",
    color: "var(--accent)",
    border: "1px solid transparent",
    borderRadius: "var(--radius)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
    display: "flex",
    alignItems: "center",
    gap: 6,
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

export default function AppsPanel({ flavor, env, cluster, onNavigate }: AppsPanelProps) {
  const [data, setData] = useState<ScopeApps | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddApp, setShowAddApp] = useState(false);
  const [addCategory, setAddCategory] = useState("edgeApps");
  const [addName, setAddName] = useState("");
  const [addRepoUrl, setAddRepoUrl] = useState("");
  const [addRevision, setAddRevision] = useState("main");
  const [addValueFiles, setAddValueFiles] = useState("values.yaml");
  const [addingApp, setAddingApp] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchApps(flavor ?? undefined, env ?? undefined, cluster ?? undefined)
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
  }, [flavor, env, cluster, refreshKey]);

  const breadcrumbParts: string[] = [];
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
        value_files: addValueFiles.split(",").map((v) => v.trim()).filter(Boolean),
      };
      await addApp(req);
      setShowAddApp(false);
      setAddName("");
      setAddRepoUrl("");
      setAddRevision("main");
      setAddValueFiles("values.yaml");
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add app");
    } finally {
      setAddingApp(false);
    }
  };

  const displayName = cluster || env || flavor || "All Clusters";
  const warningCount =
    data?.apps.filter((a) => a.branch_exists === false).length ?? 0;

  let scopeFile = "_apps.yaml";
  if (flavor && env && cluster) {
    scopeFile = `${flavor}/${env}/${cluster}.yaml`;
  } else if (flavor && env) {
    scopeFile = `${flavor}/${env}/_apps.yaml`;
  } else if (flavor) {
    scopeFile = `${flavor}/_apps.yaml`;
  }

  return (
    <div style={s.panel}>
      <div style={s.breadcrumb}>
        <span
          style={{ ...s.breadcrumbPart, ...(!flavor ? s.breadcrumbPartActive : {}) }}
          onClick={() => onNavigate(null, null, null)}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          root
        </span>
        {flavor && (
          <>
            <span style={s.breadcrumbSep}>/</span>
            <span
              style={{ ...s.breadcrumbPart, ...(!env ? s.breadcrumbPartActive : {}) }}
              onClick={() => onNavigate(flavor, null, null)}
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
              onClick={() => onNavigate(flavor, env, null)}
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
            <div style={s.stat}>
              <span
                style={{
                  ...s.statValue,
                  color: warningCount > 0 ? "var(--warning)" : "var(--success)",
                }}
              >
                {warningCount}
              </span>
              <span style={s.statLabel}>Missing Branches</span>
            </div>
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
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Add App
            </button>
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
            <div style={s.grid}>
              {data.apps.map((app) => (
                <AppCard
                  key={`${app.name}-${app.defined_at}`}
                  app={app}
                  scopeFile={scopeFile}
                  onUpdated={() => setRefreshKey((k) => k + 1)}
                />
              ))}
            </div>
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

            <div style={s.formGroup}>
              <label style={s.formLabel}>Target Revision</label>
              <input
                style={s.formInput}
                placeholder="main"
                value={addRevision}
                onChange={(e) => setAddRevision(e.target.value)}
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.formLabel}>Value Files (comma-separated)</label>
              <input
                style={s.formInput}
                placeholder="values.yaml"
                value={addValueFiles}
                onChange={(e) => setAddValueFiles(e.target.value)}
              />
            </div>

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
