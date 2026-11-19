'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { POIS, POI_CATEGORIES, getPOIsByCampus, type CampusPOI, type POIType } from '@/data/campus-pois';
import type { CampusId } from '@/lib/campus-data';

const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY?.trim() ?? '';
const AMAP_SECURITY_CODE = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE?.trim() ?? '';

// 校区数据（内部使用）—— 坐标来自高德地图，格式 [经度, 纬度]
const CAMPUS_DATA_INTERNAL = {
  haizhu: {
    id: 'haizhu',
    name: '海珠校区',
    address: '广东省广州市海珠区东沙街24号',
    position: [113.281465, 23.106027] as [number, number],
    color: '#1E3A5F',
  },
  baiyun: {
    id: 'baiyun',
    name: '白云校区',
    address: '广东省广州市白云区广从八路1188号',
    position: [113.440888, 23.381664] as [number, number],
    color: '#2D9F6F',
  },
};

// POI类别对应的Marker颜色
const CATEGORY_COLORS: Record<POIType, string> = {
  teaching: '#1E3A5F',
  canteen: '#E8567F',
  dorm: '#F59E0B',
  express: '#8B5CF6',
  gate: '#6B7280',
  sports: '#10B981',
  other: '#3B82F6',
};

// POI类别对应的图标emoji
const CATEGORY_ICONS: Record<POIType, string> = {
  teaching: '🏫',
  canteen: '🍜',
  dorm: '🏠',
  express: '📦',
  gate: '🚪',
  sports: '⚽',
  other: '📍',
};

interface CampusMapProps {
  /** 默认显示的校区，'all' 显示两个校区 */
  defaultCampus?: CampusId;
  /** 受控的校区值，传入后会覆盖内部状态 */
  campus?: CampusId;
  /** 地图高度，默认 300px */
  height?: string;
  /** 地图最小高度，默认 300px */
  minHeight?: string;
  /** 是否显示校区切换按钮 */
  showSwitcher?: boolean;
  /** 是否为聊天内嵌模式（更紧凑的样式） */
  compact?: boolean;
  /** 是否显示POI标注 */
  showPOIs?: boolean;
  /** 是否显示分类筛选面板 */
  showFilter?: boolean;
  /** 启用的POI类别（为空则显示全部） */
  enabledCategories?: POIType[];
  /** 类别变更回调 */
  onCategoriesChange?: (categories: POIType[]) => void;
}

