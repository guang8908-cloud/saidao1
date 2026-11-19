// 校园POI数据文件
// 包含海珠校区和白云校区的兴趣点数据

import type { CampusId } from '@/lib/campus-data';

// POI类型定义
export type POIType = 'teaching' | 'canteen' | 'dorm' | 'express' | 'gate' | 'sports' | 'other';

// POI类别配置
export interface POICategoryConfig {
  name: string;
  color: string;
  icon: string;
  label: string;
}

// POI数据接口
export interface CampusPOI {
  name: string;
  type: POIType;
  lat: number;
  lng: number;
  desc: string;
  campus: 'haizhu' | 'baiyun';
}

// POI类别配置
export const POI_CATEGORIES: Record<POIType, POICategoryConfig> = {
  teaching: { name: '教学楼', color: '#3B82F6', icon: '🏫', label: '教学楼' },
  canteen: { name: '食堂', color: '#F59E0B', icon: '🍜', label: '食堂' },
  dorm: { name: '宿舍', color: '#10B981', icon: '🏠', label: '宿舍' },
  express: { name: '快递站', color: '#8B5CF6', icon: '📦', label: '快递站' },
  gate: { name: '校门', color: '#EF4444', icon: '🚪', label: '校门' },
  sports: { name: '运动场', color: '#06B6D4', icon: '⚽', label: '运动场' },
  other: { name: '其他', color: '#6B7280', icon: '📍', label: '其他' },
};

// 海珠校区POI数据
const HAIZHU_POIS: CampusPOI[] = [
  // 教学楼/学术建筑
  { name: '主教学楼', type: 'teaching', lat: 23.1068, lng: 113.2810, desc: '与行政楼相连，海珠校区主要教学区', campus: 'haizhu' },
  { name: '英东实验大楼', type: 'teaching', lat: 23.1075, lng: 113.2818, desc: '食品学院等实验室所在地', campus: 'haizhu' },
  { name: '何香凝艺术设计学院', type: 'teaching', lat: 23.1055, lng: 113.2825, desc: '艺术设计专业教学楼', campus: 'haizhu' },
  { name: '科学楼', type: 'teaching', lat: 23.1062, lng: 113.2805, desc: '科研办公楼', campus: 'haizhu' },
  { name: '国际教育学院(30栋)', type: 'teaching', lat: 23.1040, lng: 113.2835, desc: 'TOEFL/GRE考场，从北门步行约3分钟', campus: 'haizhu' },

  // 饭堂
  { name: '北区饭堂(煦苑)', type: 'canteen', lat: 23.1072, lng: 113.2800, desc: '两层饭堂，靠近何香凝学院，重新装修，智能取餐显示卡路里', campus: 'haizhu' },
  { name: '南区饭堂', type: 'canteen', lat: 23.1045, lng: 113.2795, desc: '位于D栋1-2楼，翻新过，二楼有电视，旁边有快递站', campus: 'haizhu' },

  // 宿舍
  { name: '南区A栋', type: 'dorm', lat: 23.1040, lng: 113.2785, desc: '6人间，有空调独卫', campus: 'haizhu' },
  { name: '南区D栋', type: 'dorm', lat: 23.1045, lng: 113.2800, desc: '14层电梯公寓，5人间，独立卫浴，1-2楼是饭堂', campus: 'haizhu' },
  { name: '北区6栋', type: 'dorm', lat: 23.1078, lng: 113.2795, desc: '6人间，距教学楼饭堂最近', campus: 'haizhu' },
  { name: '北区7-8栋', type: 'dorm', lat: 23.1080, lng: 113.2790, desc: '6人间，楼下有热水充值机', campus: 'haizhu' },

  // 快递站
  { name: '南区快递站(校园通)', type: 'express', lat: 23.1048, lng: 113.2798, desc: '南区饭堂隔壁，取快递+充校园卡', campus: 'haizhu' },
  { name: '北区快递点', type: 'express', lat: 23.1070, lng: 113.2805, desc: '靠近北区饭堂区域', campus: 'haizhu' },

  // 校门
  { name: '北门(正门)', type: 'gate', lat: 23.1070, lng: 113.2810, desc: '东沙街24号，主要出入口', campus: 'haizhu' },
  { name: '南门', type: 'gate', lat: 23.1040, lng: 113.2815, desc: '仲恺路501号，出校门有公交站', campus: 'haizhu' },
  { name: '东南门', type: 'gate', lat: 23.1045, lng: 113.2835, desc: '靠近仲恺路', campus: 'haizhu' },

  // 运动场
  { name: '操场/足球场', type: 'sports', lat: 23.1065, lng: 113.2785, desc: '英东楼左边，可跑步散步', campus: 'haizhu' },
  { name: '北区篮球场', type: 'sports', lat: 23.1080, lng: 113.2800, desc: '6-8栋附近', campus: 'haizhu' },
  { name: '南区篮球场/网球场', type: 'sports', lat: 23.1035, lng: 113.2780, desc: 'A栋附近，含匹克球场', campus: 'haizhu' },

  // 其他
  { name: '图书馆', type: 'other', lat: 23.1070, lng: 113.2815, desc: '英东楼与教学楼之间，藏书丰富', campus: 'haizhu' },
  { name: '廖仲恺何香凝纪念馆', type: 'other', lat: 23.1060, lng: 113.2820, desc: '入学第一课参观地点', campus: 'haizhu' },
  { name: '校医室', type: 'other', lat: 23.1055, lng: 113.2810, desc: '校内医疗服务', campus: 'haizhu' },
];

