import { useState } from "react";

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
    <div className="bg-term-bg border-t border-term-border p-4 space-y-3 font-mono">
      <div>
        <h4 className="text-[10px] text-term-green mb-1.5">INPUT</h4>
        <pre className="text-[11px] text-term-text bg-term-surface border border-term-border p-3 overflow-x-auto max-h-64 overflow-y-auto">
          {JSON.stringify(toolCall.input, null, 2)}
        </pre>
      </div>

      <div>
        <h4 className="text-[10px] text-term-green mb-1.5">
          RESULT{" "}
          <span className="text-term-text-dim">
            ({formatBytes(toolCall.result.sizeBytes)})
          </span>
        </h4>

        {isPersisted && !persistedContent ? (
          <div>
            <p className="text-[11px] text-term-text-dim mb-1.5">
              persisted: {toolCall.result.persistedPath}
            </p>
            <button
              onClick={loadPersistedResult}
              disabled={loadingPersisted}
              className="text-[11px] text-term-blue hover:text-term-cyan"
            >
              {loadingPersisted ? "loading..." : "[load]"}
            </button>
          </div>
        ) : (
          <>
            <pre className="text-[11px] text-term-text bg-term-surface border border-term-border p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
              {showFullResult || !isLarge
                ? persistedContent ?? resultContent
                : resultContent.slice(0, 2000) + "\n..."}
            </pre>
            {isLarge && !showFullResult && (
              <button
                onClick={() => setShowFullResult(true)}
                className="text-[11px] text-term-blue hover:text-term-cyan mt-1"
              >
                [show full — {formatBytes(toolCall.result.sizeBytes)}]
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
