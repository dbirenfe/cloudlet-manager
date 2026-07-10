import { type CSSProperties, useEffect, useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import AppsPanel from "./components/AppsPanel";
import AuditPanel from "./components/AuditPanel";
import BulkUpdatePanel from "./components/BulkUpdatePanel";
import type { RepoStructure, UserInfo } from "./api/client";
import { fetchStructure, fetchMe } from "./api/client";

const bulkBtnStyle: CSSProperties = {
  position: "fixed",
  bottom: 24,
  right: 24,
  padding: "10px 20px",
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius-lg)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "var(--shadow)",
  zIndex: 50,
  transition: "background 0.15s",
};

export default function App() {
  const [structure, setStructure] = useState<RepoStructure | null>(null);
  const [selectedFlavor, setSelectedFlavor] = useState<string | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"clusters" | "audit">("clusters");
  const [showBulk, setShowBulk] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetchStructure()
      .then(setStructure)
      .catch((e) => setError(e.message));
    fetchMe().then(setUser).catch(() => {});
  }, []);

  const handleSelect = (
    flavor: string | null,
    env: string | null,
    cluster: string | null
  ) => {
    setSelectedFlavor(flavor);
    setSelectedEnv(env);
    setSelectedCluster(cluster);
    setActiveView("clusters");
  };

  return (
    <>
      <Header
        activeView={activeView}
        onViewChange={setActiveView}
        onSearchNavigate={handleSelect}
        username={user?.username}
      />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {activeView === "clusters" && (
          <Sidebar
            structure={structure}
            selectedFlavor={selectedFlavor}
            selectedEnv={selectedEnv}
            selectedCluster={selectedCluster}
            onSelect={handleSelect}
          />
        )}
        {error && activeView === "clusters" ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--danger)",
              padding: 40,
              fontSize: 15,
            }}
          >
            Failed to load: {error}
          </div>
        ) : activeView === "audit" ? (
          <AuditPanel />
        ) : (
          <AppsPanel
            flavor={selectedFlavor}
            env={selectedEnv}
            cluster={selectedCluster}
            onNavigate={handleSelect}
          />
        )}
      </div>

      {activeView === "clusters" && (
        <button
          style={bulkBtnStyle}
          onClick={() => setShowBulk(true)}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.background = "var(--accent-hover)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.background = "var(--accent)")
          }
        >
          Bulk Update
        </button>
      )}

      {showBulk && (
        <BulkUpdatePanel
          structure={structure}
          onClose={() => setShowBulk(false)}
        />
      )}
    </>
  );
}
