'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { CampusId } from '@/components/campus-map';

const CampusMap = dynamic(() => import('@/components/campus-map'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[300px] bg-gray-50 rounded-xl border border-gray-200">
      <div className="text-gray-400 text-sm">加载地图中...</div>
    </div>
  ),
});

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[] | undefined;
  mapCampus?: CampusId | undefined;
}

interface PersonaInfo {
  name: string;
  icon: string;
  tagline: string;
  color: string;
  colorLight: string;
  bgColor: string;
  welcome: string;
  questionPool: string[];
}

/** Fisher-Yates shuffle */
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick n random items from array */
function pickRandom<T>(array: T[], n: number): T[] {
  return shuffle(array).slice(0, n);
}

interface WeatherData {
  temperature: string;
  description: string;
  icon: string;
  wind: string;
  humidity: string;
  location: string;
}

const PERSONAS: Record<string, PersonaInfo> = {
  zhongxiaokai: {
    name: '仲小恺',
    icon: '📚',
    tagline: '话少信息密，问就对了',
    color: '#1E3A5F',
    colorLight: '#3B6CB4',
    bgColor: 'bg-[#1E3A5F]/6',
    welcome: '来了？坐。仲恺的事我比百度清楚，有什么想问的直接说。',
    questionPool: [
      '今天广州天气怎么样？',
      '仲恺有几个校区？分别在哪里？',
      '仲恺有哪些王牌专业？',
      '仲恺的招生录取分数大概是多少？',
      '白云校区食堂哪家最好吃？',
      '宿舍是几人间？有空调吗？',
      '军训需要准备什么物品？',
      '图书馆开放时间是怎样的？',
      '快递地址怎么填？',
      '校园跑要求跑多少公里？',
      '作息时间表是怎样的？',
      '新生报到需要带什么证件？',
      '有什么社团可以推荐？',
      '校园网怎么办理？',
      '选课有什么技巧？',
      '校车时刻表查一下',
    ],
  },
  yingjiang: {
    name: '樱酱',
    icon: '🌸',
    tagline: '魔法校园向导，随时待命',
    color: '#E8567F',
    colorLight: '#F7A8C4',
    bgColor: 'bg-[#E8567F]/6',
    welcome: '(元气满满地挥舞着库洛牌魔杖✨) Hoeeeeーー！你终于来啦～小樱等你好久了呢！🌸 绝对没问题的，不管什么问题小樱都会帮你的哦～',
    questionPool: [
      '今天天气怎么样呀？',
      '仲恺的校园是什么样的？有几个校区？',
      '有什么好的专业推荐吗？',
      '仲恺的录取分数线是多少呀？',
      '白云校区有什么好吃的呀？',
      '宿舍环境怎么样？几人一间呢？',
      '军训要准备什么东西呀？',
      '图书馆几点开门呀？',
      '快递要怎么寄到学校呢？',
      '校园跑要跑多少呀？',
      '上课时间是怎样的呀？',
      '新生报到要带什么呢？',
      '有什么好玩的社团吗？',
      '校园网怎么连呀？',
      '选课有什么秘诀吗？',
      '怎么坐校车呀？',
    ],
  },
  baishitong: {
    name: '仲恺校园百事通',
    icon: '🎓',
    tagline: '食堂校车教务，一键直达',
    color: '#2D9F6F',
    colorLight: '#6DD5A8',
    bgColor: 'bg-[#2D9F6F]/6',
    welcome: '⚡ 系统就绪。查询完毕，结果如下：我是仲恺校园百事通，可查询天气、校区、专业、招生、就业等信息。请输入您的问题。',
    questionPool: [
      '查一下广州今天的天气',
      '仲恺的校区地址和联系方式是什么？',
      '仲恺有哪些国家级一流本科专业？',
      '仲恺2026年在广东的录取分数线是多少？',
      '白云校区食堂指南',
      '宿舍与水电指南',
      '军训指南',
      '图书馆使用指南',
      '快递收货地址与驿站',
      '校园跑与运动考核标准',
      '作息时间表',
      '新生报到流程',
      '社团与竞赛活动',
      '校园网办理方式',
      '选课与教务系统',
      '校园交通与地图',
    ],
  },
};

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

/** Parse [MAP:campus=xxx] marker from text */
function parseMapMarker(text: string): { content: string; mapCampus: CampusId | null } {
  const mapRegex = /\[MAP:campus=(haizhu|baiyun|both)\]/;
  const match = text.match(mapRegex);
  if (!match) {
    return { content: text, mapCampus: null };
  }
  const content = text.replace(mapRegex, '').trimEnd();
  return { content, mapCampus: match[1] as CampusId };
}

