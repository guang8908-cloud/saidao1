/**
 * 知识库 - 本科专业信息
 * 关键词：专业/院系/学院/本科/招生/学科/学位
 */

export const majors = {
  id: 'majors',
  title: '本科专业信息',
  keywords: ['专业', '院系', '学院', '本科', '招生', '学科', '学位', '选课'],
  content: {
    summary: '仲恺农业工程学院本科专业列表，按学院分类，共65+个专业。',

    // 农业与生物学院
    agricultureBiology: {
      college: '农业与生物学院',
      majors: [
        { code: '090101', name: '农学', degree: '农学', year: 1990 },
        { code: '090103', name: '植物保护', degree: '农学', year: 1993 },
        { code: '090105', name: '种子科学与工程', degree: '农学', year: 2012 },
        { code: '071002', name: '生物技术', degree: '理学', year: 2002 },
        { code: '071001', name: '生物科学', degree: '理学', year: 2005 },
        { code: '100806T', name: '中草药栽培与鉴定', degree: '理学', year: 2020 }
      ]
    },

    // 园艺园林学院
    horticulture: {
      college: '园艺园林学院',
      majors: [
        { code: '090102', name: '园艺', degree: '农学', year: 1987 },
        { code: '090502', name: '园林', degree: '农学', year: 1987 },
        { code: '090701', name: '草业科学', degree: '农学', year: 2000 },
        { code: '090501', name: '林学', degree: '农学', year: 2020 }
      ]
    },

    // 轻工食品学院
    foodEngineering: {
      college: '轻工食品学院',
      majors: [
        { code: '082701', name: '食品科学与工程', degree: '工学', year: 1989 },
        { code: '082702', name: '食品质量与安全', degree: '工学', year: 2004 },
        { code: '083001', name: '生物工程', degree: '工学', year: 2005 },
        { code: '081702', name: '包装工程', degree: '工学', year: 2007 },
        { code: '082710T', name: '食品营养与健康', degree: '工学', year: 2021 }
      ]
    },

    // 动物科技学院
    animalScience: {
      college: '动物科技学院',
      majors: [
        { code: '090301', name: '动物科学', degree: '农学', year: 2004 },
        { code: '090601', name: '水产养殖学', degree: '农学', year: 2012 },
        { code: '090401', name: '动物医学', degree: '农学', year: 2017 },
        { code: '090604TK', name: '水生动物医学', degree: '农学', year: 2020 }
      ]
    },

    // 经贸学院
    economicsTrade: {
      college: '经贸学院',
      majors: [
        { code: '120301', name: '农林经济管理', degree: '管理学', year: 1993 },
        { code: '020401', name: '国际经济与贸易', degree: '经济学', year: 2003 },
        { code: '020304', name: '投资学', degree: '经济学', year: 2009 },
        { code: '120903', name: '会展经济与管理', degree: '管理学', year: 2012 }
      ]
    },

    // 管理学院
    management: {
      college: '管理学院',
      majors: [
        { code: '120204', name: '财务管理', degree: '管理学', year: 1996 },
        { code: '120202', name: '市场营销', degree: '管理学', year: 2002 },
        { code: '120201K', name: '工商管理', degree: '管理学', year: 2003 },
        { code: '120206', name: '人力资源管理', degree: '管理学', year: 2004 },
        { code: '120203K', name: '会计学', degree: '管理学', year: 2004 }
      ]
    },

    // 人工智能学院
    aiCollege: {
      college: '人工智能学院',
      majors: [
        { code: '080901', name: '计算机科学与技术', degree: '工学', year: 2002 },
        { code: '120102', name: '信息管理与信息系统', degree: '工学', year: 2003 },
        { code: '080701', name: '电子信息工程', degree: '工学', year: 2003 },
        { code: '080903', name: '网络工程', degree: '工学', year: 2004 },
        { code: '080905', name: '物联网工程', degree: '工学', year: 2012 },
        { code: '080717T', name: '人工智能', degree: '工学', year: 2026 },
        { code: '080703', name: '通信工程', degree: '工学', year: 2005 },
        { code: '080910T', name: '数据科学与大数据技术', degree: '工学', year: 2019 }
      ]
    },

    // 外国语学院
    foreignLanguages: {
      college: '外国语学院',
      majors: [
        { code: '050201', name: '英语', degree: '文学', year: 2004 },
        { code: '050207', name: '日语', degree: '文学', year: 2005 },
        { code: '050262', name: '商务英语', degree: '文学', year: 2012 }
      ]
    },

    // 机电工程学院
    mechanicalEngineering: {
      college: '机电工程学院',
      majors: [
        { code: '080501', name: '能源与动力工程', degree: '工学', year: 1998 },
        { code: '080202', name: '机械设计制造及其自动化', degree: '工学', year: 2005 },
        { code: '080204', name: '机械电子工程', degree: '工学', year: 2007 },
        { code: '082301', name: '农业工程', degree: '工学', year: 2020 }
      ]
    },

    // 何香凝艺术设计学院
    artDesign: {
      college: '何香凝艺术设计学院',
      majors: [
        { code: '130503', name: '环境设计', degree: '艺术学', year: 2003 },
        { code: '130502', name: '视觉传达设计', degree: '艺术学', year: 2003 },
        { code: '130504', name: '产品设计', degree: '艺术学', year: 2006 },
        { code: '130508', name: '数字媒体艺术', degree: '艺术学', year: 2021 }
      ]
    },

    // 化工与材料学院
    chemicalMaterial: {
      college: '化工与材料学院',
      majors: [
        { code: '070302', name: '应用化学', degree: '工学', year: 2004 },
        { code: '080407', name: '高分子材料与工程', degree: '工学', year: 2005 },
        { code: '081301', name: '化学工程与工艺', degree: '工学', year: 2006 },
        { code: '080403', name: '材料化学', degree: '工学', year: 2009 }
      ]
    },

    // 资源与环境学院
    resourceEnvironment: {
      college: '资源与环境学院',
      majors: [
        { code: '082502', name: '环境工程', degree: '工学', year: 2001 },
        { code: '082503', name: '环境科学', degree: '理学', year: 2006 },
        { code: '082506T', name: '资源环境科学', degree: '理学', year: 2013 },
        { code: '090205T', name: '土地科学与技术', degree: '农学', year: 2024 },
        { code: '082501', name: '环境科学与工程', degree: '工学', year: 2026 }
      ]
    },

    // 数学与数据科学学院
    mathDataScience: {
      college: '数学与数据科学学院',
      majors: [
        { code: '070102', name: '信息与计算科学', degree: '理学', year: 2005 },
        { code: '071201', name: '统计学', degree: '理学', year: 2007 }
      ]
    },

    // 城乡建设学院
    urbanRuralConstruction: {
      college: '城乡建设学院',
      majors: [
        { code: '082802', name: '城乡规划', degree: '工学', year: 2003 },
        { code: '081003', name: '给排水科学与工程', degree: '工学', year: 2005 },
        { code: '081001', name: '土木工程', degree: '工学', year: 2006 }
      ]
    },

    // 自动化学院
    automation: {
      college: '自动化学院',
      majors: [
        { code: '080801', name: '自动化', degree: '工学', year: 2007 },
        { code: '080601', name: '电气工程及其自动化', degree: '工学', year: 2014 },
        { code: '080803T', name: '机器人工程', degree: '工学', year: 2019 }
      ]
    },

    // 人文与社会科学学院（部分，原文被截断）
    humanities: {
      college: '人文与社会科学学院',
      majors: [
        { code: '120402', name: '行政管理', degree: '管理学', year: 2006 }
        // 注：原文被截断，后续专业待补充
      ]
    }
  }
};

export default majors;
