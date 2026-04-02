#!/usr/bin/env node
import { Command } from "commander";
import { createServer } from "./server/index.js";
import { parseConversation } from "./server/parser/index.js";
import open from "open";
import path from "path";
import fs from "fs/promises";

const program = new Command();

program
  .name("ccviz")
  .description("Visualize Claude Code conversations")
  .version("0.1.0")
  .option("-p, --port <number>", "server port", "3333")
  .option(
    "-d, --claude-dir <path>",
    "path to .claude directory",
    `${process.env.HOME}/.claude`
  )
  .option("--no-open", "don't open browser automatically")
  .option("--dev", "development mode (proxy to Vite dev server)")
  .option("--json <path>", "output parsed conversation as JSON (no server)")
  .option(
    "--conversation <project/session>",
    "open directly to a specific conversation"
  )
  .action(async (opts) => {
    const claudeDir = opts.claudeDir;

    // JSON mode — parse and dump, no server
    if (opts.json) {
      const jsonlPath = path.resolve(opts.json);
      const sessionId = path.basename(jsonlPath, ".jsonl");
      try {
        await fs.access(jsonlPath);
      } catch {
        console.error(`File not found: ${jsonlPath}`);
        process.exit(1);
      }
      const parsed = await parseConversation(jsonlPath, sessionId);
      console.log(JSON.stringify(parsed, null, 2));
      return;
    }

    const port = parseInt(opts.port, 10);
    const isDev = opts.dev ?? false;

    const app = createServer({ claudeDir, isDev });

    app.listen(port, () => {
      let url = `http://localhost:${port}`;
      if (opts.conversation) {
        url += `/conversation/${opts.conversation}`;
      }
      console.log(`ccviz running at ${url}`);
      if (opts.open) {
        open(url);
      }
    });
  });

program.parse();
