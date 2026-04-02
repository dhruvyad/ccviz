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
          const decoded = decodePath(encoded);
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

function decodePath(encoded: string): string {
  // Encoded path: -Users-dhruv-Documents-code-noclick
  // Decoded: /Users/dhruv/Documents/code/noclick
  return "/" + encoded.slice(1).replace(/-/g, "/");
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
