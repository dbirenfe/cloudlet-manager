import { type CSSProperties, useEffect, useState } from "react";
import type {
  RepoStructure,
  ClusterInfo,
  AppConfig,
  BulkTarget,
  BulkUpdateResult,
} from "../api/client";
import { bulkUpdate, fetchApps, fetchBranches } from "../api/client";

interface BulkUpdatePanelProps {
  structure: RepoStructure | null;
  onClose: () => void;
}

const s: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
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
    width: 640,
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column" as const,
    boxShadow: "var(--shadow)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 24px",
    borderBottom: "1px solid var(--border)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    fontSize: 20,
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: "var(--radius)",
    transition: "color 0.12s",
  },
  body: {
    flex: 1,
    overflowY: "auto" as const,
    padding: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
    marginBottom: 8,
    marginTop: 16,
  },
  clusterList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    maxHeight: 180,
    overflowY: "auto" as const,
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 8,
  },
  clusterRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 6px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 13,
    color: "var(--text-secondary)",
    transition: "background 0.1s",
  },
  checkbox: {
    accentColor: "var(--accent)",
    cursor: "pointer",
  },
  selectRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    marginTop: 4,
  },
  select: {
    flex: 1,
    padding: "8px 12px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
  },
  input: {
    flex: 1,
    padding: "8px 12px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
  },
  previewSection: {
    marginTop: 16,
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 14,
  },
  previewItem: {
    fontSize: 12,
    color: "var(--text-secondary)",
    padding: "4px 0",
    fontFamily: "monospace",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 24px",
    borderTop: "1px solid var(--border)",
  },
  applyBtn: {
    padding: "8px 20px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s, opacity 0.15s",
  },
  applyBtnDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  resultRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 0",
    fontSize: 12,
    borderBottom: "1px solid var(--border)",
  },
  successBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--success)",
    background: "var(--success-bg)",
    padding: "2px 8px",
    borderRadius: 4,
  },
  failBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--danger)",
    background: "var(--danger-bg)",
    padding: "2px 8px",
    borderRadius: 4,
  },
  selectAllBtn: {
    fontSize: 11,
    color: "var(--accent)",
    background: "var(--accent-muted)",
    border: "none",
    borderRadius: 4,
    padding: "3px 8px",
    cursor: "pointer",
    marginLeft: "auto",
  },
};

