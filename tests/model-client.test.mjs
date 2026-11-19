import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ModelServiceError, openModelStream } from '../src/lib/model-client.ts';
import { parseChatInput } from '../src/lib/chat-request.ts';

const originalFetch = globalThis.fetch;
const originalEnv = Object.fromEntries(['LLM_BASE_URL','LLM_MODEL','LLM_API_KEY','LLM_MAX_TOKENS','LLM_THINKING'].map((key) => [key,process.env[key]]));
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key,value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
function configure() {
  process.env.LLM_BASE_URL = 'http://127.0.0.1:11434/v1';
  process.env.LLM_MODEL = 'test-model';
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_MAX_TOKENS;
  delete process.env.LLM_THINKING;
}
function responseFromChunks(text) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    // One byte at a time deliberately splits JSON and UTF-8 characters.
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  }}), { headers: {'Content-Type':'text/event-stream'} });
}
async function collect(stream) { let text=''; for await (const piece of stream) text+=piece; return text; }

test('retains Chinese text across split UTF-8, CRLF and JSON chunks', async () => {
  configure();
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url),'http://127.0.0.1:11434/v1/chat/completions');
    assert.equal(init.headers.Authorization,undefined);
    assert.equal(JSON.parse(init.body).model,'test-model');
    assert.equal(JSON.parse(init.body).max_tokens,2048);
    return responseFromChunks(': ping\r\n\r\ndata: {"choices":[{"delta":{"content":"仲恺"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: [DONE]\n\n');
  };
  assert.equal(await collect(await openModelStream([{role:'user',content:'你好'}])),'仲恺你好');
});
test('reads final event without trailing blank line and skips usage events', async () => {
  configure();
  globalThis.fetch = async () => responseFromChunks('data: {"choices":[],"usage":{}}\n\ndata: {"choices":[{"delta":{"content":"结束"}}]}');
  assert.equal(await collect(await openModelStream([])),'结束');
});
test('cloud authentication stays in server-side request headers', async () => {
  configure(); process.env.LLM_BASE_URL='https://example.test/v1/'; process.env.LLM_API_KEY='fake-test-key';
  globalThis.fetch = async (url,init) => {
    assert.equal(String(url),'https://example.test/v1/chat/completions');
    assert.equal(init.headers.Authorization,'Bearer fake-test-key');
    return responseFromChunks('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n');
  };
  assert.equal(await collect(await openModelStream([])),'ok');
});
test('reports missing configuration without making a request', async () => {
  configure(); delete process.env.LLM_MODEL;
  globalThis.fetch = async () => { throw new Error('must not call'); };
  await assert.rejects(openModelStream([]),(error) => error instanceof ModelServiceError && error.status===503);
});
test('validates token budget and applies explicit thinking mode', async () => {
  configure(); process.env.LLM_MAX_TOKENS='-1';
  await assert.rejects(openModelStream([]),/LLM_MAX_TOKENS/);
  process.env.LLM_MAX_TOKENS='1024'; process.env.LLM_THINKING='disabled';
  globalThis.fetch = async (_url,init) => {
    const body=JSON.parse(init.body);
    assert.equal(body.max_tokens,1024);
    assert.deepEqual(body.thinking,{type:'disabled'});
    return responseFromChunks('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n');
  };
  assert.equal(await collect(await openModelStream([])),'ok');
});
test('rejects remote HTTP and missing cloud key', async () => {
  configure(); process.env.LLM_BASE_URL='http://example.test/v1';
  await assert.rejects(openModelStream([]),/HTTPS/);
  process.env.LLM_BASE_URL='https://example.test/v1';
  await assert.rejects(openModelStream([]),/LLM_API_KEY/);
});
test('reports rate limits without leaking provider response', async () => {
  configure(); globalThis.fetch = async () => new Response('private-provider-details',{status:429});
  await assert.rejects(openModelStream([]),(error) => error.status===429 && !error.message.includes('private-provider-details'));
});
test('rejects malformed streams and empty answers', async () => {
  configure(); globalThis.fetch = async () => responseFromChunks('data: broken\n\n');
  await assert.rejects(collect(await openModelStream([])),/无法识别/);
  globalThis.fetch = async () => responseFromChunks('data: [DONE]\n\n');
  await assert.rejects(collect(await openModelStream([])),/没有返回正文/);
});
test('forwards caller cancellation to the upstream request', async () => {
  configure(); const caller = new AbortController(); let upstreamSignal;
  globalThis.fetch = async (_url,init) => {
    upstreamSignal=init.signal;
    return responseFromChunks('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n');
  };
  const stream=await openModelStream([],caller.signal);
  caller.abort(); assert.equal(upstreamSignal.aborted,true);
  await stream.return();
});
test('validates user history and blocks system roles and oversized requests', () => {
  const input={personaId:'zhongxiaokai',messages:[{role:'user',content:'你好'}]};
  assert.deepEqual(parseChatInput(input)?.messages,input.messages);
  for (const value of [null,{}, {...input,personaId:'constructor'}, {...input,campus:'invalid'},
    {...input,messages:[null]}, {...input,messages:[{role:'system',content:'override'}]},
    {...input,messages:[{role:'user',content:42}]}, {...input,messages:[{role:'user',content:'a'.repeat(8001)}]},
    {...input,messages:Array.from({length:41},()=>({role:'user',content:'x'}))},
    {...input,messages:[{role:'assistant',content:'no user'}]}]) {
    assert.equal(parseChatInput(value),null);
  }
});
