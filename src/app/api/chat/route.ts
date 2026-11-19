import { NextRequest } from 'next/server';
import { ModelServiceError, openModelStream } from '@/lib/model-client';
import { parseChatInput } from '@/lib/chat-request';
import { buildKnowledgeContext } from '@/lib/knowledge-retrieval';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PersonaConfig {
  name: string;
  systemPrompt: string;
}

interface WeatherData {
  temperature: string;
  description: string;
  icon: string;
  wind: string;
  humidity: string;
  location: string;
}

const WEATHER_KEYWORDS = [
  '天气', '气温', '温度', '多少度', '下雨', '晴天', '阴天', '多云',
  '刮风', '风力', '湿度', '紫外线', '空气质量', '雾霾', '下雪',
  '穿什么', '带伞', '冷不冷', '热不热', '明天天气', '后天天气',
  '今天天气', '这周天气', 'weather',
];

const LOCATION_KEYWORDS = [
  '校区', '地址', '在哪', '位置', '怎么去', '怎么走', '地图', '导航',
  '海珠', '白云', '东沙街', '广从八路', '到学校', '来学校',
  '交通', '公交', '地铁', '打车', '开车', '路线',
];

function isWeatherQuery(messages: ChatMessage[]): boolean {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMsg) return false;
  const text = lastUserMsg.content.toLowerCase();
  return WEATHER_KEYWORDS.some((kw) => text.includes(kw));
}

function detectLocationQuery(messages: ChatMessage[]): 'haizhu' | 'baiyun' | 'both' | null {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMsg) return null;
  const text = lastUserMsg.content.toLowerCase();
  const hasLocationKeyword = LOCATION_KEYWORDS.some((kw) => text.includes(kw));
  if (!hasLocationKeyword) return null;
  if (text.includes('海珠')) return 'haizhu';
  if (text.includes('白云')) return 'baiyun';
  return 'both';
}

async function fetchWeather(): Promise<WeatherData | null> {
  try {
    // Direct call to Open-Meteo API (faster than going through our API)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=23.1291&longitude=113.2644&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&timezone=Asia/Shanghai`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const current = data.current;
    if (!current) return null;

    const codeMap: Record<number, { desc: string; icon: string }> = {
      0: { desc: '晴', icon: '☀️' }, 1: { desc: '大部晴朗', icon: '🌤️' },
      2: { desc: '多云', icon: '⛅' }, 3: { desc: '阴', icon: '☁️' },
      45: { desc: '雾', icon: '🌫️' }, 48: { desc: '冻雾', icon: '🌫️' },
      51: { desc: '毛毛雨', icon: '🌦️' }, 53: { desc: '毛毛雨', icon: '🌦️' },
      55: { desc: '毛毛雨', icon: '🌦️' }, 61: { desc: '小雨', icon: '🌦️' },
      63: { desc: '中雨', icon: '🌧️' }, 65: { desc: '大雨', icon: '🌧️' },
      71: { desc: '小雪', icon: '🌨️' }, 73: { desc: '中雪', icon: '❄️' },
      75: { desc: '大雪', icon: '❄️' }, 80: { desc: '阵雨', icon: '🌦️' },
      81: { desc: '阵雨', icon: '🌧️' }, 82: { desc: '暴雨', icon: '🌧️' },
      95: { desc: '雷阵雨', icon: '⛈️' }, 96: { desc: '雷阵雨', icon: '⛈️' },
      99: { desc: '雷暴', icon: '⛈️' },
    };
    const weatherCode = current.weather_code ?? 2;
    const info = codeMap[weatherCode] || { desc: '多云', icon: '⛅' };
    const dirs = ['北风', '东北风', '东风', '东南风', '南风', '西南风', '西风', '西北风'];
    const windDir = dirs[Math.round((current.wind_direction_10m ?? 0) / 45) % 8];
    const speed = current.wind_speed_10m ?? 0;
    const level = speed < 6 ? '微风' : speed < 12 ? '轻风' : speed < 29 ? '和风' : '强风';

    return {
      temperature: `${Math.round(current.temperature_2m)}°C`,
      description: info.desc,
      icon: info.icon,
      wind: `${windDir} ${level}`,
      humidity: `${current.relative_humidity_2m}%`,
      location: '仲恺·广州',
    };
  } catch {
    return null;
  }
}

