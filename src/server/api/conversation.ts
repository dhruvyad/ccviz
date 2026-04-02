import { Router } from "express";
import path from "path";
import fs from "fs/promises";
import { parseConversation } from "../parser/index.js";

export function createConversationRouter(claudeDir: string) {
  const router = Router();

  // Simple LRU cache
  const cache = new Map<string, { mtime: number; data: any }>();
  const MAX_CACHE = 20;

  // GET /api/conversations/:projectPath/:sessionId
  router.get("/:projectPath/:sessionId", async (req, res) => {
    try {
      const filePath = path.join(
        claudeDir,
        "projects",
        req.params.projectPath,
        `${req.params.sessionId}.jsonl`
      );

      const stat = await fs.stat(filePath);
      const cacheKey = filePath;
      const cached = cache.get(cacheKey);

      if (cached && cached.mtime === stat.mtimeMs) {
        res.json(cached.data);
        return;
      }

      const parsed = await parseConversation(filePath, req.params.sessionId);

      // LRU eviction
      if (cache.size >= MAX_CACHE) {
        const oldest = cache.keys().next().value!;
        cache.delete(oldest);
      }
      cache.set(cacheKey, { mtime: stat.mtimeMs, data: parsed });

      res.json(parsed);
    } catch (err) {
      res.status(500).json({ error: "Failed to parse conversation" });
    }
  });

  // GET /api/conversations/:projectPath/:sessionId/tool-result/:toolUseId
  router.get(
    "/:projectPath/:sessionId/tool-result/:toolUseId",
    async (req, res) => {
      try {
        const resultPath = path.join(
          claudeDir,
          "projects",
          req.params.projectPath,
          req.params.sessionId,
          "tool-results",
          `${req.params.toolUseId}.txt`
        );

        const content = await fs.readFile(resultPath, "utf-8");
        res.type("text/plain").send(content);
      } catch {
        res.status(404).json({ error: "Tool result not found" });
      }
    }
  );

  return router;
}
