export type CampusId = 'haizhu' | 'baiyun' | 'all';

export interface CampusInfo {
  id: 'haizhu' | 'baiyun';
  name: string;
  address: string;
  lng: number;
  lat: number;
}

export const CAMPUS_DATA: Record<'haizhu' | 'baiyun', CampusInfo> = {
  haizhu: {
    id: 'haizhu',
    name: '海珠校区',
    address: '广东省广州市海珠区东沙街24号',
    lng: 113.281465,
    lat: 23.106027,
  },
  baiyun: {
    id: 'baiyun',
    name: '白云校区',
    address: '广东省广州市白云区广从八路1188号',
    lng: 113.440888,
    lat: 23.381664,
  },
};
