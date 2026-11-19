'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CAMPUS_DATA, type CampusId } from '@/lib/campus-data';
import { POI_CATEGORIES, type POIType } from '@/data/campus-pois';

const CampusMap = dynamic(() => import('@/components/campus-map'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200" style={{ height: "60vh", minHeight: "400px" }}>
      <div className="text-gray-400 text-sm">加载地图中...</div>
    </div>
  ),
});

export default function MapPage() {
  const [activeCampus, setActiveCampus] = useState<CampusId>('all');
  const [enabledCategories, setEnabledCategories] = useState<POIType[]>(
    Object.keys(POI_CATEGORIES) as POIType[]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFE] to-[#F0F4F8]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">返回</span>
          </Link>
          <h1 className="text-base sm:text-lg font-bold text-gray-800">
            🗺️ 仲恺校园地图
          </h1>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Campus Switcher */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => setActiveCampus('haizhu')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCampus === 'haizhu'
                ? 'bg-[#1E3A5F] text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-[#1E3A5F] hover:text-[#1E3A5F]'
            }`}
          >
            📍 海珠校区
          </button>
          <button
            type="button"
            onClick={() => setActiveCampus('baiyun')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCampus === 'baiyun'
                ? 'bg-[#2D9F6F] text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-[#2D9F6F] hover:text-[#2D9F6F]'
            }`}
          >
            📍 白云校区
          </button>
          <button
            type="button"
            onClick={() => setActiveCampus('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCampus === 'all'
                ? 'bg-[#E8567F] text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-[#E8567F] hover:text-[#E8567F]'
            }`}
          >
            🗺️ 全部校区
          </button>
        </div>

        {/* Map with POIs and Filter */}
        <CampusMap
          campus={activeCampus}
          height="clamp(400px, 60vh, 700px)"
          minHeight="400px"
          showSwitcher={false}
          showPOIs={true}
          showFilter={true}
          enabledCategories={enabledCategories}
          onCategoriesChange={setEnabledCategories}
        />

        {/* Campus Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div
            role="button"
            tabIndex={0}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
              activeCampus === 'haizhu'
                ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 shadow-md'
                : 'border-gray-100 bg-white hover:border-[#1E3A5F]/50'
            }`}
            onClick={() => setActiveCampus('haizhu')}
            onKeyDown={(e) => e.key === 'Enter' && setActiveCampus('haizhu')}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🏛️</span>
              <h2 className="text-lg font-bold text-gray-800">海珠校区</h2>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              广州市海珠区仲恺路501号
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 bg-[#1E3A5F]/10 text-[#1E3A5F] rounded-full">
                地铁2号线
              </span>
              <span className="text-xs px-2 py-1 bg-[#1E3A5F]/10 text-[#1E3A5F] rounded-full">
                市中心
              </span>
              <span className="text-xs px-2 py-1 bg-[#1E3A5F]/10 text-[#1E3A5F] rounded-full">
                3个学院
              </span>
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
              activeCampus === 'baiyun'
                ? 'border-[#2D9F6F] bg-[#2D9F6F]/5 shadow-md'
                : 'border-gray-100 bg-white hover:border-[#2D9F6F]/50'
            }`}
            onClick={() => setActiveCampus('baiyun')}
            onKeyDown={(e) => e.key === 'Enter' && setActiveCampus('baiyun')}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🏔️</span>
              <h2 className="text-lg font-bold text-gray-800">白云校区</h2>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              广州市白云区广从八路1188号
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 bg-[#2D9F6F]/10 text-[#2D9F6F] rounded-full">
                地铁14号线
              </span>
              <span className="text-xs px-2 py-1 bg-[#2D9F6F]/10 text-[#2D9F6F] rounded-full">
                新校区
              </span>
              <span className="text-xs px-2 py-1 bg-[#2D9F6F]/10 text-[#2D9F6F] rounded-full">
                13个学院
              </span>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-6 p-4 bg-white rounded-2xl border border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 mb-2">💡 使用提示</h3>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• 点击地图上的标记可查看详细信息</li>
            <li>• 使用筛选按钮可显示/隐藏不同类型的地点</li>
            <li>• 白云校区可乘坐地铁14号线到钟落潭站或马沥站</li>
            <li>• 海珠校区可乘坐地铁2号线到市二宫站</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
