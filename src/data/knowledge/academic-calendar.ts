/**
 * 知识库 - 校历与学期安排
 * 关键词：校历/开学/放假/学期/暑假/寒假/上课/考试
 */

export const academicCalendar = {
  id: 'calendar',
  title: '校历与学期安排',
  keywords: ['校历', '开学', '放假', '学期', '暑假', '寒假', '上课', '考试', '注册', '报到', '期末', '期中', '课程表', '时间'],
  content: {
    summary: '仲恺农业工程学院校历与学期安排，包含开学时间、放假安排、重要时间节点等。',
    semester2026_2027_1: {
      name: '2026-2027学年第一学期',
      startDate: '2026年8月31日（星期一）正式上课',
      registrationDate: '2026年8月29日、8月30日',
      staffStartDate: '2026年8月24日（星期一）',
      totalWeeks: '2026年8月24日 — 2027年1月17日，共21周'
    },
    summer2026: {
      period: '2026年7月20日 — 8月30日，共6周',
      campusServices: '食堂、图书馆、教学楼等正常开放（有限服务）'
    },
    importantDates: {
      freshmanRegistration: '每年9月初（具体以录取通知书为准）',
      finalExams: '每学期第18-20周',
      holidays: '按国家法定节假日安排'
    },
    semesterStructure: {
      teachingWeeks: '每学期通常分为教学周（约18周）和考试周（约2周）',
      semestersPerYear: '每学年分为秋季学期和春季学期'
    },
    classHours: {
      morning: '上午：8:00 - 12:00',
      afternoon: '下午：14:00 - 17:30',
      evening: '晚上：19:00 - 21:00（部分课程）'
    },
    source: '仲恺农业工程学院校历及暑假通知'
  }
};

export default academicCalendar;
