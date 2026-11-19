/**
 * 知识库 - 办事流程指南
 * 关键词：办事/打印/流程/学生证/休学/复学/转专业/选课/重修/就业/档案
 */

export const adminProcess = {
  id: 'admin-process',
  title: '办事流程指南',
  keywords: ['办事', '打印', '流程', '学生证', '休学', '复学', '转专业', '选课', '重修', '补选', '缓考', '就业', '档案', '成绩单', '教务处', '物资'],
  content: {
    summary: '学生证补办、学籍异动、选课操作、就业协议、自助打印等常见办事流程指南。',
    studentId: {
      replacement: {
        steps: [
          '下载并填写《补办学生证申请表》（教务处网站下载）',
          '所在学院审核盖章',
          '到教务处办理补办手续'
        ]
      },
      registration: {
        requirement: '每学年第一学期需缴清费用后方能注册',
        method: '凭学生证到所在教学单位办公室办理'
      }
    },
    academicStatus: {
      suspension: {
        steps: [
          '填写《休学申请表》',
          '导师/辅导员签署意见',
          '所在学院审核',
          '报教务处/研究生处审批'
        ]
      },
      resumption: {
        method: '休学期满前向学院提出申请',
        note: '因病休学需附医院健康证明'
      },
      majorTransfer: {
        rule: '按照《仲恺农业工程学院普通本科学生转专业实施细则》执行',
        form: '需填写《转专业退转申请表》'
      }
    },
    exam: {
      deferral: {
        condition: '因特殊原因不能参加考试，需提前申请缓考',
        form: '填写《缓考申请表》'
      },
      gradeQuery: {
        method: '通过学校教务系统查询',
        gpa: '绩点计算：按学校《绩点与课程说明》执行'
      }
    },
    courseSelection: {
      login: {
        web: 'https://edu-admin.zhku.edu.cn',
        mobile: '企业微信工作台或微信小程序"仲事易" → 点击教务系统登录',
        account: '学号',
        initialPassword: 'Zhku+身份证号后六位'
      },
      schedule: {
        majorElective: '6月15日-17日（面向2023-2025级）',
        generalElective: {
          grade2023: '6月18日-21日',
          grade2024: '6月22日-24日',
          grade2025: '6月24日-26日（同时选《体育III》）'
        },
        addDrop: '正选结束后安排，选课人数不足30人的课程仅可补选不可退选'
      },
      rules: [
        '通识选修课每学期学分上限为4学分',
        '网络通识选修课累计上限：2023级最高6学分，2024/2025级最高4学分',
        '所选课程上课时间不得与必修课或实习冲突',
        '选课后须按时上课并参加考核，缺课或缺考成绩按"0"分计',
        '同一门通识选修课跨学期重复修读仅认定第一次成绩',
        '选课/退课/改选须在年级规定时间内完成',
        '选课人数不足30人的通识选修课不予开设',
        '建议在8月30日后打印最终版课表核对'
      ],
      operationSteps: [
        '登录教务系统 → 点击【学生选课中心】',
        '点击"进入选课" → 查看选课学分及课程门数限制',
        '选择课程 → 提交选课',
        '在选课结果查询页面确认选课成功',
        '选课后及时退出登录'
      ],
      consultation: {
        contacts: ['温老师、林老师：89003074', '李老师：89003038']
      },
      addCourse: {
        method: '课程错过选课时间可申请补选',
        form: '填写《课程补选申请表》，提交至教务处审批',
        note: '需说明补选原因（如漏选、课程调整等）'
      },
      retake: {
        condition: '课程不及格可在下一学期申请重修',
        form: '填写《课程重修申请表》'
      }
    },
    employment: {
      agreement: {
        platform: '"广东大学生就业创业"微信公众号',
        steps: [
          '填报信息',
          '学院审核 → 学校审核 → 用人单位签章',
          '拍照上传 → 学院审核 → 学校审核、盖电子章'
        ]
      },
      archive: {
        platform: '"广东大学生就业创业"微信小程序',
        module: '档案转递查询模块'
      }
    },
    officeLocations: {
      academicAffairs: '海珠校区行政楼',
      studentAffairs: '海珠校区',
      collegeOffices: '所在校区',
      mathScienceSupplies: '数科院楼601、617室',
      selfServicePrinter: '白云校区图书馆二楼'
    },
    materialBorrowing: {
      location: '数科院楼601、617室',
      handoverTime: '下午16:50之后',
      process: [
        '提前沟通：提前2-3个工作日联系团学办公室，说明所在组织/班级、所办活动、举办时间、所需物资及借用时间，询问物资是否空闲',
        '登记确认：经办公室登记后，提前与当周轮值干事约定交接时间',
        '现场借取：到物资室填写物资借用表（借出部分），签字后拿取物资',
        '归还物资：活动结束后提前1-2天联系轮值干事约定归还时间，双方到场清点、检查、归还，填写归还部分'
      ],
      notes: [
        '借取物资需轻拿轻放，不可损坏物资',
        '禁止擅自转借给第三方',
        '借取物资必须经过办公室同意，否则后果自负',
        '无故超时归还严重者，将联系指导老师/辅导员处理',
        '特殊情况经学院老师同意后可跳过流程借出'
      ],
      contacts: {
        mainContacts: ['谢雅慧（15626171938）', '张丽桦（14754597374）'],
        directors: ['刘明浩（13711297686）', '李睿楠（18023583915）'],
        secretary: '石宇聪（18320234886）',
        reminder: '请勿在上课时间打电话借物资'
      }
    },
    selfServicePrinting: {
      location: '白云校区图书馆二楼',
      materials: ['中文成绩单', '英文成绩单'],
      loginMethods: [
        '身份证+人脸识别登录',
        '身份证刷卡登录',
        '账号密码登录（初始密码为身份证后六位）'
      ],
      pricing: {
        currentStudents: '累计5份免费（含中文+英文），超出后收费',
        graduates: '无免费打印额度',
        chinese: '20元/份',
        english: '40元/份'
      },
      operationSteps: [
        '登录终端',
        '选择材料类型',
        '预览核对',
        '确认份数提交',
        '缴费（如需）',
        '取件退出'
      ],
      troubleshooting: {
        method: '终端页面"故障报修"功能提交',
        complaintPhone: '020-89003071'
      }
    }
  }
};

export default adminProcess;
