/**
 * 知识库按需检索模块
 * 根据用户消息中的关键词，匹配并返回最相关的1-3个知识库板块
 */

import { canteenGuide } from '@/data/knowledge/canteen-guide';
import { libraryGuide } from '@/data/knowledge/library-guide';
import { academicCalendar } from '@/data/knowledge/academic-calendar';
import { deliveryGuide } from '@/data/knowledge/delivery-guide';
import { zhongnongMilk } from '@/data/knowledge/zhongnong-milk';
import { campusMapGuide } from '@/data/knowledge/campus-map-guide';
import { adminProcess } from '@/data/knowledge/admin-process';
import { academicAid } from '@/data/knowledge/academic-aid';
import { summerVacation } from '@/data/knowledge/summer-vacation';
import { majors } from '@/data/knowledge/majors';
import { campusLife } from '@/data/knowledge/campus-life';
import { militaryTraining } from '@/data/knowledge/military-training';
import { schedule } from '@/data/knowledge/schedule';
import { campusServices } from '@/data/knowledge/campus-services';
import { sports } from '@/data/knowledge/sports';
import { freshmanBaiyun } from '@/data/knowledge/freshman-baiyun';
import { freshmanHaizhu } from '@/data/knowledge/freshman-haizhu';
import { schoolOverview } from '@/data/knowledge/school-overview';
import { dormitory } from '@/data/knowledge/dormitory';
import { admissionsGuide } from '@/data/knowledge/admissions';
import { infoSystemsGuide } from '@/data/knowledge/info-systems';
import { announcementsGuide } from '@/data/knowledge/announcements';
import { clubCompetitionGuide } from '@/data/knowledge/club-competition';

// ============================================================
// 板块定义：id、标题、关键词、内容获取函数
// ============================================================
interface KnowledgeSection {
  id: string;
  title: string;
  keywords: string[];
  getContent: () => string;
}

/**
 * 将知识库对象序列化为可读文本
 */
function serializeContent(obj: unknown, indent = 0): string {
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    return obj.map((item) => serializeContent(item, indent)).join('、');
  }
  if (typeof obj === 'object') {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value === null || value === undefined || value === '') continue;
      // Skip metadata fields
      if (['id', 'title', 'keywords', 'summary', 'note', 'disclaimer'].includes(key)) continue;
      const prefix = ' '.repeat(indent);
      const serialized = serializeContent(value, indent + 2);
      if (serialized) {
        lines.push(`${prefix}${key}: ${serialized}`);
      }
    }
    return lines.join('\n');
  }
  return '';
}

// Max characters per knowledge section to avoid token bloat
// Reduced from 4000 to 3000 for faster LLM response
const MAX_SECTION_CHARS = 3000;

/**
 * Truncate content to max length, preserving start and end
 */
function truncateContent(content: string, maxChars: number = MAX_SECTION_CHARS): string {
  if (content.length <= maxChars) return content;
  const half = Math.floor(maxChars / 2);
  return content.slice(0, half) + '\n...[内容已精简]...\n' + content.slice(-half);
}

/**
 * 从知识库对象提取完整内容文本
 */
function extractFullContent(kb: { title: string; content: Record<string, unknown> }): string {
  const parts: string[] = [`## ${kb.title}`];

  // Add summary if exists
  const content = kb.content;
  if (content.summary) {
    parts.push(content.summary as string);
  }
  if (content.note) {
    parts.push(`> 备注：${content.note}`);
  }
  if (content.disclaimer) {
    parts.push(`> ${content.disclaimer}`);
  }

  // Serialize the rest
  const serialized = serializeContent(content);
  if (serialized) {
    parts.push(truncateContent(serialized));
  }

  return parts.join('\n');
}

