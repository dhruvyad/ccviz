import { Router } from "express";
import fs from "fs/promises";
import path from "path";

export function createProjectsRouter(claudeDir: string) {
  const router = Router();

  // GET /api/projects — list project folders
  router.get("/", async (_req, res) => {
    try {
      const projectsDir = path.join(claudeDir, "projects");
      const entries = await fs.readdir(projectsDir, { withFileTypes: true });
      const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name);

      // Decode folder names: leading - and internal - become /
      const projects = await Promise.all(
        folders.map(async (encoded) => {
          const decoded = await decodePath(encoded);
          const projectDir = path.join(projectsDir, encoded);
          const files = await fs.readdir(projectDir);
          const conversationCount = files.filter((f) =>
            f.endsWith(".jsonl")
          ).length;
          return { encoded, decoded, conversationCount };
        })
      );

      // Build hierarchical tree
      const tree = buildTree(projects);
      res.json(tree);
    } catch (err) {
      res.status(500).json({ error: "Failed to read projects directory" });
    }
  });

  return router;
}

async function decodePath(encoded: string): Promise<string> {
  // Encoded path: -Users-dhruvyadav-Documents-code-case-details
  // Dashes replace /, but directory names can also contain dashes.
  // Resolve by trying all possible splits and checking the filesystem
  // for the FULL path (not intermediate segments, to avoid greedy mismatches).
  const raw = encoded.slice(1); // remove leading -
  const segments = raw.split("-");

  // Try to find a valid filesystem path using dynamic programming.
  // For each position, find all valid next segments (single or multi-dash-joined)
  // that form a real directory component.
  const result = await resolveSegments(segments, 0, []);
  if (result) return "/" + result.join("/");

  // Fallback: naive decode
  return "/" + raw.replace(/-/g, "/");
}

async function resolveSegments(
  segments: string[],
  start: number,
  resolved: string[]
): Promise<string[] | null> {
  if (start >= segments.length) return resolved;

  // Try longest candidate first (prefer fewer, longer path components)
  for (let end = segments.length; end > start; end--) {
    const candidate = segments.slice(start, end).join("-");
    const testPath = "/" + [...resolved, candidate].join("/");
    try {
      const stat = await fs.stat(testPath);
      if (stat.isDirectory()) {
        const result = await resolveSegments(segments, end, [
          ...resolved,
          candidate,
        ]);
        if (result) return result;
      }
    } catch {
      // doesn't exist
    }
  }

  return null;
}

interface ProjectEntry {
  encoded: string;
  decoded: string;
  conversationCount: number;
}

interface TreeNode {
  name: string;
  fullPath?: string;
  encoded?: string;
  conversationCount?: number;
  children: TreeNode[];
}

function buildTree(projects: ProjectEntry[]): TreeNode[] {
  const root: TreeNode = { name: "", children: [] };

  for (const project of projects) {
    const parts = project.decoded.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, children: [] };
        current.children.push(child);
      }
      if (i === parts.length - 1) {
        child.fullPath = project.decoded;
        child.encoded = project.encoded;
        child.conversationCount = project.conversationCount;
      }
      current = child;
    }
  }

  return root.children;
}