export default function BulkUpdatePanel({
  structure,
  onClose,
}: BulkUpdatePanelProps) {
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(
    new Set()
  );
  const [appConfigs, setAppConfigs] = useState<AppConfig[]>([]);
  const [selectedApp, setSelectedApp] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [newValue, setNewValue] = useState("");
  const [field] = useState<"targetRevision" | "valuesFiles">("targetRevision");
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<BulkUpdateResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const appNames = appConfigs.map((a) => a.name);

  const allClusters: (ClusterInfo & { envKey: string })[] = [];
  if (structure) {
    for (const [envKey, clusters] of Object.entries(structure.clusters)) {
      for (const cl of clusters) {
        allClusters.push({ ...cl, envKey });
      }
    }
  }

  const toggleCluster = (key: string) => {
    setSelectedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedClusters.size === allClusters.length) {
      setSelectedClusters(new Set());
    } else {
      setSelectedClusters(
        new Set(allClusters.map((c) => `${c.envKey}/${c.name}`))
      );
    }
  };

  useEffect(() => {
    setSelectedApp("");
    setBranches([]);
    setNewValue("");
    setResults(null);

    if (selectedClusters.size === 0) {
      setAppConfigs([]);
      return;
    }
    const first = Array.from(selectedClusters)[0];
    const parts = first.split("/");
    const flavor = parts[0];
    const env = parts[1];
    const cluster = parts.slice(2).join("/");

    let cancelled = false;
    fetchApps(flavor, env, cluster)
      .then((data) => {
        if (!cancelled) setAppConfigs(data.apps);
      })
      .catch(() => {
        if (!cancelled) setAppConfigs([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClusters]);

  useEffect(() => {
    setBranches([]);
    setNewValue("");
    if (!selectedApp) return;

    const app = appConfigs.find((a) => a.name === selectedApp);
    if (!app) return;

    let cancelled = false;
    fetchBranches(app.source.repoURL)
      .then((b) => {
        if (!cancelled) setBranches(b.branches);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedApp]);

  const targets: BulkTarget[] = Array.from(selectedClusters).map((key) => {
    const parts = key.split("/");
    const flavor = parts[0];
    const env = parts[1];
    const cluster = parts.slice(2).join("/");
    return {
      file_path: `${flavor}/${env}/${cluster}.yaml`,
      app_name: selectedApp,
    };
  });

  const canApply =
    selectedClusters.size > 0 && selectedApp && newValue.trim();

  const handleApply = async () => {
    if (!canApply) return;
    setApplying(true);
    setError(null);
    setResults(null);
    try {
      const data = await bulkUpdate(targets, field, newValue.trim());
      setResults(data.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.headerTitle}>Bulk Update</span>
          <button style={s.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={s.body}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ ...s.sectionLabel, marginTop: 0, flex: 1 }}>
              Select Clusters
            </div>
            <button style={s.selectAllBtn} onClick={selectAll}>
              {selectedClusters.size === allClusters.length
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>
          <div style={s.clusterList}>
            {allClusters.map((cl) => {
              const key = `${cl.envKey}/${cl.name}`;
              return (
                <label
                  key={key}
                  style={s.clusterRow}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "var(--bg-hover)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "transparent")
                  }
                >
                  <input
                    type="checkbox"
                    checked={selectedClusters.has(key)}
                    onChange={() => toggleCluster(key)}
                    style={s.checkbox}
                  />
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {cl.name}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {cl.envKey}
                  </span>
                </label>
              );
            })}
            {allClusters.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 8 }}>
                No clusters available
              </div>
            )}
          </div>

          <div style={s.sectionLabel}>App & Branch</div>
          <div style={s.selectRow}>
            <select
              style={s.select}
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
            >
              <option value="">Select app...</option>
              {appNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              style={s.select}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            >
              <option value="">Select branch...</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          {!branches.length && selectedApp && (
            <input
              style={{ ...s.input, marginTop: 8 }}
              placeholder="Or type a branch name..."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
          )}

          {canApply && targets.length > 0 && !results && (
            <div style={s.previewSection}>
              <div style={{ ...s.sectionLabel, marginTop: 0 }}>
                Preview ({targets.length} target{targets.length !== 1 ? "s" : ""})
              </div>
              {targets.map((t) => (
                <div key={`${t.file_path}-${t.app_name}`} style={s.previewItem}>
                  {t.file_path} → {t.app_name} → {newValue}
                </div>
              ))}
            </div>
          )}

          {results && (
            <div style={{ marginTop: 16 }}>
              <div style={s.sectionLabel}>Results</div>
              {results.map((r, i) => (
                <div key={i} style={s.resultRow}>
                  <span
                    style={r.success ? s.successBadge : s.failBadge}
                  >
                    {r.success ? "OK" : "FAIL"}
                  </span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      flex: 1,
                    }}
                  >
                    {r.file_path} / {r.app_name}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {r.message}
                  </span>
                  {r.commit_url && (
                    <a
                      href={r.commit_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 11, color: "var(--accent)" }}
                    >
                      commit
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: 12,
                color: "var(--danger)",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div style={s.footer}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {selectedClusters.size} cluster{selectedClusters.size !== 1 ? "s" : ""} selected
          </span>
          <button
            style={{
              ...s.applyBtn,
              ...(!canApply || applying ? s.applyBtnDisabled : {}),
            }}
            disabled={!canApply || applying}
            onClick={handleApply}
            onMouseEnter={(e) => {
              if (canApply && !applying)
                (e.currentTarget as HTMLElement).style.background =
                  "var(--accent-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "var(--accent)";
            }}
          >
            {applying ? "Applying..." : "Apply All"}
          </button>
        </div>
      </div>
    </div>
  );
}