// ============================================================
// 所有知识库板块注册表
// ============================================================
const KNOWLEDGE_SECTIONS: KnowledgeSection[] = [
  {
    id: 'canteen-guide',
    title: '食堂指南',
    keywords: ['食堂', '吃饭', '餐', '饭', '菜', '餐厅', '就餐', '早餐', '午餐', '晚餐', '饭堂', '用餐', '饿了', '好吃', '美食', '外卖', '甘葡园', '春晖园', '多功能食堂'],
    getContent: () => truncateContent(canteenGuide.content),
  },
  {
    id: 'library-guide',
    title: '图书馆指南',
    keywords: ['图书馆', '借书', '还书', '自习', '座位', '阅览室', '藏书', '借阅', '开馆', '闭馆', '自习室'],
    getContent: () => truncateContent(libraryGuide.content),
  },
  {
    id: 'academic-calendar',
    title: '校历与学期安排',
    keywords: ['校历', '开学', '放假', '学期', '周次', '教学周', '寒假', '暑假', '注册', '报到', '考试周'],
    getContent: () => extractFullContent(academicCalendar),
  },
  {
    id: 'delivery-guide',
    title: '快递收货地址与驿站',
    keywords: ['快递', '驿站', '收货', '外卖', '取件', '寄件', '菜鸟', '丰巢', '地址', '邮编'],
    getContent: () => truncateContent(deliveryGuide.content),
  },
  {
    id: 'zhongnong-milk',
    title: '仲浓牛奶',
    keywords: ['牛奶', '仲浓', '酸奶', '奶制品', '乳制品', '鲜奶'],
    getContent: () => extractFullContent(zhongnongMilk),
  },
  {
    id: 'campus-map-guide',
    title: '校园地图导览',
    keywords: campusMapGuide.keywords,
    getContent: () => truncateContent(campusMapGuide.content),
  },
  {
    id: 'admin-process',
    title: '办事流程指南',
    keywords: ['办事', '打印', '学生证', '转专业', '重修', '缓考', '请假', '证明', '盖章', '补办', '注销', '退学', '休学', '复学'],
    getContent: () => extractFullContent(adminProcess),
  },
  {
    id: 'academic-aid',
    title: '学业与资助指南',
    keywords: ['学分', '综测', '资助', '奖学金', '助学金', '贷款', '勤工', '学费', '减免', '绩点', '挂科', '补考', '毕业', '学位'],
    getContent: () => extractFullContent(academicAid),
  },
  {
    id: 'summer-vacation',
    title: '暑假留校指南',
    keywords: ['暑假', '留校', '假期', '报修', '通勤车', '暑期', '假期服务'],
    getContent: () => summerVacation.content as string,
  },
  {
    id: 'majors',
    title: '本科专业信息',
    keywords: ['专业', '院系', '学院', '本科', '招生', '学科', '学位', '专业代码'],
    getContent: () => extractFullContent(majors),
  },
  {
    id: 'campus-life',
    title: '校园生活指南与选课评价',
    keywords: [
      // 教务系统相关
      '教务', '教务系统', '成绩', '课表', '报名', '选课系统', '常用链接', '官网', '教务链接',
      // 选课评价相关
      '选课', '课程评价', '课评', '避雷', '推荐课', '水课', '好过', '给分',
      // 通用课程关键词
      '老师', '签到', '作业', '期末', '考试', '点名', '论文', 'PPT',
      // 具体课程名（高频查询）
      '茶艺', '茶文化', '影视', '英语影视', '食用菌', '高尔夫', '韩国语',
      '草原文化', '趣味生物', '趣味鱼类', '食品营养', '蔬菜', '野生观赏',
      '马克思主义', '西方大学', '乡村治理', '乡音乡情', '设计创意',
      '乒乓球', '酒文化', '迷你', '雄飞', '网络课', '艺术导论',
      '中美关系', '经济思想', '耕读', 'TED', '走进故宫', '城市绿脉'
    ],
    getContent: () => extractFullContent(campusLife),
  },
  {
    id: 'military-training',
    title: '军训指南',
    keywords: militaryTraining.keywords,
    getContent: () => truncateContent(militaryTraining.content),
  },
  {
    id: 'schedule',
    title: '作息时间表',
    keywords: schedule.keywords,
    getContent: () => truncateContent(schedule.content),
  },
  {
    id: 'campus-services',
    title: '校园生活服务',
    keywords: campusServices.keywords,
    getContent: () => truncateContent(campusServices.content),
  },
  {
    id: 'sports',
    title: '校园跑与运动',
    keywords: sports.keywords,
    getContent: () => truncateContent(sports.content),
  },
  {
    id: 'freshman-baiyun',
    title: '白云校区新生报到',
    keywords: freshmanBaiyun.keywords,
    getContent: () => truncateContent(freshmanBaiyun.content),
  },
  {
    id: 'freshman-haizhu',
    title: '海珠校区新生报到',
    keywords: freshmanHaizhu.keywords,
    getContent: () => truncateContent(freshmanHaizhu.content),
  },
  {
    id: 'school-overview',
    title: '学校概况与校史',
    keywords: schoolOverview.keywords,
    getContent: () => truncateContent(schoolOverview.content),
  },
  {
    id: 'dormitory',
    title: '宿舍与水电指南',
    keywords: dormitory.keywords,
    getContent: () => truncateContent(dormitory.content),
  },
  {
    id: 'admissions',
    title: '招生与就业信息',
    keywords: admissionsGuide.keywords,
    getContent: () => truncateContent(admissionsGuide.content),
  },
  {
    id: 'info-systems',
    title: '信息系统与机构设置',
    keywords: infoSystemsGuide.keywords,
    getContent: () => truncateContent(infoSystemsGuide.content),
  },
  {
    id: 'announcements',
    title: '通知公告与科研动态',
    keywords: announcementsGuide.keywords,
    getContent: () => truncateContent(announcementsGuide.content),
  },
  {
    id: 'club-competition',
    title: '社团与竞赛活动',
    keywords: clubCompetitionGuide.keywords,
    getContent: () => truncateContent(clubCompetitionGuide.content),
  },
];

