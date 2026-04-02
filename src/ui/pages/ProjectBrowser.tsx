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
    <div className="flex h-screen bg-term-bg">
      {/* Sidebar */}
      <div className="w-64 border-r border-term-border flex flex-col flex-shrink-0">
        <div className="px-3 py-3 border-b border-term-border">
          <h1 className="text-sm text-term-green term-glow font-bold tracking-wider">
            ccviz
          </h1>
          <p className="text-[10px] text-term-text-dim mt-0.5">
            conversation visualizer
          </p>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {loading ? (
            <p className="text-term-text-dim text-xs p-3 font-mono">
              loading...
            </p>
          ) : tree.length === 0 ? (
            <p className="text-term-text-dim text-xs p-3 font-mono">
              no projects found
            </p>
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
      <div className="flex-1 overflow-y-auto p-5">
        {!selected ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-term-text-dim text-xs font-mono">
                select a project to browse conversations
              </p>
              <p className="text-term-text-dim text-[10px] font-mono mt-1">
                ~/. claude/projects/
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <h2 className="text-sm text-term-text-bright font-mono">
                <span className="text-term-green">~/</span>
                {selected.decoded}
              </h2>
              <p className="text-[10px] text-term-text-dim mt-1">
                {conversations.length} conversation
                {conversations.length !== 1 ? "s" : ""}
              </p>
            </div>
            {loadingConvos ? (
              <p className="text-term-text-dim text-xs font-mono">
                loading...
              </p>
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
