#!/usr/bin/env node
import { Command } from "commander";
import { createServer } from "./server/index.js";
import open from "open";

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
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    const claudeDir = opts.claudeDir;
    const isDev = opts.dev ?? false;

    const app = createServer({ claudeDir, isDev });

    app.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`ccviz running at ${url}`);
      if (opts.open) {
        open(url);
      }
    });
  });

program.parse();
