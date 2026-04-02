import { createReadStream } from "fs";
import readline from "readline";
import path from "path";
import type {
  ParsedConversation,
  Turn,
  ToolCall,
  TokenDataPoint,
  SubagentSummary,
} from "./types.js";
import { parseSubagents } from "./subagents.js";

export type { ParsedConversation };

export async function parseConversation(
  filePath: string,
  sessionId: string
): Promise<ParsedConversation> {
  const stream = createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let title: string | null = null;
  let agentName: string | null = null;
  let model = "";
  let gitBranch = "";
  let version = "";
  let startedAt = "";

  const turns: Turn[] = [];
  const toolCalls: ToolCall[] = [];
  const tokenTimeline: TokenDataPoint[] = [];
  const subagents: SubagentSummary[] = [];

  // Pending state for building turns
  const pendingToolCalls = new Map<string, Partial<ToolCall>>();
  let currentUserMsg: any = null;
  let currentAssistantMsg: any = null;
  let turnIndex = 0;
  let turnDurationMs: number | null = null;

  // Cumulative token counters
  let cumInput = 0;
  let cumOutput = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }

    // First timestamp
    if (!startedAt && msg.timestamp) {
      startedAt = msg.timestamp;
    }

    switch (msg.type) {
      case "custom-title":
        title = msg.title ?? title;
        break;

      case "agent-name":
        agentName = msg.agentName ?? agentName;
        break;

      case "summary": {
        // Context compression summaries — skip for turn building
        break;
      }

      case "user": {
        // If we had a previous assistant message, finalize the turn
        if (currentAssistantMsg) {
          finalizeTurn();
        }

        currentUserMsg = msg;

        // Process tool_result blocks
        if (msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === "tool_result" && block.tool_use_id) {
              const pending = pendingToolCalls.get(block.tool_use_id);
              if (pending) {
                const resultContent =
                  typeof block.content === "string"
                    ? block.content
                    : Array.isArray(block.content)
                      ? block.content
                          .map((c: any) => c.text ?? JSON.stringify(c))
                          .join("\n")
                      : JSON.stringify(block.content);

                pending.result = {
                  content: resultContent,
                  sizeBytes: new TextEncoder().encode(resultContent).length,
                  persistedPath: null,
                };
                pending.endTimestamp = msg.timestamp;
                if (pending.startTimestamp && msg.timestamp) {
                  pending.durationMs =
                    new Date(msg.timestamp).getTime() -
                    new Date(pending.startTimestamp).getTime();
                }

                // Check for MCP meta
                if (msg.mcpMeta) {
                  pending.isMcp = true;
                }

                // Complete the tool call
                const completed = pending as ToolCall;
                toolCalls.push(completed);
                pendingToolCalls.delete(block.tool_use_id);
              }
            }
          }
        }

        // Also handle toolUseResult (persisted to disk)
        if (msg.toolUseResult) {
          const pending = pendingToolCalls.get(msg.toolUseResult.toolUseId);
          if (pending) {
            pending.result = {
              content: msg.toolUseResult.content ?? "[persisted to disk]",
              sizeBytes: msg.toolUseResult.sizeBytes ?? 0,
              persistedPath: msg.toolUseResult.path ?? null,
            };
            pending.endTimestamp = msg.timestamp;
            if (pending.startTimestamp && msg.timestamp) {
              pending.durationMs =
                new Date(msg.timestamp).getTime() -
                new Date(pending.startTimestamp).getTime();
            }
            const completed = pending as ToolCall;
            toolCalls.push(completed);
            pendingToolCalls.delete(msg.toolUseResult.toolUseId);
          }
        }
        break;
      }

      case "assistant": {
        currentAssistantMsg = msg;

        // Extract model
        if (msg.message?.model && !model) {
          model = msg.message.model;
        }

        // Extract token usage
        const usage = msg.message?.usage;
        if (usage) {
          const inputTokens = usage.input_tokens ?? 0;
          const outputTokens = usage.output_tokens ?? 0;
          const cacheCreation = usage.cache_creation_input_tokens ?? 0;
          const cacheRead = usage.cache_read_input_tokens ?? 0;

          cumInput += inputTokens;
          cumOutput += outputTokens;

          tokenTimeline.push({
            turnIndex,
            timestamp: msg.timestamp,
            inputTokens,
            outputTokens,
            cacheCreationTokens: cacheCreation,
            cacheReadTokens: cacheRead,
            cumulativeInputTokens: cumInput,
            cumulativeOutputTokens: cumOutput,
          });
        }

        // Process tool_use blocks
        if (msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === "tool_use") {
              const toolName = block.name ?? "unknown";
              const isMcp = toolName.startsWith("mcp__");
              let mcpServer: string | null = null;
              if (isMcp) {
                const parts = toolName.split("__");
                mcpServer = parts[1] ?? null;
              }

              pendingToolCalls.set(block.id, {
                id: block.id,
                name: toolName,
                input: block.input ?? {},
                startTimestamp: msg.timestamp,
                turnIndex,
                isMcp,
                mcpServer,
              });
            }
          }
        }
        break;
      }

      case "system": {
        if (msg.subtype === "turn_duration" && msg.durationMs != null) {
          turnDurationMs = msg.durationMs;
        }
        if (msg.version) {
          version = msg.version;
        }
        if (msg.gitBranch) {
          gitBranch = msg.gitBranch;
        }
        break;
      }
    }
  }

  // Finalize last turn
  if (currentAssistantMsg) {
    finalizeTurn();
  }

  function finalizeTurn() {
    if (!currentAssistantMsg) return;

    const userContent = extractTextContent(currentUserMsg?.message?.content);
    const userToolResults = extractToolResults(currentUserMsg?.message?.content);
    const assistantContent = extractTextContent(
      currentAssistantMsg.message?.content
    );
    const assistantToolCalls = extractToolCallRefs(
      currentAssistantMsg.message?.content
    );
    const usage = currentAssistantMsg.message?.usage ?? {};

    turns.push({
      index: turnIndex,
      userMessage: {
        timestamp: currentUserMsg?.timestamp ?? "",
        content: userContent,
        toolResults: userToolResults,
      },
      assistantMessage: {
        timestamp: currentAssistantMsg.timestamp ?? "",
        content: assistantContent,
        toolCalls: assistantToolCalls,
        usage: {
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
          cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        },
      },
      durationMs: turnDurationMs,
    });

    turnIndex++;
    turnDurationMs = null;
    currentUserMsg = null;
    currentAssistantMsg = null;
  }

  // Parse subagents
  const sessionDir = path.join(
    path.dirname(filePath),
    path.basename(filePath, ".jsonl")
  );
  const parsedSubagents = await parseSubagents(sessionDir);
  subagents.push(...parsedSubagents);

  // Compute totals
  const totalDuration =
    startedAt && tokenTimeline.length > 0
      ? new Date(tokenTimeline[tokenTimeline.length - 1].timestamp).getTime() -
        new Date(startedAt).getTime()
      : null;

  const result: ParsedConversation = {
    id: sessionId,
    title,
    agentName,
    startedAt,
    model,
    gitBranch,
    version,
    turns,
    toolCalls,
    tokenTimeline,
    subagents,
    totals: {
      inputTokens: cumInput,
      outputTokens: cumOutput,
      cacheCreationTokens: tokenTimeline.reduce(
        (s, t) => s + t.cacheCreationTokens,
        0
      ),
      cacheReadTokens: tokenTimeline.reduce(
        (s, t) => s + t.cacheReadTokens,
        0
      ),
      toolCalls: toolCalls.length,
      durationMs: totalDuration,
      turnCount: turns.length,
    },
  };

  return result;
}

function extractTextContent(content: any): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
}

function extractToolResults(content: any) {
  if (!content || !Array.isArray(content)) return [];
  return content
    .filter((b: any) => b.type === "tool_result")
    .map((b: any) => ({
      toolUseId: b.tool_use_id,
      content:
        typeof b.content === "string" ? b.content : JSON.stringify(b.content),
    }));
}

function extractToolCallRefs(content: any) {
  if (!content || !Array.isArray(content)) return [];
  return content
    .filter((b: any) => b.type === "tool_use")
    .map((b: any) => ({
      id: b.id,
      name: b.name,
    }));
}
