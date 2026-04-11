import { api } from './tauri';
import { toolDefinitions, dispatchTool } from './agentTools';

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ToolExecution {
  toolName: string;
  input: Record<string, unknown>;
  result?: string;
  status: 'running' | 'done' | 'error';
}

const SYSTEM_PROMPT = `You are Maestro, a music library assistant in the Aura desktop player. The library is backed by Navidrome with a local SQLite cache.

## Search capabilities
search_tracks matches song titles, artist names, album names, and genre names ONLY via full-text index. It does NOT support mood, theme, lyrical, or semantic search.
- GOOD: search_tracks("Bon Iver"), search_tracks("Kind of Blue"), search_tracks("Indie Folk")
- BAD: search_tracks("sad love"), search_tracks("melancholy"), search_tracks("upbeat workout")
To find music by mood or theme, use genre browsing, artist exploration, playlist contents, and find_similar_tracks as your signals — not free-text search.

## Guidelines
- Use tools to look up real data rather than guessing.
- Use get_now_playing when the user references "this song" or what's playing.
- Use find_similar_tracks for recommendations — it finds candidates by shared artists/genres in one call. Prefer it over multiple manual searches.
- Use apply_tag_bulk for tagging multiple tracks (up to 50 per call).
- Ratings: 1-5 stars, 0/null = unrated.
- Be concise. Summarize results rather than dumping raw data.

## Action links
Embed clickable buttons: {{action_type:identifier:Label}}
Actions: open_playlist, open_album, open_artist, open_genre, play_track.
Example: {{open_album:al-123:Kind of Blue}} {{play_track:tr-789:Blue in Green}}
Include links whenever you mention a playlist, album, artist, or track.`;

const MAX_ITERATIONS = 20;
const TOOL_RESULT_MAX_LEN = 800;

function compressOldToolResults(messages: ChatMessage[]): ChatMessage[] {
  let lastToolResultIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'user' && Array.isArray(msg.content) &&
        msg.content.some(b => b.type === 'tool_result')) {
      lastToolResultIdx = i;
      break;
    }
  }

  return messages.map((msg, i) => {
    if (i >= lastToolResultIdx) return msg;
    if (msg.role !== 'user' || !Array.isArray(msg.content)) return msg;

    const compressed = msg.content.map(block => {
      if (block.type !== 'tool_result') return block;
      const content = (block as ToolResultBlock).content;
      if (content.length <= TOOL_RESULT_MAX_LEN) return block;
      const lines = content.split('\n');
      const lineCount = lines.length;
      const truncated = lines.slice(0, 8).join('\n');
      return {
        ...block,
        content: `${truncated}\n... (${lineCount} lines total, truncated)`,
      };
    });
    return { ...msg, content: compressed };
  });
}

interface AnthropicResponse {
  id: string;
  content: ContentBlock[];
  stop_reason: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export async function runAgentLoop(
  messages: ChatMessage[],
  apiKey: string,
  model: string,
  onToolExecution?: (execution: ToolExecution) => void,
  onAssistantChunk?: (messages: ChatMessage[]) => void,
  onUsage?: (inputTokens: number, outputTokens: number, model: string) => void,
): Promise<ChatMessage[]> {
  const conversationMessages = [...messages];
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const compressed = compressOldToolResults(conversationMessages);

    const body = JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages: compressed.map(serializeMessage),
    });

    const responseText = await api.proxyAnthropic(apiKey, body);
    const response: AnthropicResponse = JSON.parse(responseText);

    if (response.usage && onUsage) {
      onUsage(response.usage.input_tokens, response.usage.output_tokens, model);
    }

    conversationMessages.push({
      role: 'assistant',
      content: response.content,
    });

    if (onAssistantChunk) {
      onAssistantChunk([...conversationMessages]);
    }

    if (response.stop_reason !== 'tool_use') {
      break;
    }

    const toolUseBlocks = response.content.filter(
      (b): b is ToolUseBlock => b.type === 'tool_use',
    );

    const toolResults: ContentBlock[] = [];

    for (const toolUse of toolUseBlocks) {
      const execution: ToolExecution = {
        toolName: toolUse.name,
        input: toolUse.input,
        status: 'running',
      };
      onToolExecution?.(execution);

      try {
        const result = await dispatchTool(toolUse.name, toolUse.input);
        execution.result = result;
        execution.status = 'done';
        onToolExecution?.(execution);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        execution.result = errorMsg;
        execution.status = 'error';
        onToolExecution?.(execution);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ error: errorMsg }),
        });
      }
    }

    conversationMessages.push({
      role: 'user',
      content: toolResults,
    });

    if (onAssistantChunk) {
      onAssistantChunk([...conversationMessages]);
    }
  }

  return conversationMessages;
}

function serializeMessage(msg: ChatMessage): { role: string; content: unknown } {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content };
  }
  return { role: msg.role, content: msg.content };
}

export function extractTextFromMessage(msg: ChatMessage): string {
  if (typeof msg.content === 'string') return msg.content;
  return msg.content
    .filter((b): b is TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n');
}

export function getToolUsesFromMessage(msg: ChatMessage): ToolUseBlock[] {
  if (typeof msg.content === 'string') return [];
  return msg.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
}