export default function CampusMap({
  defaultCampus = 'haizhu',
  campus,
  height = '300px',
  minHeight = '300px',
  showSwitcher = true,
  compact = false,
  showPOIs = false,
  showFilter = false,
  enabledCategories,
  onCategoriesChange,
}: CampusMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const [internalCampus, setInternalCampus] = useState<CampusId>(defaultCampus);
  const activeCampus = campus ?? internalCampus;
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [internalEnabledCategories, setInternalEnabledCategories] = useState<POIType[]>(
    enabledCategories ?? Object.keys(POI_CATEGORIES) as POIType[]
  );

  const currentEnabledCategories = enabledCategories ?? internalEnabledCategories;

  const handleCategoriesToggle = useCallback((category: POIType) => {
    const newCategories = currentEnabledCategories.includes(category)
      ? currentEnabledCategories.filter(c => c !== category)
      : [...currentEnabledCategories, category];

    setInternalEnabledCategories(newCategories);
    onCategoriesChange?.(newCategories);
  }, [currentEnabledCategories, onCategoriesChange]);

  // 初始化地图
  useEffect(() => {
    if (!mapContainer.current) return;
    if (!AMAP_KEY || !AMAP_SECURITY_CODE) {
      setMapError('地图暂不可用');
      return;
    }

    let destroyed = false;

    const initMap = async () => {
      try {
        const securityWindow = window as Window & {
          _AMapSecurityConfig?: { securityJsCode: string };
        };
        securityWindow._AMapSecurityConfig = {
          securityJsCode: AMAP_SECURITY_CODE,
        };

        const AMap = await AMapLoader.load({
          key: AMAP_KEY,
          version: '2.0',
          plugins: ['AMap.InfoWindow', 'AMap.Marker'],
        });

        if (destroyed || !mapContainer.current) return;

        // 计算初始中心点
        const initialCenter = getCenterPosition(defaultCampus);
        const initialZoom = defaultCampus === 'all' ? 11 : defaultCampus === 'haizhu' ? 16 : 15;

        const map = new AMap.Map(mapContainer.current, {
          zoom: initialZoom,
          center: initialCenter,
          viewMode: '2D',
          mapStyle: 'amap://styles/whitesmoke',
        });

        // 创建信息窗口（复用）
        infoWindowRef.current = new AMap.InfoWindow({
          offset: new AMap.Pixel(0, -30),
          closeWhenClickMap: true,
        });

        mapInstance.current = map;
        setMapLoaded(true);

        // 添加校区标注
        addCampusMarkers(map, AMap, defaultCampus);

        // 添加POI标注
        if (showPOIs) {
          addPOIMarkers(map, AMap, defaultCampus, currentEnabledCategories);
        }
      } catch (err) {
        console.error('地图加载失败:', err);
        setMapError('地图加载失败，请刷新页面重试');
      }
    };

    initMap();

    return () => {
      destroyed = true;
      if (mapInstance.current) {
        mapInstance.current.destroy();
        mapInstance.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 切换校区或类别时更新地图视图
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return;

    const map = mapInstance.current;
    const center = getCenterPosition(activeCampus);
    const zoom = activeCampus === 'all' ? 11 : activeCampus === 'haizhu' ? 16 : 15;

    map.setZoomAndCenter(zoom, center);

    // 清除旧标注，重新添加
    map.clearMap();
    markersRef.current = [];

    // 重新加载 AMap 来创建标注
    AMapLoader.load({
      key: AMAP_KEY,
      version: '2.0',
      plugins: ['AMap.InfoWindow', 'AMap.Marker'],
    }).then((AMap) => {
      // 重新创建信息窗口
      infoWindowRef.current = new AMap.InfoWindow({
        offset: new AMap.Pixel(0, -30),
        closeWhenClickMap: true,
      });

      addCampusMarkers(map, AMap, activeCampus);

      if (showPOIs) {
        addPOIMarkers(map, AMap, activeCampus, currentEnabledCategories);
      }
    });
  }, [activeCampus, mapLoaded, showPOIs, currentEnabledCategories]);

  const handleSwitch = (campus: CampusId) => {
    if (campus !== undefined) {
      setInternalCampus(campus);
    }
  };

  if (mapError) {
    return (
      <div
        className={`rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center ${compact ? 'p-4' : 'p-8'}`}
        style={{ height }}
      >
        <p className="text-gray-400 text-sm">{mapError}</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl overflow-hidden shadow-lg border border-gray-100 ${compact ? '' : ''}`}
    >
      {/* 校区切换按钮 */}
      {showSwitcher && (
        <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-100">
          <span className="text-xs text-gray-400 mr-1">📍</span>
          <button
            type="button"
            onClick={() => handleSwitch('haizhu')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              activeCampus === 'haizhu'
                ? 'bg-[#1E3A5F] text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            海珠校区
          </button>
          <button
            type="button"
            onClick={() => handleSwitch('baiyun')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              activeCampus === 'baiyun'
                ? 'bg-[#1E3A5F] text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            白云校区
          </button>
          <button
            type="button"
            onClick={() => handleSwitch('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              activeCampus === 'all'
                ? 'bg-[#1E3A5F] text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
        </div>
      )}

      {/* 分类筛选面板 */}
      {showFilter && showPOIs && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
          <span className="text-xs text-gray-500 mr-1">筛选：</span>
          {(Object.keys(POI_CATEGORIES) as POIType[]).map((category) => {
            const cat = POI_CATEGORIES[category];
            const isEnabled = currentEnabledCategories.includes(category);
            const color = CATEGORY_COLORS[category];
            return (
              <button
                key={category}
                type="button"
                onClick={() => handleCategoriesToggle(category)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                  isEnabled
                    ? 'text-white shadow-sm'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
                style={isEnabled ? { backgroundColor: color } : {}}
              >
                <span>{CATEGORY_ICONS[category]}</span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 地图容器 */}
      <div
        ref={mapContainer}
        style={{ height, minHeight, width: '100%' }}
        className="relative bg-gray-50"
      >
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-3 border-gray-200 border-t-[#1E3A5F] rounded-full animate-spin" />
              <span className="text-xs text-gray-400">加载地图中...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 获取中心位置
function getCenterPosition(campus: CampusId): [number, number] {
  if (campus === 'haizhu') return CAMPUS_DATA_INTERNAL.haizhu.position;
  if (campus === 'baiyun') return CAMPUS_DATA_INTERNAL.baiyun.position;
  // all: 两个校区的中点
  return [
    (CAMPUS_DATA_INTERNAL.haizhu.position[0] + CAMPUS_DATA_INTERNAL.baiyun.position[0]) / 2,
    (CAMPUS_DATA_INTERNAL.haizhu.position[1] + CAMPUS_DATA_INTERNAL.baiyun.position[1]) / 2,
  ];
}

// 添加校区标注
function addCampusMarkers(map: any, AMap: any, campus: CampusId) {
  const campuses =
    campus === 'all'
      ? [CAMPUS_DATA_INTERNAL.haizhu, CAMPUS_DATA_INTERNAL.baiyun]
      : [campus === 'haizhu' ? CAMPUS_DATA_INTERNAL.haizhu : CAMPUS_DATA_INTERNAL.baiyun];

  campuses.forEach((c) => {
    // 创建标注
    const marker = new AMap.Marker({
      position: c.position,
      title: c.name,
      label: {
        content: `<div style="padding: 4px 12px; background: ${c.color}; color: white; border-radius: 12px; font-size: 12px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">${c.name}</div>`,
        direction: 'top',
        offset: new AMap.Pixel(0, -5),
      },
    });

    // 创建信息窗口
    const infoWindow = new AMap.InfoWindow({
      content: `
        <div style="padding: 10px 14px; min-width: 200px; font-family: 'Noto Sans SC', sans-serif;">
          <div style="font-size: 15px; font-weight: 600; color: ${c.color}; margin-bottom: 6px;">
            ${c.name}
          </div>
          <div style="font-size: 12px; color: #666; line-height: 1.6;">
            📍 ${c.address}
          </div>
        </div>
      `,
      offset: new AMap.Pixel(0, -30),
    });

    marker.on('click', () => {
      infoWindow.open(map, marker.getPosition());
    });

    map.add(marker);
  });
}

// 添加POI标注
function addPOIMarkers(map: any, AMap: any, campus: CampusId, enabledCategories: POIType[]) {
  // 获取当前校区的POI
  let pois: CampusPOI[] = [];
  if (campus === 'all') {
    pois = POIS;
  } else {
    pois = POIS.filter(p => p.campus === campus);
  }

  // 过滤启用的类别
  pois = pois.filter(poi => enabledCategories.includes(poi.type));

  pois.forEach((poi) => {
    const color = CATEGORY_COLORS[poi.type];
    const icon = CATEGORY_ICONS[poi.type];
    const categoryName = POI_CATEGORIES[poi.type]?.name || '';

    // 创建标注
    const marker = new AMap.Marker({
      position: [poi.lng, poi.lat],
      title: poi.name,
      label: {
        content: `<div style="padding: 2px 8px; background: ${color}; color: white; border-radius: 8px; font-size: 10px; font-weight: 500; white-space: nowrap; display: flex; align-items: center; gap: 2px;"><span>${icon}</span><span>${poi.name}</span></div>`,
        direction: 'top',
        offset: new AMap.Pixel(0, -3),
      },
    });

    // 创建信息窗口
    const infoWindow = new AMap.InfoWindow({
      content: `
        <div style="padding: 10px 14px; min-width: 180px; max-width: 250px; font-family: 'Noto Sans SC', sans-serif;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <span style="font-size: 16px;">${icon}</span>
            <span style="font-size: 14px; font-weight: 600; color: ${color};">${poi.name}</span>
          </div>
          <div style="font-size: 11px; color: ${color}; background: ${color}15; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">
            ${categoryName}
          </div>
          <div style="font-size: 12px; color: #555; line-height: 1.5;">
            ${poi.desc}
          </div>
        </div>
      `,
      offset: new AMap.Pixel(0, -30),
    });

    marker.on('click', () => {
      infoWindow.open(map, marker.getPosition());
    });

    map.add(marker);
  });
}

// 导出类型供外部使用
export type { CampusId, POIType };