// 白云校区POI数据
const BAIYUN_POIS: CampusPOI[] = [
  // 教学楼
  { name: '何鸿燊实验楼A座', type: 'teaching', lat: 23.1915, lng: 113.4040, desc: '主要实验教学楼', campus: 'baiyun' },
  { name: '何鸿燊实验楼B座', type: 'teaching', lat: 23.1918, lng: 113.4035, desc: '主要实验教学楼', campus: 'baiyun' },
  { name: '曾宪梓楼', type: 'teaching', lat: 23.1920, lng: 113.4050, desc: '教学楼', campus: 'baiyun' },
  { name: '杨钊杨勋楼', type: 'teaching', lat: 23.1922, lng: 113.4045, desc: '教学楼', campus: 'baiyun' },
  { name: '刘宇新楼', type: 'teaching', lat: 23.1912, lng: 113.4055, desc: '教学楼', campus: 'baiyun' },
  { name: 'D栋教学楼(含图书馆)', type: 'teaching', lat: 23.1908, lng: 113.4040, desc: '1-4层为图书馆，不同楼层不同类别书籍', campus: 'baiyun' },
  { name: '城建实训楼', type: 'teaching', lat: 23.1905, lng: 113.4030, desc: '城乡建设学院实训楼', campus: 'baiyun' },
  { name: '生命科学大楼A座', type: 'teaching', lat: 23.1925, lng: 113.4060, desc: '含国家级/省级重点实验室', campus: 'baiyun' },
  { name: '生命科学大楼B座', type: 'teaching', lat: 23.1928, lng: 113.4055, desc: '含国家级/省级重点实验室', campus: 'baiyun' },
  { name: '德新楼', type: 'teaching', lat: 23.1910, lng: 113.4070, desc: '校园开放日活动主场地', campus: 'baiyun' },

  // 饭堂
  { name: '甘葡园(旧饭堂)', type: 'canteen', lat: 23.1900, lng: 113.4035, desc: '三层饭堂，最靠近教学楼，有麻辣香锅/云吞/盖浇饭等，内含蜜雪冰城、瑞幸咖啡', campus: 'baiyun' },
  { name: '春晖园(新饭堂)', type: 'canteen', lat: 23.1890, lng: 113.4020, desc: '16栋旁，两层，有烧腊/小面/蒸饭等', campus: 'baiyun' },
  { name: '多功能饭堂(鸣蝉居)', type: 'canteen', lat: 23.1880, lng: 113.4010, desc: '19栋旁新建，有炸鸡汉堡/扒饭/麻辣烫', campus: 'baiyun' },
  { name: '青葵园', type: 'canteen', lat: 23.1895, lng: 113.4060, desc: '食堂之一', campus: 'baiyun' },

  // 宿舍
  { name: '宿舍1-6栋', type: 'dorm', lat: 23.1910, lng: 113.4070, desc: '靠近东一门东二门，临近教学楼和旧饭堂，6人间', campus: 'baiyun' },
  { name: '宿舍7-15栋', type: 'dorm', lat: 23.1885, lng: 113.4000, desc: '乐昌桥附近，靠近新饭堂，6人间上床下桌', campus: 'baiyun' },
  { name: '宿舍16-18栋', type: 'dorm', lat: 23.1880, lng: 113.4015, desc: '有电梯，靠近春晖园新饭堂', campus: 'baiyun' },
  { name: '宿舍19-23栋', type: 'dorm', lat: 23.1875, lng: 113.4025, desc: '最新楼栋，设施最好，有电梯', campus: 'baiyun' },

  // 快递站
  { name: '校园通驿站(6栋楼下)', type: 'express', lat: 23.1912, lng: 113.4068, desc: '接收申通、顺丰、邮政、中通、京东等', campus: 'baiyun' },
  { name: '东二门外菜鸟驿站', type: 'express', lat: 23.1920, lng: 113.4085, desc: '接收极兔，需出校门领取', campus: 'baiyun' },

  // 校门
  { name: '东1门(前门)', type: 'gate', lat: 23.1905, lng: 113.4090, desc: '仲恺农业工程学院站，979路/738路公交', campus: 'baiyun' },
  { name: '东2门(后门)', type: 'gate', lat: 23.1925, lng: 113.4080, desc: '仲恺农业工程学院北门站', campus: 'baiyun' },

  // 运动场
  { name: '南体育场(田径运动场)', type: 'sports', lat: 23.1895, lng: 113.4030, desc: '标准田径场，可跑步', campus: 'baiyun' },
  { name: '北体育场', type: 'sports', lat: 23.1930, lng: 113.4045, desc: '地下层设健身器材及部分运动场地', campus: 'baiyun' },
  { name: '霍英东体育馆', type: 'sports', lat: 23.1925, lng: 113.4035, desc: '室内体育馆', campus: 'baiyun' },
  { name: '游泳池', type: 'sports', lat: 23.1928, lng: 113.4040, desc: '目前仍未开放', campus: 'baiyun' },

  // 其他
  { name: '白云图书馆', type: 'other', lat: 23.1908, lng: 113.4042, desc: '8个书库，2500个阅览座位，43个研修室', campus: 'baiyun' },
  { name: '学术报告厅', type: 'other', lat: 23.1910, lng: 113.4045, desc: '举办讲座和学术会议', campus: 'baiyun' },
  { name: '校医院(3栋1层)', type: 'other', lat: 23.1915, lng: 113.4065, desc: '周一至周五8:40-11:45、13:30-16:15，急诊电话36525829', campus: 'baiyun' },
  { name: '双清湖', type: 'other', lat: 23.1890, lng: 113.4000, desc: '校园景观湖', campus: 'baiyun' },
];

// 合并所有POI数据
export const POIS: CampusPOI[] = [...HAIZHU_POIS, ...BAIYUN_POIS];

// 获取指定校区的POI数据
export function getPOIsByCampus(campus: 'haizhu' | 'baiyun' | 'all'): CampusPOI[] {
  if (campus === 'all') return POIS;
  return POIS.filter(poi => poi.campus === campus);
}

// 获取指定类型的POI数据
export function getPOIsByType(type: POIType): CampusPOI[] {
  return POIS.filter(poi => poi.type === type);
}
