import { type CSSProperties, useEffect, useState } from "react";
import type { AppConfig, UpdateResponse } from "../api/client";
import {
  fetchBranches,
  updateBranch,
  fetchValuesFiles,
  updateValuesFile,
  inheritField,
} from "../api/client";

interface AppCardProps {
  app: AppConfig;
  scopeFile: string;
  onUpdated: () => void;
}

const INHERIT_VALUE = "__INHERIT__";

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
  inheritedBadge: {
    fontSize: 10,
    fontWeight: 500,
    color: "var(--text-muted)",
    background: "var(--border)",
    padding: "2px 6px",
    borderRadius: 4,
    marginLeft: 4,
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
  },
  sourceFile: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "var(--text-secondary)",
  },
};

function BranchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M5 2V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M11 6V14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="5" cy="12" r="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="11" cy="4" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 10C5 8 8 6 11 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 5H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5 8H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5 11H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function AppCard({ app, scopeFile, onUpdated }: AppCardProps) {
  const { branch_info, values_info } = app;

  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(
    branch_info.is_local ? branch_info.value : INHERIT_VALUE
  );

  const [valuesFiles, setValuesFiles] = useState<string[]>([]);
  const [loadingValues, setLoadingValues] = useState(false);
  const [selectedValues, setSelectedValues] = useState(
    values_info.is_local ? values_info.value : INHERIT_VALUE
  );

  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<UpdateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedBranch(branch_info.is_local ? branch_info.value : INHERIT_VALUE);
    setSelectedValues(values_info.is_local ? values_info.value : INHERIT_VALUE);
    setResult(null);
    setError(null);
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
    if (valuesFiles.length > 0) return;
    setLoadingValues(true);
    try {
      const data = await fetchValuesFiles(
        app.source.repoURL,
        app.source.targetRevision || "main"
      );
      setValuesFiles(data.files);
    } catch {
      setValuesFiles([]);
    } finally {
      setLoadingValues(false);
    }
  };

  const currentBranchState = branch_info.is_local
    ? branch_info.value
    : INHERIT_VALUE;
  const currentValuesState = values_info.is_local
    ? values_info.value
    : INHERIT_VALUE;

  const isBranchChanged = selectedBranch !== currentBranchState;
  const isValuesChanged = selectedValues !== currentValuesState;
  const hasAnyChange = isBranchChanged || isValuesChanged;

  const handleApply = async () => {
    if (!hasAnyChange) return;
    setUpdating(true);
    setError(null);
    setResult(null);

    try {
      let lastResult: UpdateResponse | null = null;

      if (isBranchChanged) {
        if (selectedBranch === INHERIT_VALUE) {
          lastResult = await inheritField(scopeFile, app.name, "targetRevision");
        } else {
          lastResult = await updateBranch(scopeFile, app.name, selectedBranch);
        }
      }

      if (isValuesChanged) {
        if (selectedValues === INHERIT_VALUE) {
          lastResult = await inheritField(scopeFile, app.name, "valuesFiles");
        } else {
          lastResult = await updateValuesFile(scopeFile, app.name, selectedValues);
        }
      }

      setResult(lastResult);
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const hasWarning = app.branch_exists === false;

  const inheritBranchLabel = branch_info.parent_value
    ? `Inherit from parent scope (${branch_info.parent_value})`
    : "Inherit from parent scope";

  const inheritValuesLabel = values_info.parent_value
    ? `Inherit from parent scope (${values_info.parent_value})`
    : "Inherit from parent scope";

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
          <BranchIcon />
          Target Revision
          {!branch_info.is_local && (
            <span style={s.inheritedBadge}>inherited</span>
          )}
        </div>
        <div style={s.fieldRow}>
          <select
            style={s.select}
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            onFocus={loadBranches}
          >
            {branch_info.parent_value !== null && (
              <option value={INHERIT_VALUE}>{inheritBranchLabel}</option>
            )}
            <option value={branch_info.value}>
              {branch_info.value}
              {hasWarning ? " (missing!)" : ""}
              {selectedBranch !== INHERIT_VALUE &&
                branch_info.value === currentBranchState
                ? " (current)"
                : ""}
            </option>
            {branches
              .filter(
                (b) => b !== branch_info.value
              )
              .map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            {loadingBranches && <option disabled>Loading branches...</option>}
          </select>
        </div>
        {!branch_info.is_local && branch_info.defined_at && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            From <span style={s.sourceFile}>{branch_info.defined_at}</span>
          </div>
        )}
      </div>

      {/* Values file selector */}
      <div style={s.fieldGroup}>
        <div style={s.fieldLabel}>
          <FileIcon />
          Values File
          {!values_info.is_local && (
            <span style={s.inheritedBadge}>inherited</span>
          )}
        </div>
        <div style={s.fieldRow}>
          <select
            style={s.select}
            value={selectedValues}
            onChange={(e) => setSelectedValues(e.target.value)}
            onFocus={loadValuesFiles}
          >
            {values_info.parent_value !== null && (
              <option value={INHERIT_VALUE}>{inheritValuesLabel}</option>
            )}
            {values_info.value && (
              <option value={values_info.value}>
                {values_info.value}
                {selectedValues !== INHERIT_VALUE &&
                  values_info.value === currentValuesState
                  ? " (current)"
                  : ""}
              </option>
            )}
            {valuesFiles
              .filter((f) => f !== values_info.value)
              .map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            {loadingValues && <option disabled>Loading files...</option>}
          </select>
        </div>
        {!values_info.is_local && values_info.defined_at && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            From <span style={s.sourceFile}>{values_info.defined_at}</span>
          </div>
        )}
      </div>

      {/* Single apply button for all changes */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          style={{
            ...s.applyBtn,
            ...(!hasAnyChange || updating ? s.applyBtnDisabled : {}),
          }}
          disabled={!hasAnyChange || updating}
          onClick={handleApply}
          onMouseEnter={(e) => {
            if (hasAnyChange && !updating)
              (e.currentTarget as HTMLElement).style.background =
                "var(--accent-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--accent)";
          }}
        >
          {updating ? "Applying..." : "Apply Changes"}
        </button>
        {hasAnyChange && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {[
              isBranchChanged &&
                (selectedBranch === INHERIT_VALUE
                  ? "branch: inherit"
                  : `branch: ${selectedBranch}`),
              isValuesChanged &&
                (selectedValues === INHERIT_VALUE
                  ? "values: inherit"
                  : `values: ${selectedValues}`),
            ]
              .filter(Boolean)
              .join(", ")}
          </span>
        )}
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
        <span style={s.sourceFile}>{app.defined_at}</span>
        {app.inherited_from && (
          <span>
            {" "}
            (overrides <span style={s.sourceFile}>{app.inherited_from}</span>)
          </span>
        )}
      </div>
    </div>
  );
}
