import { useState, useEffect } from "react";

interface ToolCallDetailProps {
  toolCall: {
    id: string;
    name: string;
    input: Record<string, any>;
    result: {
      content: string;
      sizeBytes: number;
      persistedPath: string | null;
    };
  };
  projectPath: string;
  sessionId: string;
}

export default function ToolCallDetail({
  toolCall,
  projectPath,
  sessionId,
}: ToolCallDetailProps) {
  const [showFullResult, setShowFullResult] = useState(false);
  const [persistedContent, setPersistedContent] = useState<string | null>(null);
  const [loadingPersisted, setLoadingPersisted] = useState(false);

  const resultContent = toolCall.result.content;
  const isLarge = resultContent.length > 2000;
  const isPersisted = !!toolCall.result.persistedPath;

  const loadPersistedResult = async () => {
    setLoadingPersisted(true);
    try {
      const res = await fetch(
        `/api/conversations/${encodeURIComponent(projectPath)}/${sessionId}/tool-result/${toolCall.id}`
      );
      if (res.ok) {
        setPersistedContent(await res.text());
      }
    } catch {
      // ignore
    }
    setLoadingPersisted(false);
  };

  return (
    <div className="bg-gray-900/80 border-t border-gray-800 p-4 space-y-4">
      {/* Input */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 mb-2">INPUT</h4>
        <pre className="text-xs text-gray-300 bg-gray-950 rounded p-3 overflow-x-auto max-h-64 overflow-y-auto">
          {JSON.stringify(toolCall.input, null, 2)}
        </pre>
      </div>

      {/* Result */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 mb-2">
          RESULT{" "}
          <span className="text-gray-600 font-normal">
            ({formatBytes(toolCall.result.sizeBytes)})
          </span>
        </h4>

        {isPersisted && !persistedContent ? (
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Result persisted to disk: {toolCall.result.persistedPath}
            </p>
            <button
              onClick={loadPersistedResult}
              disabled={loadingPersisted}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {loadingPersisted ? "Loading..." : "Load full result"}
            </button>
          </div>
        ) : (
          <>
            <pre className="text-xs text-gray-300 bg-gray-950 rounded p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
              {showFullResult || !isLarge
                ? persistedContent ?? resultContent
                : resultContent.slice(0, 2000) + "\n..."}
            </pre>
            {isLarge && !showFullResult && (
              <button
                onClick={() => setShowFullResult(true)}
                className="text-xs text-blue-400 hover:text-blue-300 mt-1"
              >
                Show full result ({formatBytes(toolCall.result.sizeBytes)})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
