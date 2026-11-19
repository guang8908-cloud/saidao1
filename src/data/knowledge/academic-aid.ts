/**
 * 知识库 - 学业与资助指南
 * 关键词：学分/创新学分/综合测评/综测/资助/助学金/奖学金/困难认定/勤工助学
 */

export const academicAid = {
  id: 'academic-aid',
  title: '学业与资助指南',
  keywords: ['学分', '创新学分', '综合测评', '综测', '资助', '助学金', '奖学金', '困难认定', '勤工助学', '贫困生'],
  content: {
    summary: '课外创新实践学分、综合测评、家庭经济困难认定等学业与资助信息。',

    // 一、课外创新实践学分
    innovationCredits: {
      requirements: {
        undergraduate: '普通本科生须修满4.0学分以上（含4.0）',
        juniorCollege: '专升本学生须修满2.0学分以上（含2.0）',
        note: '未达标者不符合毕业学分要求'
      },
      creditStandards: {
        patent: [
          { item: '成功申请发明专利（每项/人）', credits: 2.0 },
          { item: '获得国家授权发明专利（每项/人）', credits: 4.0 },
          { item: '申请实用新型专利或著作权登记（每项/人）', credits: 1.0 },
          { item: '获得实用新型专利授权（每项/人）', credits: 3.0 }
        ],
        paper: [
          { item: '正式刊物公开发表（第一作者）', credits: 2.0 },
          { item: 'SCI/EI/SSCI/CSSCI收录期刊（第一作者）', credits: 4.0 },
          { item: '第二、三作者', credits: '减半' }
        ],
        innovationProject: [
          { item: '国家级立项（前三名）', credits: 2.0 },
          { item: '国家级结题验收（全体成员）', credits: 4.0 },
          { item: '省级立项（前三名）', credits: 1.0 },
          { item: '省级结题验收（全体成员）', credits: 2.0 },
          { item: '校级立项（前三名）', credits: 0.5 },
          { item: '校级结题验收（全体成员）', credits: 1.0 }
        ],
        climbPlan: [
          { item: '立项（前三名）', credits: 2.0 },
          { item: '结题验收（全体成员）', credits: 3.0 }
        ],
        competition: {
          national: [
            { item: '一等奖以上', credits: 4.0 },
            { item: '二等奖', credits: 3.5 },
            { item: '三等奖', credits: 3.0 },
            { item: '优秀奖/完成竞赛', credits: 2.5 }
          ],
          provincial: [
            { item: '一等奖以上', credits: 3.0 },
            { item: '二等奖', credits: 2.5 },
            { item: '三等奖', credits: 2.0 },
            { item: '优秀奖/完成竞赛', credits: 1.5 }
          ],
          school: [
            { item: '一等奖', credits: 1.0 },
            { item: '二等奖', credits: 0.8 },
            { item: '三等奖', credits: 0.5 },
            { item: '优秀奖/完成竞赛', credits: 0.3 }
          ]
        }
      },
      notes: [
        '同一项目获多项奖励，按最高级别计分，不重复计算',
        '集体项目由负责人根据贡献分配学分',
        '学科竞赛/文艺体竞赛以学校认定目录为准',
        '具体认定由各学院成立工作小组负责'
      ]
    },

    // 二、综合测评（数科院）
    comprehensiveEvaluation: {
      target: '2023-2025级在校本科生（2025-2026学年）',
      procedure: [
        '个人自评：实事求是地填写自评表格',
        '班级互评：针对思想品德基础分6个方面，班内成员互评',
        '评议与评分：班级综合测评评议小组（班主任+班长+团支书+学生代表）逐项评分',
        '审核：学院综合测评工作小组审核',
        '公示：向全院学生公示5个工作日',
        '答辩：推荐1人参加学校特等奖学金评选答辩',
        '评优：按比例推荐一、二、三等奖学金'
      ],
      schedule: {
        deadline: '9月3日前',
        submitMaterials: '提交测评汇总表、特等奖学金申请材料',
        namingFormat: '按"班级+附件名称"格式命名',
        email: '3061809589@qq.com',
        paperSubmission: '纸质版递交至院办618室张素雅老师处'
      },
      notes: [
        '学生干部组织职责范围内活动属本职工作，不重复加分',
        '网络刷题、宣传转载等轻易获取的证书一般不加分',
        '转专业学生在原学院原专业年级参加测评'
      ],
      contact: {
        name: '张素雅',
        phone: '020-36076134'
      }
    },

    // 三、家庭经济困难学生认定
    financialAid: {
      target: '家庭经济能力难以满足在校学习、生活基本支出的在校本科生',
      significance: [
        '是开展各类奖助学金评选、勤工助学的重要依据',
        '未通过认定者，不能获得国家助学金及其他以家庭经济困难为前提的资助'
      ],
      procedure: [
        '个人申请：如实填写《广东省家庭经济困难学生认定申请表》《家庭经济困难学生认定分析表》《家庭经济信息录入模板》，提供相关证明材料',
        '班级审查：班主任任组长，班长、团支书、学生代表组成认定小组，审查材料真实性',
        '学院审核：学院认定工作小组（不少于10人）汇总审核，初评打分，公示3个工作日',
        '学校审核：导入"全国学生资助管理信息系统"，确定全校名单',
        '结果公示：全校公示5个工作日'
      ],
      schedule: {
        deadline: '8月31日前',
        emailSubmission: '学生提交电子版材料至 zhkjskx@126.com',
        paperSubmission: '纸质版交至院办618张素雅老师处',
        namingFormat: '材料命名格式："班级+困难认定材料"'
      },
      references: [
        '《广东省家庭经济困难学生认定工作实施办法》（粤教助〔2023〕2号）',
        '《仲恺农业工程学院家庭经济困难学生认定与管理办法》（仲学字〔2021〕39号）'
      ]
    },

    source: '仲教字〔2024〕46号、数科学字〔2026〕8号、数科学字〔2026〕9号'
  }
};

export default academicAid;
