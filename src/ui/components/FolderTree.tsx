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
    <div className="text-sm">
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
      <button
        onClick={() => {
          if (isLeaf) {
            onSelect(node.encoded!, node.fullPath!);
          } else {
            setExpanded(!expanded);
          }
        }}
        className={`flex items-center gap-1.5 w-full px-2 py-1 rounded text-left hover:bg-gray-800 transition-colors ${
          isSelected ? "bg-gray-800 text-blue-400" : "text-gray-300"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className="text-gray-500 w-4 text-center flex-shrink-0">
          {hasChildren ? (expanded ? "▾" : "▸") : isLeaf ? "◆" : "·"}
        </span>
        <span className="truncate">{node.name}</span>
        {isLeaf && node.conversationCount != null && (
          <span className="ml-auto text-xs text-gray-500 flex-shrink-0">
            {node.conversationCount}
          </span>
        )}
      </button>
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
