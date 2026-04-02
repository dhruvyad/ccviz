export interface ParsedConversation {
  id: string;
  title: string | null;
  agentName: string | null;
  startedAt: string;
  model: string;
  gitBranch: string;
  version: string;
  turns: Turn[];
  toolCalls: ToolCall[];
  tokenTimeline: TokenDataPoint[];
  subagents: SubagentSummary[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    toolCalls: number;
    durationMs: number | null;
    turnCount: number;
  };
}

export interface Turn {
  index: number;
  userMessage: {
    timestamp: string;
    content: string;
    toolResults: ToolResult[];
  };
  assistantMessage: {
    timestamp: string;
    content: string;
    toolCalls: ToolCallRef[];
    usage: TokenUsage;
  };
  durationMs: number | null;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
  result: {
    content: string;
    sizeBytes: number;
    persistedPath: string | null;
  };
  startTimestamp: string;
  endTimestamp: string;
  durationMs: number;
  turnIndex: number;
  isMcp: boolean;
  mcpServer: string | null;
}

export interface ToolResult {
  toolUseId: string;
  content: string;
}

export interface ToolCallRef {
  id: string;
  name: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface TokenDataPoint {
  turnIndex: number;
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cumulativeInputTokens: number;
  cumulativeOutputTokens: number;
}

export interface SubagentSummary {
  id: string;
  agentType: string;
  description: string;
  turns: Turn[];
  toolCalls: ToolCall[];
  tokenTimeline: TokenDataPoint[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    toolCalls: number;
    turnCount: number;
  };
}
