import { type CSSProperties, useEffect, useState } from "react";
import type { AppConfig, BranchUpdateResponse } from "../api/client";
import {
  fetchBranches,
  updateBranch,
  fetchValuesFiles,
  updateValuesFiles,
} from "../api/client";

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
    marginBottom: 16,
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
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "var(--text-muted)",
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  fieldRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
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
    padding: "8px 16px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s, opacity 0.15s",
    whiteSpace: "nowrap" as const,
  },
  applyBtnDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  successMsg: {
    fontSize: 12,
    color: "var(--success)",
    marginTop: 6,
  },
  errorMsg: {
    fontSize: 12,
    color: "var(--danger)",
    marginTop: 6,
  },
  definedAt: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px solid var(--border)",
    fontStyle: "italic",
  },
  valuesChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "4px 8px",
    color: "var(--text-primary)",
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
    padding: "0 2px",
    display: "flex",
    alignItems: "center",
  },
  valuesRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap" as const,
  },
};

export default function AppCard({ app, onUpdated }: AppCardProps) {
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(app.source.targetRevision);
  const [updatingBranch, setUpdatingBranch] = useState(false);
  const [branchResult, setBranchResult] = useState<BranchUpdateResponse | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);

  const currentValues: string[] = Array.isArray(app.source.helm?.valuesFiles)
    ? (app.source.helm!.valuesFiles as string[])
    : [];
  const [editedValues, setEditedValues] = useState<string[]>(currentValues);
  const [availableValues, setAvailableValues] = useState<string[]>([]);
  const [loadingValues, setLoadingValues] = useState(false);
  const [updatingValues, setUpdatingValues] = useState(false);
  const [valuesResult, setValuesResult] = useState<BranchUpdateResponse | null>(null);
  const [valuesError, setValuesError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedBranch(app.source.targetRevision);
    setBranchResult(null);
    setBranchError(null);
    const newVals = Array.isArray(app.source.helm?.valuesFiles)
      ? (app.source.helm!.valuesFiles as string[])
      : [];
    setEditedValues(newVals);
    setValuesResult(null);
    setValuesError(null);
  }, [app]);

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

  const loadValuesFiles = async () => {
    if (availableValues.length > 0) return;
    setLoadingValues(true);
    try {
      const data = await fetchValuesFiles(app.source.repoURL, app.source.targetRevision);
      setAvailableValues(data.files);
    } catch {
      setAvailableValues([]);
    } finally {
      setLoadingValues(false);
    }
  };

  const handleApplyBranch = async () => {
    if (selectedBranch === app.source.targetRevision) return;
    setUpdatingBranch(true);
    setBranchError(null);
    setBranchResult(null);
    try {
      const res = await updateBranch(app.defined_at, app.name, selectedBranch);
      setBranchResult(res);
      onUpdated();
    } catch (e) {
      setBranchError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdatingBranch(false);
    }
  };

  const handleApplyValues = async () => {
    setUpdatingValues(true);
    setValuesError(null);
    setValuesResult(null);
    try {
      const res = await updateValuesFiles(app.defined_at, app.name, editedValues);
      setValuesResult(res);
      onUpdated();
    } catch (e) {
      setValuesError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdatingValues(false);
    }
  };

  const removeValue = (idx: number) => {
    setEditedValues((prev) => prev.filter((_, i) => i !== idx));
  };

  const addValue = (file: string) => {
    if (file && !editedValues.includes(file)) {
      setEditedValues((prev) => [...prev, file]);
    }
  };

  const hasWarning = app.branch_exists === false;
  const isBranchChanged = selectedBranch !== app.source.targetRevision;
  const isValuesChanged =
    JSON.stringify(editedValues) !== JSON.stringify(currentValues);

  return (
    <div style={{ ...s.card, ...(hasWarning ? s.cardWarning : {}) }}>
      <div style={s.topRow}>
        <div style={s.appName}>
          {app.name}
          {hasWarning && (
            <span style={s.warningBadge}>Branch not found</span>
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
      </div>

      {/* Branch selector */}
      <div style={s.fieldGroup}>
        <div style={s.fieldLabel}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M5 2V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M11 6V14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="5" cy="12" r="2" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="11" cy="4" r="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5 10C5 8 8 6 11 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Target Revision
        </div>
        <div style={s.fieldRow}>
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
            {loadingBranches && <option disabled>Loading branches...</option>}
          </select>

          <button
            style={{
              ...s.applyBtn,
              ...(!isBranchChanged || updatingBranch ? s.applyBtnDisabled : {}),
            }}
            disabled={!isBranchChanged || updatingBranch}
            onClick={handleApplyBranch}
            onMouseEnter={(e) => {
              if (isBranchChanged && !updatingBranch)
                (e.currentTarget as HTMLElement).style.background = "var(--accent-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--accent)";
            }}
          >
            {updatingBranch ? "Applying..." : "Apply"}
          </button>
        </div>
        {branchResult && (
          <div style={s.successMsg}>
            Branch updated.{" "}
            {branchResult.commit_url && (
              <a href={branchResult.commit_url} target="_blank" rel="noreferrer" style={{ color: "var(--success)" }}>
                View commit
              </a>
            )}
          </div>
        )}
        {branchError && <div style={s.errorMsg}>{branchError}</div>}
      </div>

      {/* Values files editor */}
      <div style={s.fieldGroup}>
        <div style={s.fieldLabel}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5 5H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M5 8H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M5 11H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Values Files
        </div>

        <div style={s.valuesRow}>
          {editedValues.map((vf, idx) => (
            <span key={`${vf}-${idx}`} style={s.valuesChip}>
              {vf}
              <button style={s.removeBtn} onClick={() => removeValue(idx)} title="Remove">
                &times;
              </button>
            </span>
          ))}

          <select
            style={{
              ...s.select,
              maxWidth: 220,
              flex: "none",
              fontSize: 12,
            }}
            value=""
            onChange={(e) => {
              if (e.target.value) addValue(e.target.value);
            }}
            onFocus={loadValuesFiles}
          >
            <option value="">+ Add values file...</option>
            {availableValues
              .filter((f) => !editedValues.includes(f))
              .map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            {loadingValues && <option disabled>Loading files...</option>}
          </select>

          <button
            style={{
              ...s.applyBtn,
              ...(!isValuesChanged || updatingValues ? s.applyBtnDisabled : {}),
            }}
            disabled={!isValuesChanged || updatingValues}
            onClick={handleApplyValues}
            onMouseEnter={(e) => {
              if (isValuesChanged && !updatingValues)
                (e.currentTarget as HTMLElement).style.background = "var(--accent-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--accent)";
            }}
          >
            {updatingValues ? "Applying..." : "Apply"}
          </button>
        </div>

        {valuesResult && (
          <div style={s.successMsg}>
            Values updated.{" "}
            {valuesResult.commit_url && (
              <a href={valuesResult.commit_url} target="_blank" rel="noreferrer" style={{ color: "var(--success)" }}>
                View commit
              </a>
            )}
          </div>
        )}
        {valuesError && <div style={s.errorMsg}>{valuesError}</div>}
      </div>

      <div style={s.definedAt}>
        Defined in: {app.defined_at}
        {app.inherited_from && ` (overrides ${app.inherited_from})`}
      </div>
    </div>
  );
}
