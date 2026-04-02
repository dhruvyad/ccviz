import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createProjectsRouter } from "./api/projects.js";
import { createConversationsRouter } from "./api/conversations.js";
import { createConversationRouter } from "./api/conversation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ServerOptions {
  claudeDir: string;
  isDev: boolean;
}

export function createServer({ claudeDir, isDev }: ServerOptions) {
  const app = express();

  // API routes
  app.use("/api/projects", createProjectsRouter(claudeDir));
  app.use("/api/projects", createConversationsRouter(claudeDir));
  app.use("/api/conversations", createConversationRouter(claudeDir));

  // Serve static UI files in production
  if (!isDev) {
    const uiDir = path.join(__dirname, "ui");
    app.use(express.static(uiDir));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(uiDir, "index.html"));
    });
  }

  return app;
}
