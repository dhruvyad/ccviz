import { useState } from "react";

interface TreeNode {
  name: string;
  fullPath?: string;
  encoded?: string;
  conversationCount?: number;
  children: TreeNode[];
}

interface FolderTreeProps {
  tree: TreeNode[];
  onSelect: (encoded: string, decoded: string) => void;
  selected: string | null;
}

export default function FolderTree({
  tree,
  onSelect,
  selected,
}: FolderTreeProps) {
  return (
    <div className="text-xs">
      {tree.map((node) => (
        <TreeItem
          key={node.name}
          node={node}
          depth={0}
          onSelect={onSelect}
          selected={selected}
        />
      ))}
    </div>
  );
}

function TreeItem({
  node,
  depth,
  onSelect,
  selected,
}: {
  node: TreeNode;
  depth: number;
  onSelect: (encoded: string, decoded: string) => void;
  selected: string | null;
}) {
  const [expanded, setExpanded] = useState(depth < 3);
  const hasChildren = node.children.length > 0;
  const isLeaf = !!node.encoded;
  const isSelected = node.encoded === selected;

  return (
    <div>
      <div
        className={`flex items-center gap-1 w-full px-1.5 py-0.5 font-mono transition-colors ${
          isSelected
            ? "bg-term-green/10 text-term-green"
            : "text-term-text-dim hover:text-term-text hover:bg-term-surface"
        }`}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-3 text-center flex-shrink-0 text-term-text-dim hover:text-term-text"
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-3 text-center flex-shrink-0 text-term-text-dim">
            {isLeaf ? "~" : "·"}
          </span>
        )}
        <button
          onClick={() => {
            if (isLeaf) {
              onSelect(node.encoded!, node.fullPath!);
            } else {
              setExpanded(!expanded);
            }
          }}
          className="truncate text-left flex-1"
        >
          {node.name}
        </button>
        {isLeaf && node.conversationCount != null && node.conversationCount > 0 && (
          <span
            className={`ml-auto flex-shrink-0 cursor-pointer ${
              isSelected ? "text-term-green/60" : "text-term-text-dim"
            }`}
            onClick={() => onSelect(node.encoded!, node.fullPath!)}
          >
            {node.conversationCount}
          </span>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.name}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selected={selected}
            />
          ))}
        </div>
      )}
    </div>
  );
}
