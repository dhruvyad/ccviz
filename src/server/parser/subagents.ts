import fs from "fs/promises";
import path from "path";
import { parseConversation } from "./index.js";
import type { SubagentSummary } from "./types.js";

export async function parseSubagents(
  sessionDir: string
): Promise<SubagentSummary[]> {
  const subagentsDir = path.join(sessionDir, "subagents");

  try {
    await fs.access(subagentsDir);
  } catch {
    return [];
  }

  const files = await fs.readdir(subagentsDir);
  const agentFiles = files.filter(
    (f) => f.startsWith("agent-") && f.endsWith(".jsonl")
  );

  const subagents: SubagentSummary[] = [];

  for (const file of agentFiles) {
    const agentId = file.replace(/^agent-/, "").replace(/\.jsonl$/, "");
    const jsonlPath = path.join(subagentsDir, file);
    const metaPath = path.join(subagentsDir, `agent-${agentId}.meta.json`);

    let agentType = "unknown";
    let description = "";

    try {
      const metaContent = await fs.readFile(metaPath, "utf-8");
      const meta = JSON.parse(metaContent);
      agentType = meta.agentType ?? "unknown";
      description = meta.description ?? "";
    } catch {
      // No meta file
    }

    const parsed = await parseConversation(jsonlPath, agentId);

    subagents.push({
      id: agentId,
      agentType,
      description,
      turns: parsed.turns,
      toolCalls: parsed.toolCalls,
      tokenTimeline: parsed.tokenTimeline,
      totals: {
        inputTokens: parsed.totals.inputTokens,
        outputTokens: parsed.totals.outputTokens,
        toolCalls: parsed.totals.toolCalls,
        turnCount: parsed.totals.turnCount,
      },
    });
  }

  return subagents;
}
