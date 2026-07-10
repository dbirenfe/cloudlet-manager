import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import type { SearchResult, SearchField } from "../api/client";
import { searchApps } from "../api/client";

interface HeaderProps {
  activeView: "clusters" | "audit";
  onViewChange: (view: "clusters" | "audit") => void;
  onSearchNavigate?: (flavor: string, env: string, cluster: string) => void;
}

const styles: Record<string, CSSProperties> = {
  header: {
    background: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border)",
    padding: "0 32px",
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "linear-gradient(135deg, var(--accent), #a78bfa)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 16,
    color: "#fff",
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  subtitle: {
    fontSize: 12,
    color: "var(--text-muted)",
    marginLeft: 8,
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginLeft: 32,
  },
  navBtn: {
    padding: "6px 14px",
    borderRadius: "var(--radius)",
    border: "none",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  navBtnActive: {
    background: "var(--accent-muted)",
    color: "var(--accent-hover)",
    fontWeight: 600,
  },
  center: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    maxWidth: 480,
    margin: "0 24px",
    position: "relative",
  },
  searchWrap: {
    position: "relative",
    width: "100%",
  },
  searchInput: {
    width: "100%",
    padding: "8px 12px 8px 36px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
    transition: "border-color 0.15s",
  },
  searchIcon: {
    position: "absolute",
    left: 10,
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--text-muted)",
    pointerEvents: "none" as const,
    display: "flex",
    alignItems: "center",
  },
  fieldTabs: {
    display: "flex",
    gap: 2,
    padding: "8px 12px 4px",
    borderBottom: "1px solid var(--border)",
  },
  fieldTab: {
    padding: "4px 10px",
    borderRadius: 6,
    border: "none",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.12s",
  },
  fieldTabActive: {
    background: "var(--accent-muted)",
    color: "var(--accent-hover)",
    fontWeight: 600,
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow)",
    maxHeight: 380,
    overflowY: "auto",
    zIndex: 200,
  },
  resultItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    cursor: "pointer",
    transition: "background 0.1s",
    borderBottom: "1px solid var(--border)",
  },
  resultApp: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  resultValue: {
    fontSize: 12,
    color: "var(--accent)",
    fontFamily: "monospace",
  },
  resultMeta: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginLeft: "auto",
  },
  resultPath: {
    fontSize: 11,
    color: "var(--text-muted)",
    fontFamily: "monospace",
  },
  noResults: {
    padding: 20,
    textAlign: "center" as const,
    color: "var(--text-muted)",
    fontSize: 13,
  },
  searchError: {
    padding: "10px 14px",
    color: "var(--danger)",
    fontSize: 12,
  },
};

const FIELD_OPTIONS: { key: SearchField; label: string }[] = [
  { key: "branch", label: "Branch" },
  { key: "values", label: "Values" },
  { key: "missing", label: "Missing" },
];

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export default function Header({ activeView, onViewChange, onSearchNavigate }: HeaderProps) {
  const [query, setQuery] = useState("");
  const [field, setField] = useState<SearchField>("branch");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(
    async (q: string, f: SearchField) => {
      if (!q.trim()) {
        setResults([]);
        setShowDropdown(false);
        return;
      }
      setSearching(true);
      setSearchError(null);
      try {
        const data = await searchApps(q.trim(), f);
        setResults(data.results);
        setShowDropdown(true);
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : "Search failed");
        setShowDropdown(true);
      } finally {
        setSearching(false);
      }
    },
    []
  );

  const scheduleSearch = useCallback(
    (q: string, f: SearchField) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(q, f), 350);
    },
    [doSearch]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doSearch(query, field);
    }
    if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setShowDropdown(false);
    onSearchNavigate?.(result.flavor, result.env, result.cluster);
  };

  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <div style={styles.logo}>C</div>
        <span style={styles.title}>Cloudlet Manager</span>
        <span style={styles.subtitle}>GitOps Branch Dashboard</span>
        <div style={styles.nav}>
          <button
            style={{
              ...styles.navBtn,
              ...(activeView === "clusters" ? styles.navBtnActive : {}),
            }}
            onClick={() => onViewChange("clusters")}
          >
            Clusters
          </button>
          <button
            style={{
              ...styles.navBtn,
              ...(activeView === "audit" ? styles.navBtnActive : {}),
            }}
            onClick={() => onViewChange("audit")}
          >
            Audit Log
          </button>
        </div>
      </div>

      <div style={styles.center} ref={wrapRef}>
        <div style={styles.searchWrap}>
          <div style={styles.searchIcon}>
            <SearchIcon />
          </div>
          <input
            style={styles.searchInput}
            placeholder="Search apps, branches, values..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              scheduleSearch(e.target.value, field);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0 || searchError) setShowDropdown(true);
            }}
          />

          {showDropdown && (
            <div style={styles.dropdown}>
              <div style={styles.fieldTabs}>
                {FIELD_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    style={{
                      ...styles.fieldTab,
                      ...(field === opt.key ? styles.fieldTabActive : {}),
                    }}
                    onClick={() => {
                      setField(opt.key);
                      doSearch(query, opt.key);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {searching && (
                <div style={styles.noResults}>Searching...</div>
              )}

              {searchError && (
                <div style={styles.searchError}>{searchError}</div>
              )}

              {!searching && !searchError && results.length === 0 && query.trim() && (
                <div style={styles.noResults}>No results found</div>
              )}

              {!searching &&
                results.map((r, i) => (
                  <div
                    key={`${r.app_name}-${r.file_path}-${i}`}
                    style={styles.resultItem}
                    onClick={() => handleResultClick(r)}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "var(--bg-hover)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "transparent")
                    }
                  >
                    <div>
                      <div style={styles.resultApp}>{r.app_name}</div>
                      <div style={styles.resultPath}>{r.file_path}</div>
                    </div>
                    <span style={styles.resultValue}>{r.value}</span>
                    <span style={styles.resultMeta}>
                      {r.flavor}/{r.env}/{r.cluster}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