function parseSuggestions(fullText: string): { content: string; suggestions: string[]; mapCampus: CampusId | null } {
  // First parse map marker
  const { content: withoutMap, mapCampus } = parseMapMarker(fullText);

  // Try new format first: [建议问题]
  const newMarker = '[建议问题]';
  const oldMarker = '[SUGGESTIONS]';

  let marker = '';
  let idx = withoutMap.indexOf(newMarker);
  if (idx !== -1) {
    marker = newMarker;
  } else {
    idx = withoutMap.indexOf(oldMarker);
    if (idx !== -1) {
      marker = oldMarker;
    }
  }

  if (!marker || idx === -1) {
    return { content: withoutMap, suggestions: [], mapCampus };
  }

  const content = withoutMap.slice(0, idx).trimEnd();
  const suggestionText = withoutMap.slice(idx + marker.length).trim();

  if (!suggestionText) {
    return { content, suggestions: [], mapCampus };
  }

  // Parse suggestions - handle both numbered format (1. xxx) and plain format
  const suggestions = suggestionText
    .split(/\n---\n|\n/)
    .map((s) => s.trim())
    .map((s) => s.replace(/^\d+[\.\、\)]\s*/, '')) // Remove leading numbers like "1. " or "1、"
    .filter((s) => s.length > 0 && s.length < 100)
    .slice(0, 5);

  return { content, suggestions, mapCampus };
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const personaId = params.personaId as string;
  const persona = PERSONAS[personaId];

  // Campus state from URL params
  const [campus, setCampus] = useState<CampusId>('all');
  useEffect(() => {
    const c = searchParams.get('campus');
    if (c === 'haizhu' || c === 'baiyun' || c === 'all') {
      setCampus(c);
    }
  }, [searchParams]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Randomly select 4 questions from the question pool
  const randomSuggestions = useMemo(() => {
    if (!persona) return [];
    return shuffle(persona.questionPool).slice(0, 4);
  }, [persona]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (persona) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: persona.welcome,
          suggestions: randomSuggestions,
        },
      ]);
    }
  }, [persona, personaId, randomSuggestions]);

  useEffect(() => {
    fetch('/api/weather')
      .then((res) => res.json())
      .then((data: WeatherData) => setWeather(data))
      .catch(() => {});
  }, []);

  // Get the latest assistant message's suggestions for number-based selection
  const getActiveSuggestions = useCallback((): string[] => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].suggestions && messages[i].suggestions!.length > 0) {
        return messages[i].suggestions!;
      }
    }
    return [];
  }, [messages]);

  if (!persona) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#FAFBFE] to-[#F0F4F8]">
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-4">未找到该人格</p>
          <button
            onClick={() => router.push('/')}
            className="text-[#3B6CB4] hover:underline"
          >
            返回选择页面
          </button>
        </div>
      </div>
    );
  }

  const handleSend = async (text?: string) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || isLoading) return;

    // Check if the input is a number for quick selection
    const numMatch = trimmed.match(/^(\d)$/);
    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1;
      const activeSuggestions = getActiveSuggestions();
      if (idx >= 0 && idx < activeSuggestions.length) {
        setInput('');
        await doSend(activeSuggestions[idx]);
        return;
      }
    }

    setInput('');
    await doSend(trimmed);
  };

  const doSend = async (text: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    setMessages((prev) =>
      prev.map((m): Message => ({ ...m, suggestions: undefined })).concat(userMessage)
    );
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '' },
    ]);

    try {
      const chatMessages = messages
        .filter((m) => m.id !== 'welcome' || messages.length <= 1)
        .concat(userMessage)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatMessages, personaId, campus }),
      });

      if (!response.ok) {
        const failure: unknown = await response.json().catch(() => null);
        const message = failure && typeof failure === 'object' && 'error' in failure && typeof failure.error === 'string'
          ? failure.error : '请求失败，请稍后重试。';
        throw new Error(message);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('无法读取响应流');

      let accumulated = '';

      let pending = '';
      const consumeLine = (line: string) => {
        if (!line.startsWith('data:')) return;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') return;
        let parsed: unknown;
        try { parsed = JSON.parse(data); } catch { return; }
        if (!parsed || typeof parsed !== 'object') return;
        if ('error' in parsed && typeof parsed.error === 'string') throw new Error(parsed.error);
        if ('content' in parsed && typeof parsed.content === 'string') {
          accumulated += parsed.content;
          const { content } = parseSuggestions(accumulated);
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content } : m));
        }
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
          const lines = pending.split('\n');
          pending = lines.pop() || '';
          for (const line of lines) consumeLine(line);
          if (done) { if (pending) consumeLine(pending); break; }
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }

      // After stream ends, parse suggestions and map markers
      if (accumulated) {
        const { content, suggestions, mapCampus } = parseSuggestions(accumulated);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content, suggestions: suggestions.length > 0 ? suggestions : undefined, mapCampus: mapCampus || undefined }
              : m
          )
        );
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: error instanceof Error ? error.message : '网络异常，请稍后重试。' }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      // Don't auto-focus input after sending to prevent mobile keyboard popup
      // when user clicks suggestion buttons. Only focus when user explicitly
      // interacts with the input field.
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-[#FAFBFE] to-[#F0F4F8]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 sm:px-6 py-3 bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <button
          onClick={() => router.push('/')}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
          aria-label="返回"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
          style={{ backgroundColor: `${persona.color}12` }}
        >
          <span className="text-xl">{persona.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base truncate" style={{ color: persona.color }}>
            {persona.name}
          </h1>
          <p className="text-xs text-gray-400 truncate">{persona.tagline}</p>
        </div>

        {/* Weather Badge */}
        {weather && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-full text-xs text-gray-500 flex-shrink-0">
            <span>{weather.icon}</span>
            <span className="font-medium text-gray-700">{weather.temperature}</span>
            <span className="text-gray-300">|</span>
            <span>{weather.description}</span>
            <span className="text-gray-300">|</span>
            <span>{weather.wind}</span>
          </div>
        )}

        <div
          className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
          style={{ backgroundColor: persona.colorLight }}
        />
      </header>

      {/* Mobile Weather Bar */}
      {weather && (
        <div className="sm:hidden flex items-center justify-center gap-2 px-4 py-2 bg-white/60 border-b border-gray-50 text-xs text-gray-500">
          <span>{weather.icon}</span>
          <span className="font-medium text-gray-600">{weather.location}</span>
          <span className="text-gray-300">|</span>
          <span>{weather.temperature}</span>
          <span>{weather.description}</span>
          <span className="text-gray-300">|</span>
          <span>{weather.wind}</span>
        </div>
      )}

      {/* Campus Tag */}
      <div className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white/90 backdrop-blur-sm border-b border-gray-50 sticky top-[57px] sm:top-[61px] z-20">
        {(['haizhu', 'baiyun', 'all'] as CampusId[]).map((c) => {
          const labels: Record<CampusId, string> = { haizhu: '海珠校区', baiyun: '白云校区', all: '全部' };
          const isActive = campus === c;
          return (
            <button
              key={c}
              onClick={() => setCampus(c)}
              className={`
                px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                ${isActive
                  ? 'bg-[#1E3A5F] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }
              `}
            >
              {labels[c]}
            </button>
          );
        })}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {messages.map((message) => (
            <div key={message.id}>
              <div
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                {message.role === 'assistant' && (
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                    style={{ backgroundColor: `${persona.color}10` }}
                  >
                    {persona.icon}
                  </div>
                )}

                <div
                  className={`max-w-[80%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    message.role === 'user'
                      ? 'text-white rounded-tr-sm'
                      : 'bg-white text-gray-700 shadow-sm border border-gray-100 rounded-tl-sm'
                  }`}
                  style={
                    message.role === 'user'
                      ? { backgroundColor: persona.color }
                      : undefined
                  }
                >
                  {message.content || (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Campus Map - rendered when AI response contains [MAP:campus=xxx] marker */}
              {message.role === 'assistant' && message.mapCampus && (
                <div className="mt-3 ml-11">
                  <CampusMap
                    defaultCampus={message.mapCampus}
                    height="250px"
                    showSwitcher={true}
                    compact={true}
                  />
                </div>
              )}

              {/* Smart Suggestion Buttons */}
              {message.role === 'assistant' && message.suggestions && message.suggestions.length > 0 && (
                <div className="flex flex-col gap-2 mt-3 ml-11">
                  {message.suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => doSend(suggestion)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-left border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        backgroundColor: `${persona.color}06`,
                        borderColor: `${persona.color}18`,
                        color: persona.color,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${persona.color}12`;
                        e.currentTarget.style.borderColor = `${persona.color}35`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = `${persona.color}06`;
                        e.currentTarget.style.borderColor = `${persona.color}18`;
                      }}
                    >
                      <span className="flex-shrink-0 text-base">{NUMBER_EMOJIS[idx]}</span>
                      <span className="leading-snug">{suggestion}</span>
                    </button>
                  ))}
                  <p className="text-[11px] text-gray-300 ml-1 mt-0.5">
                    回复数字 1-{message.suggestions.length} 可快速选择
                  </p>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-md border-t border-gray-100 px-4 sm:px-6 py-4 safe-bottom">
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`向${persona.name}提问，或回复数字快速选择...`}
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none transition-all"
            style={{ maxHeight: '120px' }}
            onFocus={(e) => {
              e.target.style.boxShadow = `0 0 0 2px ${persona.color}40`;
              e.target.style.borderColor = 'transparent';
            }}
            onBlur={(e) => {
              e.target.style.boxShadow = 'none';
              e.target.style.borderColor = '';
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
            style={{ backgroundColor: persona.color }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-300 mt-2">
          按 Enter 发送 | 回复数字 1-5 快速选择推荐问题
        </p>
      </div>
    </div>
  );
}
