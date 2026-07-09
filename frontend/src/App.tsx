import { useEffect, useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import AppsPanel from "./components/AppsPanel";
import type { RepoStructure } from "./api/client";
import { fetchStructure } from "./api/client";

export default function App() {
  const [structure, setStructure] = useState<RepoStructure | null>(null);
  const [selectedFlavor, setSelectedFlavor] = useState<string | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStructure()
      .then(setStructure)
      .catch((e) => setError(e.message));
  }, []);

  const handleSelect = (
    flavor: string | null,
    env: string | null,
    cluster: string | null
  ) => {
    setSelectedFlavor(flavor);
    setSelectedEnv(env);
    setSelectedCluster(cluster);
  };

  return (
    <>
      <Header />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar
          structure={structure}
          selectedFlavor={selectedFlavor}
          selectedEnv={selectedEnv}
          selectedCluster={selectedCluster}
          onSelect={handleSelect}
        />
        {error ? (
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
        ) : (
          <AppsPanel
            flavor={selectedFlavor}
            env={selectedEnv}
            cluster={selectedCluster}
          />
        )}
      </div>
    </>
  );
}
