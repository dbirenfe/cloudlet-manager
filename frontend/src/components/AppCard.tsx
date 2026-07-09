import { type CSSProperties, useEffect, useState } from "react";
import type { AppConfig, BranchUpdateResponse } from "../api/client";
import { fetchBranches, updateBranch } from "../api/client";

interface AppCardProps {
  app: AppConfig;
  onUpdated: () => void;
}

const s: Record<string, CSSProperties> = {
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: 20,
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  cardWarning: {
    borderColor: "var(--warning)",
    boxShadow: "0 0 0 1px var(--warning-bg)",
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  appName: {
    fontSize: 16,
    fontWeight: 600,
    color: "var(--text-primary)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  warningBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--warning)",
    background: "var(--warning-bg)",
    padding: "2px 8px",
    borderRadius: 6,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  meta: {
    display: "flex",
    gap: 16,
    marginBottom: 14,
    flexWrap: "wrap" as const,
  },
  metaItem: {
    fontSize: 12,
    color: "var(--text-muted)",
  },
  metaLabel: {
    color: "var(--text-secondary)",
    fontWeight: 500,
  },
  repoUrl: {
    fontSize: 12,
    color: "var(--accent)",
    textDecoration: "none",
    wordBreak: "break-all" as const,
  },
  branchRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  select: {
    flex: 1,
    maxWidth: 360,
    padding: "8px 12px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
    cursor: "pointer",
    appearance: "none" as const,
    backgroundImage:
      'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238b8fa3\' stroke-width=\'2\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
    backgroundSize: 16,
    paddingRight: 32,
  },
  applyBtn: {
    padding: "8px 20px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s, opacity 0.15s",
    whiteSpace: "nowrap" as const,
  },
  applyBtnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  successMsg: {
    fontSize: 12,
    color: "var(--success)",
    marginTop: 8,
  },
  errorMsg: {
    fontSize: 12,
    color: "var(--danger)",
    marginTop: 8,
  },
  definedAt: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginTop: 8,
    fontStyle: "italic",
  },
};

export default function AppCard({ app, onUpdated }: AppCardProps) {
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(
    app.source.targetRevision
  );
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<BranchUpdateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedBranch(app.source.targetRevision);
    setResult(null);
    setError(null);
  }, [app.source.targetRevision]);

  const loadBranches = async () => {
    if (branches.length > 0) return;
    setLoadingBranches(true);
    try {
      const data = await fetchBranches(app.source.repoURL);
      setBranches(data.branches);
    } catch {
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleApply = async () => {
    if (selectedBranch === app.source.targetRevision) return;
    setUpdating(true);
    setError(null);
    setResult(null);
    try {
      const res = await updateBranch(
        app.defined_at,
        app.name,
        selectedBranch
      );
      setResult(res);
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const hasWarning = app.branch_exists === false;
  const isChanged = selectedBranch !== app.source.targetRevision;

  return (
    <div style={{ ...s.card, ...(hasWarning ? s.cardWarning : {}) }}>
      <div style={s.topRow}>
        <div style={s.appName}>
          {app.name}
          {hasWarning && (
            <span style={s.warningBadge}>
              ⚠ Branch not found
            </span>
          )}
        </div>
      </div>

      <div style={s.meta}>
        <span style={s.metaItem}>
          <span style={s.metaLabel}>Repo: </span>
          <a
            href={app.source.repoURL}
            target="_blank"
            rel="noreferrer"
            style={s.repoUrl}
          >
            {app.source.repoURL.replace("https://github.com/", "")}
          </a>
        </span>
        {app.source.helm?.valuesFiles && (
          <span style={s.metaItem}>
            <span style={s.metaLabel}>Values: </span>
            {(app.source.helm.valuesFiles as string[]).join(", ")}
          </span>
        )}
      </div>

      <div style={s.branchRow}>
        <select
          style={s.select}
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          onFocus={loadBranches}
        >
          <option value={app.source.targetRevision}>
            {app.source.targetRevision}
            {hasWarning ? " (missing!)" : " (current)"}
          </option>
          {branches
            .filter((b) => b !== app.source.targetRevision)
            .map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          {loadingBranches && (
            <option disabled>Loading branches...</option>
          )}
        </select>

        <button
          style={{
            ...s.applyBtn,
            ...(!isChanged || updating ? s.applyBtnDisabled : {}),
          }}
          disabled={!isChanged || updating}
          onClick={handleApply}
          onMouseEnter={(e) => {
            if (isChanged && !updating)
              (e.currentTarget as HTMLElement).style.background =
                "var(--accent-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--accent)";
          }}
        >
          {updating ? "Applying..." : "Apply"}
        </button>
      </div>

      {result && (
        <div style={s.successMsg}>
          Updated successfully.{" "}
          {result.commit_url && (
            <a
              href={result.commit_url}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--success)" }}
            >
              View commit
            </a>
          )}
        </div>
      )}
      {error && <div style={s.errorMsg}>{error}</div>}

      <div style={s.definedAt}>
        Defined in: {app.defined_at}
        {app.inherited_from && ` (overrides ${app.inherited_from})`}
      </div>
    </div>
  );
}