// ============================================================
// 基础知识库（始终注入）
// ============================================================
const BASE_KNOWLEDGE = `
## 仲恺农业工程学院基本信息
- 全称：仲恺农业工程学院（Zhongkai University of Agriculture and Engineering）
- 英文缩写：ZHKU
- 办学性质：省属公办全日制普通高等学校（广东省人民政府举办）
- 定位：以农、工学科为优势，农、工、理、经、管、文、艺、法多学科协调发展
- 校训：注重实践、扶助农工
- 校庆日：1927年（前身仲恺农工学校正式招生年份）
- 海珠校区：广东省广州市海珠区东沙街24号
- 白云校区：广东省广州市白云区广从八路1188号
- 占地面积：1600余亩
- 电话：020-89003030
- 全日制在校生约1.7万多人，教职员工近1700人
- ESI全球排名前1%学科4个（食品科学与工程、兽医学、农学、生物学）
- 开设本科专业65+个
- 22个二级学院
`;

// ============================================================
// 检索函数
// ============================================================

/**
 * 根据用户消息检索匹配的知识库板块
 * @param userMessage 用户最新消息文本
 * @returns 匹配的知识库板块内容数组（1-3个）
 */
export function retrieveKnowledge(userMessage: string): string[] {
  if (!userMessage || userMessage.trim().length === 0) {
    return [BASE_KNOWLEDGE];
  }

  const text = userMessage.toLowerCase();

  // Score each section by keyword match count
  const scored = KNOWLEDGE_SECTIONS.map((section) => {
    let score = 0;
    for (const keyword of section.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        // Longer keywords get higher weight
        score += keyword.length;
      }
    }
    return { section, score };
  });

  // Filter sections with score > 0 and sort by score descending
  const matched = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  // Return top 1-3 matched sections
  const topMatches = matched.slice(0, 3);

  if (topMatches.length === 0) {
    // No match, return base knowledge only
    return [BASE_KNOWLEDGE];
  }

  // Always include base knowledge + matched sections
  return [BASE_KNOWLEDGE, ...topMatches.map((item) => item.section.getContent())];
}

/**
 * 将检索到的知识库板块合并为注入文本
 * @param userMessage 用户消息
 * @returns 格式化的知识库文本
 */
export function buildKnowledgeContext(userMessage: string): string {
  const sections = retrieveKnowledge(userMessage);

  const header = '以下是仲恺农业工程学院的知识库，请基于这些信息回答校园相关问题：';
  const content = sections.join('\n\n---\n\n');

  return `${header}\n\n${content}`;
}