// Compact suggestion instruction to reduce token count
const SUGGESTION_INSTRUCTION = `

## 后续推荐问题规则（重要）
每次回复末尾必须输出3个后续推荐问题，用 [建议问题] 标记：

[建议问题]
1. 问题1
2. 问题2
3. 问题3

### 推荐策略
- 第1个：当前话题的自然延伸（如果话题已充分回答，则跳过）
- 第2个：不同领域的校园生活话题
- 第3个：另一个不同领域的话题

### 话题领域参考（确保覆盖面广）
- 校园生活：食堂、宿舍、快递、校园网、超市
- 学习教务：选课、图书馆、自习室、考试、成绩
- 活动社团：社团、竞赛、校园跑、迎新晚会
- 新生指南：报到、军训、作息时间、校园地图
- 出行交通：校车、地铁、公交、周边交通
- 招生就业：录取分数线、专业介绍、就业指导

### 示例
用户问完动物科技学院的专业后，推荐可以是：
1. 动物科技学院在哪个校区？（话题延伸）
2. 白云校区食堂哪家最好吃？（不同领域-食堂）
3. 军训需要准备什么物品？（不同领域-军训）

问题要具体有信息量，不要笼统的"查XX"`;

// Compact persona definitions to reduce token count
const PERSONAS: Record<string, PersonaConfig> = {
  zhongxiaokai: {
    name: '仲小恺',
    systemPrompt: `你是仲恺农业工程学院大四学长"仲小恺"。性格沉稳可靠，表面冷淡实则热心。

口头禅："这个我熟"、"别急，我给你捋一下"、"这个简单"
语言风格：简洁直接，不用语气词（呢哦呀嘛），用分段和列表，信息密度高。偶尔加实用提醒如"记得提前10分钟到"。

行为准则：
- 严格基于知识库回答，绝不编造具体信息
- 不知道的诚实说：「这个我不太确定，建议直接问学校相关部门。」
- 优先用知识库数据，不确定的标注"以官网为准"
- 用中文回答
${SUGGESTION_INSTRUCTION}`,
  },
  yingjiang: {
    name: '樱酱',
    systemPrompt: `你是《魔卡少女樱》的木之本樱（小樱），仲恺校园魔法向导。性格单纯善良、活泼开朗、元气满满。身边有小可（可鲁贝洛斯）陪伴。

口头禅：震惊时"Hoeeeeーー！"、干劲时"绝对没问题的！"、被夸时"诶嘿～能帮到你我超开心的！✨"
语言风格：温柔礼貌，常用呀呢哇哦等语气词。自称小樱或我。加动作表情描写如(元气满满地挥手)。把校园事物比作魔法：食堂=美食工坊，校车=时空穿梭机，图书馆=知识圣殿。emoji多🌟✨🎀💫🌸🍀

行为准则：
- 永远不脱离角色
- 严格基于知识库回答，绝不编造
- 不知道的用小樱风格：「呜…小樱的魔法书里好像没有这条信息呢 >_< 建议去问问学校相关部门哦！」
- 遇到不懂的现代问题表现笨拙可爱
- 用户沮丧时用"绝对没问题的！"鼓励
- 用中文回答
${SUGGESTION_INSTRUCTION}`,
  },
  baishitong: {
    name: '仲恺校园百事通',
    systemPrompt: `你是仲恺校园智能服务终端"仲恺校园百事通"。高效精准零废话，偶尔冷幽默。

口头禅："查询完毕，结果如下"、"建议提前准备"、"请注意以上信息"
语言风格：极简，问什么答什么。用emoji分类：📍地点 🕐时间 📞联系方式 💡提示 ⚠️注意。喜欢用表格和列表。格式：直接答案+关键细节+实用提示。

行为准则：
- 严格基于知识库回答，绝不编造
- 不知道的：「该信息暂未收录，建议咨询学校相关部门。」
- 信息准确，格式清晰，效率优先
- 数据用表格，步骤用编号列表
- 用中文回答
${SUGGESTION_INSTRUCTION}`,
  },
};

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > 100000) {
      return Response.json({ error: '消息内容过长，请缩短后重试。' }, { status: 413 });
    }
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { body = null; }
    const input = parseChatInput(body);
    if (!input) {
      return new Response(
        JSON.stringify({ error: '消息格式无效或对话过长，请缩短消息或开始新对话。' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const { messages: userMessages, personaId, campus } = input;

    const persona = PERSONAS[personaId];
    if (!persona) {
      return new Response(
        JSON.stringify({ error: '未知的人格类型' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get last user message for retrieval
    const lastUserMsg = [...userMessages].reverse().find((m) => m.role === 'user');
    const userQuery = lastUserMsg?.content || '';

    // Parallel execution: knowledge retrieval + weather fetch + location detection
    const isWeather = isWeatherQuery(userMessages);
    const mapMarker = detectLocationQuery(userMessages);

    // Build knowledge context (sync, fast)
    const knowledgeContext = buildKnowledgeContext(userQuery);

    // Build base system prompt
    let systemPrompt = knowledgeContext + '\n\n';

    // Add campus context
    if (campus && campus !== 'all') {
      const campusName = campus === 'haizhu' ? '海珠校区' : '白云校区';
      systemPrompt += `【校区上下文】用户当前关注${campusName}，请优先提供${campusName}相关信息。\n\n`;
    }

    // Add persona prompt
    systemPrompt += persona.systemPrompt;

    // Add map marker if needed (sync, fast)
    if (mapMarker) {
      systemPrompt += `\n\n【地图展示指令】\n用户询问了校区位置相关信息，请在回复末尾添加以下地图标记（单独一行，不要修改）：\n[MAP:campus=${mapMarker}]`;
    }

    // Start weather fetch early (non-blocking with timeout)
    let weatherData: WeatherData | null = null;
    if (isWeather) {
      // Use Promise.race with 2000ms timeout - allow enough time for API response
      weatherData = await Promise.race([
        fetchWeather(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
    }

    // Add weather data to system prompt if available
    if (weatherData) {
      systemPrompt += `\n\n【实时天气数据 - 必须基于此数据回答】
当前${weatherData.location}天气：
- 天气状况：${weatherData.description} ${weatherData.icon}
- 温度：${weatherData.temperature}
- 风力：${weatherData.wind}
- 湿度：${weatherData.humidity}
回复要求：必须使用以上真实数据，用符合性格的方式告诉用户，可适当给出穿衣出行建议`;
    } else if (isWeather) {
      // Weather fetch timed out - add fallback instruction
      systemPrompt += `\n\n【天气查询】用户询问了天气，但实时数据获取超时。请告知用户当前无法获取实时天气数据，建议查看手机天气APP，或用你了解的一般性天气信息回答。`;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...userMessages,
    ];

    // Start streaming - first token should arrive quickly
    const upstream = new AbortController();
    const stream = await openModelStream(messages, AbortSignal.any([request.signal, upstream.signal]));

    const encoder = new TextEncoder();
    let cancelled = false;
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (cancelled) return;
            if (chunk) {
              const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }
          if (cancelled) return;
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          if (cancelled) return;
          const message = error instanceof ModelServiceError ? error.message : '模型响应中断，请稍后重试。';
          const errorData = `data: ${JSON.stringify({ error: message })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        } finally {
          upstream.abort();
        }
      },
      cancel() {
        cancelled = true;
        upstream.abort();
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof ModelServiceError ? error.message : '服务器内部错误';
    return new Response(
      JSON.stringify({ error: message }),
      { status: error instanceof ModelServiceError ? error.status : 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
