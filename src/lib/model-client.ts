export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ModelConfig {
  endpoint: URL;
  model: string;
  apiKey: string;
  maxTokens: number;
  thinking: 'enabled' | 'disabled' | undefined;
}

export class ModelServiceError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
    this.name = 'ModelServiceError';
  }
}

function readConfig(): ModelConfig {
  const model = process.env.LLM_MODEL?.trim();
  if (!model) {
    throw new ModelServiceError('尚未配置模型，请在 .env.local 中设置 LLM_MODEL。', 503);
  }
  let endpoint: URL;
  try {
    const base = (process.env.LLM_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/+$/, '');
    endpoint = new URL(`${base}/chat/completions`);
  } catch {
    throw new ModelServiceError('模型服务地址配置无效，请检查 LLM_BASE_URL。', 503);
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
  if (endpoint.protocol !== 'https:' && !(local && endpoint.protocol === 'http:')) {
    throw new ModelServiceError('远程模型服务请使用 HTTPS 地址。', 503);
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new ModelServiceError('模型服务地址应为基础地址，凭证请单独配置。', 503);
  }
  const apiKey = process.env.LLM_API_KEY?.trim() || '';
  if (!local && !apiKey) {
    throw new ModelServiceError('尚未配置模型服务密钥，请设置 LLM_API_KEY。', 503);
  }
  const maxTokens = Number(process.env.LLM_MAX_TOKENS || 2048);
  if (!Number.isInteger(maxTokens) || maxTokens < 128 || maxTokens > 8192) {
    throw new ModelServiceError('LLM_MAX_TOKENS 需设置为 128 到 8192 的整数。', 503);
  }
  const thinking = process.env.LLM_THINKING;
  if (thinking && thinking !== 'enabled' && thinking !== 'disabled') {
    throw new ModelServiceError('LLM_THINKING 仅支持 enabled 或 disabled。', 503);
  }
  return { endpoint, model, apiKey, maxTokens, thinking: thinking === 'enabled' || thinking === 'disabled' ? thinking : undefined };
}

async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer)) !== null) {
        const event = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = event.split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''));
        if (data.length) yield data.join('\n');
      }
      if (buffer.length > 1_048_576) throw new ModelServiceError('模型响应格式异常，请更换模型后重试。');
      if (done) {
        const data = buffer.split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''));
        if (data.length) yield data.join('\n');
        return;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function getContent(data: string): string | null {
  if (data.trim() === '[DONE]') return null;
  let parsed: unknown;
  try { parsed = JSON.parse(data); } catch {
    throw new ModelServiceError('模型返回了无法识别的响应。');
  }
  if (!parsed || typeof parsed !== 'object') throw new ModelServiceError('模型响应格式异常。');
  const chunk = parsed as { error?: unknown; choices?: { delta?: { content?: unknown } }[] };
  if (chunk.error) throw new ModelServiceError('模型服务返回错误，请检查模型权限和可用额度。');
  if (!Array.isArray(chunk.choices) || !chunk.choices.length) return '';
  const content = chunk.choices[0]?.delta?.content;
  return typeof content === 'string' ? content : '';
}

export async function openModelStream(messages: ModelMessage[], requestSignal?: AbortSignal) {
  const config = readConfig();
  const signals = [AbortSignal.timeout(120_000)];
  if (requestSignal) signals.push(requestSignal);
  let response: Response;
  try {
    response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model, messages, stream: true, temperature: 0.8,
        max_tokens: config.maxTokens,
        ...(config.thinking ? { thinking: { type: config.thinking } } : {}),
      }),
      signal: AbortSignal.any(signals),
      cache: 'no-store',
    });
  } catch {
    throw new ModelServiceError('无法连接模型服务，请检查地址或本地模型是否已启动。');
  }
  if (!response.ok) {
    await response.body?.cancel();
    const status = response.status;
    const message = status === 401 || status === 403 ? '模型服务认证失败，请检查密钥和模型权限。'
      : status === 429 ? '模型服务额度不足或请求过多，请稍后重试或更换模型。'
      : status === 404 ? '模型或接口不存在，请检查模型名称和服务地址。'
      : '模型服务暂时不可用，请稍后重试。';
    throw new ModelServiceError(message, status === 429 ? 429 : 502);
  }
  if (!response.body) throw new ModelServiceError('模型服务未返回响应内容。');
  const body = response.body;
  return (async function* () {
    let hasContent = false;
    for await (const data of readEvents(body)) {
      const content = getContent(data);
      if (content === null) break;
      if (content) { hasContent = true; yield content; }
    }
    if (!hasContent) throw new ModelServiceError('模型没有返回正文，请检查所选模型是否支持聊天流式输出。');
  })();
}
