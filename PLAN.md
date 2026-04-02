# ccviz — Claude Code Conversation Visualizer

## Overview

A CLI tool (`npm i -g ccviz`) that opens a browser UI to explore and visualize Claude Code conversations stored in `~/.claude/`. Focused on debugging MCP tool calls, identifying context bloat, and understanding token/timing patterns.

## Data Source

All data lives in `~/.claude/`:

```
~/.claude/
├── sessions/                          # PID → session ID mapping
│   └── {pid}.json                     # { pid, sessionId, cwd, startedAt, kind, entrypoint }
├── projects/
│   └── {path-encoded-cwd}/            # e.g. -Users-dhruv-Documents-code-noclick
│       ├── {session-id}.jsonl         # Full conversation transcript
│       └── {session-id}/
│           ├── tool-results/          # Large tool outputs persisted to disk
│           │   └── {tool_use_id}.txt
│           └── subagents/
│               ├── agent-{id}.jsonl   # Subagent conversation transcript
│               └── agent-{id}.meta.json  # { agentType, description }
```

### JSONL Message Types

| Type | Key Fields | Notes |
|------|-----------|-------|
| `assistant` | `message.content[]` (text/tool_use blocks), `message.usage` (tokens), `message.model`, `timestamp` | Token usage on every message. tool_use blocks have `id`, `name`, `input` |
| `user` | `message.content[]` (text/tool_result blocks), `timestamp`, `toolUseResult`, `mcpMeta` | tool_result blocks have `tool_use_id`, `content`. MCP results include `mcpMeta.structuredContent` |
| `system` | `subtype` (turn_duration/stop_hook_summary/local_command/bridge_status) | `turn_duration` has `durationMs` |
| `file-history-snapshot` | `snapshot.trackedFileBackups`, `snapshot.timestamp` | File state snapshots for undo |
| `queue-operation` | | Task queue operations |
| `custom-title` | | User-set conversation title |
| `agent-name` | | Conversation slug/name |

### Derivable Metrics

**Per tool call** (correlate `tool_use` in assistant → `tool_result` in user by ID):
- Tool name, input parameters, result content
- Duration: `result.timestamp - call.timestamp`
- Result size in bytes (or "persisted to disk" with file path)

**Per assistant turn:**
- `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`
- Model used, stop_reason
- Number of tool calls in the turn

**Per conversation turn (user→assistant cycle):**
- `turn_duration` from system messages (total wall time)
- Cumulative token growth

**Per subagent:**
- Full nested transcript with same structure
- Agent type and description from meta.json

---

## Architecture

```
ccviz/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts                    # Entry point — parse args, start server, open browser
│   ├── server/
│   │   ├── index.ts              # Express server
│   │   ├── api/
│   │   │   ├── projects.ts       # GET /api/projects — list project folders (hierarchical)
│   │   │   ├── conversations.ts  # GET /api/projects/:path/conversations — list convos
│   │   │   └── conversation.ts   # GET /api/conversations/:id — parsed conversation data
│   │   └── parser/
│   │       ├── index.ts          # Main JSONL parser
│   │       ├── tool-calls.ts     # Correlate tool_use ↔ tool_result, compute timing/sizes
│   │       ├── tokens.ts         # Extract token usage timeline
│   │       └── subagents.ts      # Parse subagent transcripts
│   └── ui/                       # React app (Vite)
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── pages/
│       │   ├── ProjectBrowser.tsx    # Folder tree → conversation list
│       │   └── ConversationView.tsx  # Visualizations for a single conversation
│       └── components/
│           ├── FolderTree.tsx         # Hierarchical project folders
│           ├── ConversationList.tsx   # Sortable conversation list
│           ├── Timeline.tsx           # Turn-by-turn timeline
│           ├── TokenChart.tsx         # Token usage over time (area chart)
│           ├── ToolCallTable.tsx      # Sortable table of all tool calls
│           ├── ToolCallDetail.tsx     # Expandable tool input/output viewer
│           ├── ContextWaterfall.tsx   # Stacked bar: what's eating context per turn
│           └── SubagentPanel.tsx      # Nested subagent visualization
```

### Tech Stack

- **CLI**: Node.js, `commander` for arg parsing, `open` to launch browser
- **Server**: Express, serves API + static React build
- **Parser**: TypeScript, streams JSONL line-by-line (conversations can be 25MB+)
- **UI**: React 19, Vite, Tailwind CSS, Recharts for charts
- **Build**: `tsup` for server bundle, Vite for UI bundle

---

## Implementation Plan

### Phase 1: Project scaffolding and CLI

1. `npm init`, set `bin.ccviz` → `dist/cli.js`
2. `src/cli.ts`: parse `--port` (default 3333), `--claude-dir` (default `~/.claude`), start Express, open browser
3. Express serves `/api/*` routes and static UI files from `dist/ui/`
4. Vite config for React UI with build output to `dist/ui/`
5. Dev mode: `concurrently` runs Vite dev server + Express with proxy

### Phase 2: JSONL parser

Core parser that reads a conversation JSONL and returns structured data:

```ts
interface ParsedConversation {
  id: string;
  title: string | null;              // from custom-title message
  agentName: string | null;          // from agent-name message (slug)
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

interface Turn {
  index: number;
  userMessage: { timestamp: string; content: string; toolResults: ToolResult[] };
  assistantMessage: { timestamp: string; content: string; toolCalls: ToolCallRef[]; usage: TokenUsage };
  durationMs: number | null;         // from system turn_duration
}

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
  result: {
    content: string;
    sizeBytes: number;
    persistedPath: string | null;    // if output was too large
  };
  startTimestamp: string;
  endTimestamp: string;
  durationMs: number;
  turnIndex: number;
  isMcp: boolean;                    // name starts with mcp__
  mcpServer: string | null;          // e.g. "noclick", "nc"
}

interface TokenDataPoint {
  turnIndex: number;
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cumulativeInputTokens: number;
  cumulativeOutputTokens: number;
}
```

Key parsing logic:
- Stream JSONL line-by-line (don't load 25MB into memory at once)
- Build a map of `tool_use_id → ToolCall` from assistant messages
- Fill in results by matching `tool_result.tool_use_id` from user messages
- Compute duration as `result.timestamp - call.timestamp`
- Track cumulative token counts across turns
- Detect MCP tools by `mcp__` prefix, extract server name from `mcp__{server}__*`

### Phase 3: API routes

**`GET /api/projects`**
- Read `~/.claude/projects/`, decode folder names (replace leading `-` and internal `-` back to `/`)
- Return hierarchical tree structure for the folder browser
- Include conversation count per project

**`GET /api/projects/:encodedPath/conversations`**
- List all `.jsonl` files in the project directory
- For each, do a quick scan (first + last few lines) to extract: session ID, start time, last timestamp, git branch, title/slug, model, total lines
- Sort by last modified (recency)
- Return summary list (don't parse full conversation)

**`GET /api/conversations/:projectPath/:sessionId`**
- Full parse of the JSONL using Phase 2 parser
- Return `ParsedConversation` as JSON
- Cache parsed result in memory (LRU, keyed by file mtime)

**`GET /api/conversations/:projectPath/:sessionId/tool-result/:toolUseId`**
- Read persisted large tool result from `{session-id}/tool-results/{toolUseId}.txt`

### Phase 4: UI — Project Browser page

**Route: `/`**

Left panel — Folder tree:
- Reconstruct directory hierarchy from encoded project paths
- e.g. `-Users-dhruv-Documents-code-noclick` → `Users / dhruv / Documents / code / noclick`
- Collapsible tree with conversation count badges
- Click a leaf project to show its conversations

Right panel — Conversation list:
- Cards showing: title/slug, date, git branch, model, duration, total tool calls, total tokens
- Sorted by recency (most recent first)
- Search/filter by branch name, date range
- Click to navigate to conversation detail

### Phase 5: UI — Conversation View page

**Route: `/conversation/:projectPath/:sessionId`**

Top bar:
- Conversation title, git branch, model, total duration
- Summary stats: total turns, tool calls, input/output tokens

#### Tab 1: Timeline

Vertical timeline of turns, each showing:
- User message (truncated, expandable)
- Assistant response (truncated, expandable)
- Tool calls as nested cards: name, duration badge, result size badge
- Turn duration and token count in the gutter
- Color-code: MCP calls in blue, Agent calls in purple, Read/Edit/Grep in gray

#### Tab 2: Token Usage

- **Area chart** (Recharts): X = turn index, Y = tokens. Stacked areas for input, output, cache_creation, cache_read
- **Cumulative line chart**: shows context growth over time
- Annotations on the chart for significant events (large tool results, subagent launches)
- Table below: per-turn token breakdown, sortable by any column

#### Tab 3: Tool Calls

- **Sortable table**: name, duration, result size, turn #, MCP server
- Click to expand: show full input JSON (syntax highlighted) and result content (truncated with "show full" for large results)
- **Filters**: by tool name, MCP server, min duration, min result size
- **Aggregations at top**: 
  - Tool call count by name (bar chart)
  - Total result bytes by tool name (bar chart — shows what's eating context)
  - Average duration by tool name
  - MCP vs non-MCP breakdown

#### Tab 4: Context Budget

The key debugging view — shows where context is being consumed:

- **Stacked bar chart**: each bar is a turn, segments are: system prompt (estimated from first turn), user message text, tool results, assistant output, cache overhead
- **Pie chart**: % of total context consumed by each tool type
- **Top 10 largest tool results**: table with tool name, size, and whether it was persisted to disk
- **Optimization suggestions** (heuristic): flag tool results > 10KB, flag repeated identical tool calls, flag Read calls on files > 500 lines

#### Tab 5: Subagents

- List of spawned subagents with: type, description, duration, token usage
- Click to expand: shows the subagent's own timeline (recursive use of Timeline component)
- Token usage comparison: main conversation vs each subagent

---

## Phase 6: Polish and packaging

1. **`npm run build`**: tsup bundles server, Vite bundles UI
2. **`package.json` bin field**: points to `dist/cli.js`
3. **`npm pack` / `npm publish`**: installable via `npm i -g ccviz`
4. Add `--json` flag to CLI for raw parsed data output (no server)
5. Add `--conversation` flag to open directly to a specific conversation
6. Dark mode (default) + light mode toggle

---

## File Size / Performance Considerations

- Conversations can be 25MB+. Parser must stream, not `JSON.parse` the whole file.
- Conversation list should only quick-scan first/last lines, not full parse.
- Full parse results cached in-memory with LRU eviction.
- UI should lazy-load tool result content (fetch on expand, not on page load).
- Large tool results (persisted to disk) fetched via separate API call.

## Open Questions

- Should we support filtering across all conversations (e.g., "show me all MCP tool calls across all conversations")? → Defer to v2
- Should we estimate cost from token counts? → Nice to have, add model pricing table
- Should we support live/watching mode for active conversations? → Defer to v2
