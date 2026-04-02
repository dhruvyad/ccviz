import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { createReadStream } from "fs";
import readline from "readline";

export function createRecentRouter(claudeDir: string) {
  const router = Router();

  // GET /api/recent — most recent conversations across all projects
  router.get("/", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const projectsDir = path.join(claudeDir, "projects");
      const projectFolders = await fs.readdir(projectsDir, {
        withFileTypes: true,
      });

      const all: any[] = [];

      for (const folder of projectFolders) {
        if (!folder.isDirectory()) continue;
        const projectDir = path.join(projectsDir, folder.name);
        let files: string[];
        try {
          files = await fs.readdir(projectDir);
        } catch {
          continue;
        }
        const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

        for (const file of jsonlFiles) {
          const filePath = path.join(projectDir, file);
          try {
            const stat = await fs.stat(filePath);
            all.push({
              sessionId: file.replace(".jsonl", ""),
              projectEncoded: folder.name,
              filePath,
              sizeBytes: stat.size,
              lastModified: stat.mtime.toISOString(),
              mtimeMs: stat.mtimeMs,
            });
          } catch {
            // skip
          }
        }
      }

      // Sort by mtime, take top N, then quick-scan those
      all.sort((a, b) => b.mtimeMs - a.mtimeMs);
      const top = all.slice(0, limit);

      const results = await Promise.all(
        top.map(async (entry) => {
          const summary = await quickScan(entry.filePath);
          return {
            sessionId: entry.sessionId,
            projectEncoded: entry.projectEncoded,
            sizeBytes: entry.sizeBytes,
            lastModified: entry.lastModified,
            ...summary,
          };
        })
      );

      res.json(results);
    } catch {
      res.status(500).json({ error: "Failed to list recent conversations" });
    }
  });

  return router;
}

export function createConversationsRouter(claudeDir: string) {
  const router = Router();

  // GET /api/projects/:encodedPath/conversations
  router.get("/:encodedPath/conversations", async (req, res) => {
    try {
      const projectDir = path.join(
        claudeDir,
        "projects",
        req.params.encodedPath
      );
      const files = await fs.readdir(projectDir);
      const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

      const conversations = await Promise.all(
        jsonlFiles.map(async (file) => {
          const filePath = path.join(projectDir, file);
          const sessionId = file.replace(".jsonl", "");
          const stat = await fs.stat(filePath);
          const summary = await quickScan(filePath);

          return {
            sessionId,
            filePath,
            sizeBytes: stat.size,
            lastModified: stat.mtime.toISOString(),
            ...summary,
          };
        })
      );

      // Sort by last modified, most recent first
      conversations.sort(
        (a, b) =>
          new Date(b.lastModified).getTime() -
          new Date(a.lastModified).getTime()
      );

      res.json(conversations);
    } catch (err) {
      res.status(500).json({ error: "Failed to list conversations" });
    }
  });

  return router;
}

interface QuickSummary {
  title: string | null;
  agentName: string | null;
  model: string | null;
  startedAt: string | null;
  lastTimestamp: string | null;
  lineCount: number;
}

async function quickScan(filePath: string): Promise<QuickSummary> {
  const summary: QuickSummary = {
    title: null,
    agentName: null,
    model: null,
    startedAt: null,
    lastTimestamp: null,
    lineCount: 0,
  };

  const stream = createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    summary.lineCount++;
    if (!line.trim()) continue;

    try {
      const msg = JSON.parse(line);

      // Capture first timestamp as startedAt
      if (!summary.startedAt && msg.timestamp) {
        summary.startedAt = msg.timestamp;
      }

      // Track last timestamp
      if (msg.timestamp) {
        summary.lastTimestamp = msg.timestamp;
      }

      // Grab title
      if (msg.type === "custom-title" && msg.title) {
        summary.title = msg.title;
      }

      // Grab agent name
      if (msg.type === "agent-name" && msg.agentName) {
        summary.agentName = msg.agentName;
      }

      // Grab model from first assistant message
      if (!summary.model && msg.type === "assistant" && msg.message?.model) {
        summary.model = msg.message.model;
      }
    } catch {
      // Skip malformed lines
    }
  }

  return summary;
}
