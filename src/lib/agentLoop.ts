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

const SYSTEM_PROMPT = `You are Maestro, a music library research assistant built into a desktop music player called Aura. The user's library is backed by a Navidrome/Subsonic server with a local SQLite cache.

You can search, browse, and analyze the user's music collection using the provided tools. You can also apply tags (which are implemented as playlists on the server) to organize tracks.

Guidelines:
- When the user asks about their music, use tools to look up real data rather than guessing.
- Use get_now_playing to see what track is currently playing or paused, the playback position, and upcoming queue. This is useful when the user asks "what's playing?", wants recommendations based on current listening, or references "this song".
- For broad requests like "find me jazz songs", start by getting genres or searching, then drill into specific albums/artists.
- When applying tags to multiple tracks, use apply_tag_bulk for efficiency (up to 50 per call).
- Ratings are on a 1-5 star scale. A rating of 0 or null means unrated.
- Be concise and helpful. Summarize results rather than dumping raw data.
- When you've completed a task (like tagging songs), summarize what you did.

## Interactive Action Links

You can embed clickable buttons in your responses using this syntax. The app renders them as interactive buttons the user can tap to navigate or play music.

Syntax: {{action_type:identifier:Display Label}}

Available actions:
- {{open_playlist:PlaylistName:Display Label}} — opens a playlist/tag by name
- {{open_album:album_id:Album Title}} — opens an album detail view
- {{open_artist:artist_id:Artist Name}} — opens an artist detail view
- {{open_genre:GenreName:Genre Name}} — opens a genre track listing
- {{play_track:track_id:Track Title}} — immediately plays a track

Examples:
- "I created the playlist. {{open_playlist:Jazz Favorites:Open Jazz Favorites}}"
- "Here are some albums worth checking out: {{open_album:al-123:Kind of Blue}} {{open_album:al-456:A Love Supreme}}"
- "{{play_track:tr-789:Play Blue in Green}}"

Use these liberally! Whenever you mention a playlist you created, an album, artist, or track, include an action link so the user can navigate there with one click. Always include action links at the end of task summaries (e.g. after creating a tag, link to open it).`;

const MAX_ITERATIONS = 20;
const MODEL = 'claude-sonnet-4-20250514';

interface AnthropicResponse {
  id: string;
  content: ContentBlock[];
  stop_reason: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export async function runAgentLoop(
  messages: ChatMessage[],
  apiKey: string,
  onToolExecution?: (execution: ToolExecution) => void,
  onAssistantChunk?: (messages: ChatMessage[]) => void,
  onUsage?: (inputTokens: number, outputTokens: number, model: string) => void,
): Promise<ChatMessage[]> {
  const conversationMessages = [...messages];
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const body = JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages: conversationMessages.map(serializeMessage),
    });

    const responseText = await api.proxyAnthropic(apiKey, body);
    const response: AnthropicResponse = JSON.parse(responseText);

    if (response.usage && onUsage) {
      onUsage(response.usage.input_tokens, response.usage.output_tokens, MODEL);
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
