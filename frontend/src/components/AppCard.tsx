import { type CSSProperties, useEffect, useState } from "react";
import type { AppConfig, UpdateResponse, SyncPolicy } from "../api/client";
import {
  fetchBranches,
  updateBranch,
  fetchValuesFiles,
  updateValuesFiles,
  inheritField,
  previewDiff,
  undoLastChange,
  removeApp,
  updateSyncPolicy,
} from "../api/client";

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 4H13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6 2H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4 4L5 14H11L12 4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

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
    padding: 16,
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
    marginBottom: 8,
  },
  appName: {
    fontSize: 13,
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
    gap: 10,
    marginBottom: 10,
    flexWrap: "wrap" as const,
  },
  metaItem: { fontSize: 12, color: "var(--text-muted)" },
  metaLabel: { color: "var(--text-secondary)", fontWeight: 500 },
  repoUrl: {
    fontSize: 12,
    color: "var(--accent)",
    textDecoration: "none",
    wordBreak: "break-all" as const,
  },
  fieldGroup: { marginBottom: 10 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "var(--text-muted)",
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  fieldRow: { display: "flex", alignItems: "center", gap: 10 },
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
  applyBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  successMsg: { fontSize: 12, color: "var(--success)", marginTop: 6 },
  errorMsg: { fontSize: 12, color: "var(--danger)", marginTop: 6 },
  previewBtn: {
    padding: "8px 16px",
    background: "transparent",
    color: "var(--accent)",
    border: "1px solid var(--accent)",
    borderRadius: "var(--radius)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s",
    whiteSpace: "nowrap" as const,
  },
  diffOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 500,
  },
  diffModal: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    width: "85vw",
    maxWidth: 1000,
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column" as const,
    boxShadow: "var(--shadow)",
  },
  diffHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid var(--border)",
  },
  diffTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  diffCloseBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    fontSize: 20,
    cursor: "pointer",
    padding: "4px 8px",
  },
  diffBody: {
    display: "flex",
    gap: 0,
    flex: 1,
    overflowY: "auto" as const,
  },
  diffPane: {
    flex: 1,
    padding: 16,
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 1.7,
    whiteSpace: "pre" as const,
    overflowX: "auto" as const,
    minWidth: 0,
  },
  diffPaneBefore: {
    borderRight: "1px solid var(--border)",
    background: "var(--bg-input)",
  },
  diffPaneAfter: {
    background: "var(--bg-input)",
  },
  diffPaneLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
    marginBottom: 8,
    display: "block",
  },
  diffLineRemoved: {
    background: "rgba(239, 68, 68, 0.15)",
    color: "#f87171",
    display: "block",
    padding: "0 4px",
    borderRadius: 2,
  },
  diffLineAdded: {
    background: "rgba(34, 197, 94, 0.15)",
    color: "#4ade80",
    display: "block",
    padding: "0 4px",
    borderRadius: 2,
  },
  diffLineNormal: {
    display: "block",
    color: "var(--text-secondary)",
    padding: "0 4px",
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
  valuesRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap" as const,
  },
  chip: {
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
  chipRemove: {
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
  inheritBtn: {
    fontSize: 11,
    color: "var(--accent)",
    background: "var(--accent-muted)",
    border: "1px solid transparent",
    borderRadius: 6,
    padding: "4px 10px",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    transition: "border-color 0.15s",
  },
  inheritBtnActive: {
    borderColor: "var(--accent)",
    fontWeight: 600,
  },
  confirmOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 500,
  },
  confirmModal: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    width: 420,
    padding: 24,
    boxShadow: "var(--shadow)",
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 12,
  },
  confirmSummary: {
    fontSize: 13,
    color: "var(--text-secondary)",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "10px 14px",
    marginBottom: 18,
    lineHeight: 1.6,
  },
  confirmActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelBtn: {
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
  confirmBtn: {
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
  undoBtn: {
    padding: "4px 10px",
    background: "transparent",
    color: "var(--warning)",
    border: "1px solid var(--warning)",
    borderRadius: "var(--radius)",
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
    marginLeft: 8,
    transition: "background 0.15s",
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: 4,
    borderRadius: "var(--radius)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.15s, background 0.15s",
  },
  syncHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    userSelect: "none" as const,
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "var(--text-muted)",
    padding: "6px 0",
  },
  syncChevron: {
    transition: "transform 0.2s ease",
    display: "inline-flex",
  },
  syncBody: {
    overflow: "hidden",
    transition: "max-height 0.25s ease, opacity 0.2s ease",
  },
  syncSubLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 6,
    marginTop: 10,
  },
  syncCheckRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "var(--text-primary)",
    marginBottom: 4,
  },
  syncCheckbox: {
    accentColor: "var(--accent)",
    cursor: "pointer",
    width: 14,
    height: 14,
  },
  syncApplyBtn: {
    padding: "6px 14px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius)",
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s, opacity 0.15s",
    whiteSpace: "nowrap" as const,
    marginTop: 10,
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

function SyncIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M2 8C2 4.68629 4.68629 2 8 2C10.2 2 12.1 3.3 13 5.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M14 8C14 11.3137 11.3137 14 8 14C5.8 14 3.9 12.7 3 10.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M13 2V5.2H9.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 14V10.8H6.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SYNC_OPTION_PRESETS = [
  "CreateNamespace=true",
  "ServerSideApply=true",
  "PruneLast=true",
  "ApplyOutOfSyncOnly=true",
  "PrunePropagationPolicy=foreground",
  "Replace=true",
];

export default function AppCard({ app, scopeFile, onUpdated }: AppCardProps) {
  const { branch_info, values_info } = app;

  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(
    branch_info.is_local ? branch_info.value : INHERIT_VALUE
  );

  const [availableValues, setAvailableValues] = useState<string[]>([]);
  const [loadingValues, setLoadingValues] = useState(false);
  const [editedValues, setEditedValues] = useState<string[]>(
    values_info.is_local ? [...values_info.values] : []
  );
  const [valuesInherit, setValuesInherit] = useState(!values_info.is_local);

  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<UpdateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [applied, setApplied] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [undoResult, setUndoResult] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [showDiff, setShowDiff] = useState(false);
  const [diffBefore, setDiffBefore] = useState("");
  const [diffAfter, setDiffAfter] = useState("");
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  const [syncExpanded, setSyncExpanded] = useState(false);
  const [syncAutomated, setSyncAutomated] = useState(app.sync_policy?.automated !== null && app.sync_policy?.automated !== undefined);
  const [syncPrune, setSyncPrune] = useState(app.sync_policy?.automated?.prune ?? false);
  const [syncSelfHeal, setSyncSelfHeal] = useState(app.sync_policy?.automated?.selfHeal ?? false);
  const [syncOptions, setSyncOptions] = useState<string[]>(app.sync_policy?.syncOptions ?? []);

  useEffect(() => {
    if (applied) return;
    setSelectedBranch(branch_info.is_local ? branch_info.value : INHERIT_VALUE);
    setEditedValues(values_info.is_local ? [...values_info.values] : []);
    setValuesInherit(!values_info.is_local);
    setError(null);
    setSyncAutomated(app.sync_policy?.automated !== null && app.sync_policy?.automated !== undefined);
    setSyncPrune(app.sync_policy?.automated?.prune ?? false);
    setSyncSelfHeal(app.sync_policy?.automated?.selfHeal ?? false);
    setSyncOptions(app.sync_policy?.syncOptions ?? []);
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

  const [valuesLoadedForBranch, setValuesLoadedForBranch] = useState("");

  const loadValuesFiles = async () => {
    const activeBranch = selectedBranch === INHERIT_VALUE
      ? (branch_info.parent_value || branch_info.value || "main")
      : selectedBranch;
    if (availableValues.length > 0 && valuesLoadedForBranch === activeBranch) return;
    setLoadingValues(true);
    try {
      const data = await fetchValuesFiles(app.source.repoURL, activeBranch);
      setAvailableValues(data.files);
      setValuesLoadedForBranch(activeBranch);
    } catch {
      setAvailableValues([]);
    } finally {
      setLoadingValues(false);
    }
  };

  useEffect(() => {
    setAvailableValues([]);
    setValuesLoadedForBranch("");
  }, [selectedBranch]);

  // Determine what changed
  const currentBranchState = branch_info.is_local ? branch_info.value : INHERIT_VALUE;
  const isBranchChanged = selectedBranch !== currentBranchState;

  const wasValuesInherited = !values_info.is_local;
  const isValuesChanged = valuesInherit !== wasValuesInherited
    || (!valuesInherit && JSON.stringify(editedValues) !== JSON.stringify(values_info.values));

  const origSyncAutomated = app.sync_policy?.automated !== null && app.sync_policy?.automated !== undefined;
  const origSyncPrune = app.sync_policy?.automated?.prune ?? false;
  const origSyncSelfHeal = app.sync_policy?.automated?.selfHeal ?? false;
  const origSyncOptions = app.sync_policy?.syncOptions ?? [];
  const isSyncChanged = syncAutomated !== origSyncAutomated
    || syncPrune !== origSyncPrune
    || syncSelfHeal !== origSyncSelfHeal
    || JSON.stringify(syncOptions) !== JSON.stringify(origSyncOptions);

  const hasAnyChange = applied ? false : (isBranchChanged || isValuesChanged || isSyncChanged);

  const handleApplyClick = () => {
    if (!hasAnyChange) return;
    setShowConfirm(true);
  };

  const handleConfirmApply = async () => {
    setShowConfirm(false);
    setUpdating(true);
    setError(null);
    setResult(null);
    setUndoResult(null);

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
        if (valuesInherit) {
          lastResult = await inheritField(scopeFile, app.name, "valuesFiles");
        } else {
          lastResult = await updateValuesFiles(scopeFile, app.name, editedValues);
        }
      }

      if (isSyncChanged) {
        const policy: Record<string, unknown> = {};
        if (syncAutomated) {
          policy.automated = { prune: syncPrune, selfHeal: syncSelfHeal };
        }
        if (syncOptions.length > 0) {
          policy.syncOptions = syncOptions;
        }
        lastResult = await updateSyncPolicy(scopeFile, app.name, Object.keys(policy).length > 0 ? policy : null);
      }

      setResult(lastResult);
      setApplied(true);
      setShowDiff(false);
      setDiffBefore("");
      setDiffAfter("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const handleUndo = async () => {
    setUndoing(true);
    setUndoResult(null);
    try {
      const res = await undoLastChange();
      setUndoResult(res.success ? "Undo successful" : `Undo failed: ${res.message}`);
      if (res.success) { setApplied(false); onUpdated(); }
    } catch (e) {
      setUndoResult(e instanceof Error ? e.message : "Undo failed");
    } finally {
      setUndoing(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setShowRemoveConfirm(false);
    try {
      await removeApp(scopeFile, app.name);
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setRemoving(false);
    }
  };

  const handlePreview = async () => {
    setLoadingDiff(true);
    setDiffError(null);
    try {
      const opts: Parameters<typeof previewDiff>[2] = {};

      if (isBranchChanged) {
        if (selectedBranch === INHERIT_VALUE) {
          opts.branchAction = "inherit";
        } else {
          opts.branchAction = "set";
          opts.branchValue = selectedBranch;
        }
      }

      if (isValuesChanged) {
        if (valuesInherit) {
          opts.valuesAction = "inherit";
        } else {
          opts.valuesAction = "set";
          opts.valuesValue = editedValues.join(",");
        }
      }

      const data = await previewDiff(scopeFile, app.name, opts);
      setDiffBefore(data.before);
      setDiffAfter(data.after);
      setShowDiff(true);
    } catch (e) {
      setDiffError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoadingDiff(false);
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

  const inheritBranchLabel = branch_info.parent_value
    ? `Inherit from parent scope (${branch_info.parent_value})`
    : "Inherit from parent scope";

  const parentValuesLabel = values_info.parent_values
    ? `Inherit from parent (${values_info.parent_values.join(", ")})`
    : "Inherit from parent scope";

  const effectiveValues = valuesInherit
    ? (values_info.parent_values ?? values_info.values)
    : editedValues;

  return (
    <div style={{ ...s.card, ...(hasWarning ? s.cardWarning : {}), opacity: removing ? 0.5 : 1 }}>
      <div style={s.topRow}>
        <div style={s.appName}>
          {app.name}
          {hasWarning && (
            <span style={s.warningBadge}>Branch not found</span>
          )}
        </div>
        <button
          style={s.removeBtn}
          title={`Remove ${app.name}`}
          onClick={() => setShowRemoveConfirm(true)}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--danger)";
            (e.currentTarget as HTMLElement).style.background = "var(--danger-bg)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLElement).style.background = "none";
          }}
        >
          <TrashIcon />
        </button>
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
            onChange={(e) => { setSelectedBranch(e.target.value); setApplied(false); setResult(null); setUndoResult(null); }}
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
              .filter((b) => b !== branch_info.value)
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

      {/* Values files - multi select with chips */}
      <div style={s.fieldGroup}>
        <div style={s.fieldLabel}>
          <FileIcon />
          Values Files
          {valuesInherit && (
            <span style={s.inheritedBadge}>inherited</span>
          )}
        </div>

        {/* Inherit toggle */}
        {values_info.parent_values !== null && (
          <div style={{ marginBottom: 8 }}>
            <button
              style={{
                ...s.inheritBtn,
                ...(valuesInherit ? s.inheritBtnActive : {}),
              }}
              onClick={() => {
                if (!valuesInherit) {
                  setValuesInherit(true);
                  setEditedValues([]);
                } else {
                  setValuesInherit(false);
                  setEditedValues([...values_info.values]);
                }
              }}
            >
              {valuesInherit ? `Inheriting: ${parentValuesLabel}` : parentValuesLabel}
            </button>
          </div>
        )}

        {!valuesInherit && (
          <div style={s.valuesRow}>
            {editedValues.map((vf, idx) => (
              <span key={`${vf}-${idx}`} style={s.chip}>
                {vf}
                <button
                  style={s.chipRemove}
                  onClick={() => removeValue(idx)}
                  title="Remove"
                >
                  &times;
                </button>
              </span>
            ))}
            <select
              style={{ ...s.select, maxWidth: 220, flex: "none", fontSize: 12 }}
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
          </div>
        )}

        {valuesInherit && values_info.defined_at && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            From <span style={s.sourceFile}>{values_info.defined_at}</span>
            {effectiveValues.length > 0 && (
              <span>
                {" "}
                ({effectiveValues.join(", ")})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sync Policy */}
      <div style={{ marginBottom: 10, borderTop: "1px solid var(--border)", paddingTop: 4 }}>
        <div
          style={s.syncHeader}
          onClick={() => setSyncExpanded((v) => !v)}
        >
          <span style={{ ...s.syncChevron, transform: syncExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <SyncIcon />
          Sync Policy
        </div>
        <div
          style={{
            ...s.syncBody,
            maxHeight: syncExpanded ? 300 : 0,
            opacity: syncExpanded ? 1 : 0,
          }}
        >
          <div style={s.syncSubLabel}>Automated</div>
          <label style={s.syncCheckRow}>
            <input
              type="checkbox"
              checked={syncAutomated}
              onChange={(e) => {
                setSyncAutomated(e.target.checked);
                if (!e.target.checked) {
                  setSyncPrune(false);
                  setSyncSelfHeal(false);
                }
              }}
              style={s.syncCheckbox}
            />
            Enabled
          </label>
          {syncAutomated && (
            <>
              <label style={{ ...s.syncCheckRow, paddingLeft: 22 }}>
                <input
                  type="checkbox"
                  checked={syncPrune}
                  onChange={(e) => setSyncPrune(e.target.checked)}
                  style={s.syncCheckbox}
                />
                Prune
              </label>
              <label style={{ ...s.syncCheckRow, paddingLeft: 22 }}>
                <input
                  type="checkbox"
                  checked={syncSelfHeal}
                  onChange={(e) => setSyncSelfHeal(e.target.checked)}
                  style={s.syncCheckbox}
                />
                Self Heal
              </label>
            </>
          )}

          <div style={s.syncSubLabel}>Sync Options</div>
          <div style={s.valuesRow}>
            {syncOptions.map((opt, idx) => (
              <span key={`${opt}-${idx}`} style={s.chip}>
                {opt}
                <button
                  style={s.chipRemove}
                  onClick={() => setSyncOptions((prev) => prev.filter((_, i) => i !== idx))}
                >
                  &times;
                </button>
              </span>
            ))}
            <select
              style={{ ...s.select, maxWidth: 220, flex: "none", fontSize: 12 }}
              value=""
              onChange={(e) => {
                if (e.target.value && !syncOptions.includes(e.target.value)) {
                  setSyncOptions((prev) => [...prev, e.target.value]);
                }
              }}
            >
              <option value="">+ Add option...</option>
              {SYNC_OPTION_PRESETS
                .filter((o) => !syncOptions.includes(o))
                .map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
            </select>
          </div>

        </div>
      </div>

      {/* Apply / Preview buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          style={{
            ...s.applyBtn,
            ...(!hasAnyChange || updating ? s.applyBtnDisabled : {}),
          }}
          disabled={!hasAnyChange || updating}
          onClick={handleApplyClick}
          onMouseEnter={(e) => {
            if (hasAnyChange && !updating)
              (e.currentTarget as HTMLElement).style.background = "var(--accent-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--accent)";
          }}
        >
          {updating ? "Applying..." : "Apply Changes"}
        </button>
        {hasAnyChange && (
          <button
            style={s.previewBtn}
            onClick={handlePreview}
            disabled={loadingDiff}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background = "var(--accent-muted)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = "transparent")
            }
          >
            {loadingDiff ? "Loading..." : "Preview"}
          </button>
        )}
        {hasAnyChange && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {[
              isBranchChanged &&
                (selectedBranch === INHERIT_VALUE
                  ? "branch: inherit"
                  : `branch: ${selectedBranch}`),
              isValuesChanged &&
                (valuesInherit
                  ? "values: inherit"
                  : `values: [${editedValues.join(", ")}]`),
              isSyncChanged && "sync policy",
            ]
              .filter(Boolean)
              .join(", ")}
          </span>
        )}
      </div>
      {diffError && (
        <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>
          {diffError}
        </div>
      )}

      {result && (
        <div style={{ ...s.successMsg, display: "flex", alignItems: "center", flexWrap: "wrap" as const, gap: 4 }}>
          <span>Updated successfully.</span>
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
          <button
            style={s.undoBtn}
            onClick={handleUndo}
            disabled={undoing}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--warning-bg)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            {undoing ? "Undoing..." : "Undo"}
          </button>
          <button
            style={{ ...s.undoBtn, color: "var(--accent)" }}
            onClick={() => { setResult(null); setApplied(false); onUpdated(); }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--accent-muted)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            Refresh
          </button>
          {undoResult && (
            <span style={{ fontSize: 11, color: undoResult.startsWith("Undo successful") ? "var(--success)" : "var(--danger)" }}>
              {undoResult}
            </span>
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

      {showConfirm && (
        <div
          style={s.confirmOverlay}
          onClick={(e) => e.target === e.currentTarget && setShowConfirm(false)}
        >
          <div style={s.confirmModal}>
            <div style={s.confirmTitle}>Are you sure you want to apply these changes?</div>
            <div style={s.confirmSummary}>
              <strong>{app.name}</strong>
              {isBranchChanged && (
                <div>
                  Branch: {selectedBranch === INHERIT_VALUE ? "inherit from parent" : selectedBranch}
                </div>
              )}
              {isValuesChanged && (
                <div>
                  Values: {valuesInherit ? "inherit from parent" : `[${editedValues.join(", ")}]`}
                </div>
              )}
            </div>
            <div style={s.confirmActions}>
              <button
                style={s.cancelBtn}
                onClick={() => setShowConfirm(false)}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
              >
                Cancel
              </button>
              <button
                style={s.confirmBtn}
                onClick={handleConfirmApply}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--accent-hover)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--accent)")}
              >
                Confirm & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {showRemoveConfirm && (
        <div
          style={s.confirmOverlay}
          onClick={(e) => e.target === e.currentTarget && setShowRemoveConfirm(false)}
        >
          <div style={s.confirmModal}>
            <div style={s.confirmTitle}>Remove {app.name} from this scope?</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 18 }}>
              This will remove the app definition from <span style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{scopeFile}</span>.
            </div>
            <div style={s.confirmActions}>
              <button
                style={s.cancelBtn}
                onClick={() => setShowRemoveConfirm(false)}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
              >
                Cancel
              </button>
              <button
                style={{ ...s.confirmBtn, background: "var(--danger)" }}
                onClick={handleRemove}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#dc2626")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--danger)")}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {showDiff && (
        <div
          style={s.diffOverlay}
          onClick={(e) => e.target === e.currentTarget && setShowDiff(false)}
        >
          <div style={s.diffModal}>
            <div style={s.diffHeader}>
              <span style={s.diffTitle}>Diff Preview — {app.name}</span>
              <button
                style={s.diffCloseBtn}
                onClick={() => setShowDiff(false)}
              >
                &times;
              </button>
            </div>
            <div style={s.diffBody}>
              <div style={{ ...s.diffPane, ...s.diffPaneBefore }}>
                <span style={s.diffPaneLabel}>Before</span>
                {diffBefore.split("\n").map((line, i) => (
                  <span
                    key={i}
                    style={
                      diffAfter.split("\n")[i] !== line
                        ? s.diffLineRemoved
                        : s.diffLineNormal
                    }
                  >
                    {line || "\u00A0"}
                  </span>
                ))}
              </div>
              <div style={{ ...s.diffPane, ...s.diffPaneAfter }}>
                <span style={s.diffPaneLabel}>After</span>
                {diffAfter.split("\n").map((line, i) => (
                  <span
                    key={i}
                    style={
                      diffBefore.split("\n")[i] !== line
                        ? s.diffLineAdded
                        : s.diffLineNormal
                    }
                  >
                    {line || "\u00A0"}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
