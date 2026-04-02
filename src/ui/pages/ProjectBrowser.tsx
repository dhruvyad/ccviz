import { useState, useEffect } from "react";
import FolderTree from "../components/FolderTree.js";
import ConversationList from "../components/ConversationList.js";

export default function ProjectBrowser() {
  const [tree, setTree] = useState<any[]>([]);
  const [selected, setSelected] = useState<{
    encoded: string;
    decoded: string;
  } | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingConvos, setLoadingConvos] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setTree(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSelect = async (encoded: string, decoded: string) => {
    setSelected({ encoded, decoded });
    setLoadingConvos(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(encoded)}/conversations`
      );
      const data = await res.json();
      setConversations(data);
    } catch {
      setConversations([]);
    }
    setLoadingConvos(false);
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-800 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-bold text-gray-100">ccviz</h1>
          <p className="text-xs text-gray-500 mt-1">
            Claude Code Conversation Visualizer
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-gray-500 text-sm p-4">Loading projects...</p>
          ) : tree.length === 0 ? (
            <p className="text-gray-500 text-sm p-4">No projects found.</p>
          ) : (
            <FolderTree
              tree={tree}
              onSelect={handleSelect}
              selected={selected?.encoded ?? null}
            />
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Select a project to browse conversations</p>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-100">
                {selected.decoded.split("/").pop()}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{selected.decoded}</p>
            </div>
            {loadingConvos ? (
              <p className="text-gray-500">Loading conversations...</p>
            ) : (
              <ConversationList
                conversations={conversations}
                projectEncoded={selected.encoded}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
