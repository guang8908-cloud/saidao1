interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatInput {
  messages: ConversationMessage[];
  personaId: string;
  campus?: 'haizhu' | 'baiyun' | 'all';
}

export function parseChatInput(value: unknown): ChatInput | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  if (typeof body.personaId !== 'string' || !['zhongxiaokai', 'yingjiang', 'baishitong'].includes(body.personaId)) return null;
  if (body.campus !== undefined && !['haizhu', 'baiyun', 'all'].includes(String(body.campus))) return null;
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 40) return null;
  const messages: ConversationMessage[] = [];
  let characters = 0;
  for (const item of body.messages) {
    if (!item || typeof item !== 'object') return null;
    const message = item as Record<string, unknown>;
    if (message.role !== 'user' && message.role !== 'assistant') return null;
    if (typeof message.content !== 'string' || !message.content.trim() || message.content.length > 8000) return null;
    characters += message.content.length;
    if (characters > 24000) return null;
    messages.push({ role: message.role, content: message.content });
  }
  if (messages[messages.length - 1].role !== 'user') return null;
  return { messages, personaId: body.personaId, campus: body.campus as ChatInput['campus'] };
}
