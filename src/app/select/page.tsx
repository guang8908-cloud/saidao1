'use client';

import { useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Persona {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  cardClass: string;
  borderColor: string;
  iconBg: string;
  nameColor: string;
  taglineColor: string;
  badgeBg: string;
  badgeText: string;
  floatClass: string;
}

const personas: Persona[] = [
  {
    id: 'zhongxiaokai',
    name: '仲小恺',
    icon: '📚',
    tagline: '话少信息密，问就对了',
    description: '大四学长，校园活地图。表面高冷实则热心，嘴上说着"这都不会"，手上已经帮你查好了。食堂哪个窗口好吃、校车几点开、选课怎么操作——他比百度清楚。',
    cardClass: 'card-blue',
    borderColor: 'border-[#7EB3E0]/30 hover:border-[#3B6CB4]/50',
    iconBg: 'bg-[#1E3A5F]/8',
    nameColor: 'text-[#1E3A5F]',
    taglineColor: 'text-[#3B6CB4]',
    badgeBg: 'bg-[#1E3A5F]/6',
    badgeText: 'text-[#1E3A5F]',
    floatClass: 'animate-float',
  },
  {
    id: 'yingjiang',
    name: '樱酱',
    icon: '🌸',
    tagline: '魔法校园向导，随时待命',
    description: '被仲恺学生意外唤醒的魔法少女！元气满满的木之本樱，用库洛牌的魔力帮你探索校园。Hoeeeーー！遇到困难别怕，绝对没问题的！🌸✨',
    cardClass: 'card-pink',
    borderColor: 'border-[#F7A8C4]/40 hover:border-[#E8567F]/50',
    iconBg: 'bg-[#E8567F]/8',
    nameColor: 'text-[#E8567F]',
    taglineColor: 'text-[#E8567F]',
    badgeBg: 'bg-[#E8567F]/6',
    badgeText: 'text-[#E8567F]',
    floatClass: 'animate-float-delay',
  },
  {
    id: 'baishitong',
    name: '仲恺校园百事通',
    icon: '🎓',
    tagline: '食堂校车教务，一键直达',
    description: '仲恺校园智能服务终端。零废话，直给答案。食堂、校车、教务、宿舍——查询完毕，结果如下。⚡',
    cardClass: 'card-green',
    borderColor: 'border-[#6DD5A8]/30 hover:border-[#2D9F6F]/50',
    iconBg: 'bg-[#2D9F6F]/8',
    nameColor: 'text-[#2D9F6F]',
    taglineColor: 'text-[#2D9F6F]',
    badgeBg: 'bg-[#2D9F6F]/6',
    badgeText: 'text-[#2D9F6F]',
    floatClass: 'animate-float-delay-2',
  },
];

function SelectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campus = searchParams.get('campus') || 'haizhu';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastName, setToastName] = useState('');

  const handleSelect = useCallback((persona: Persona) => {
    setSelectedId(persona.id);
    setToastName(persona.name);
    setShowToast(true);

    setTimeout(() => {
      router.push(`/chat/${persona.id}?campus=${campus}`);
    }, 800);
  }, [router, campus]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#FAFBFE] via-[#F5F7FB] to-[#F0F4F8]">
      {/* Background Decorations */}
      <div className="bg-decoration bg-circle bg-[#7EB3E0]/20 w-[500px] h-[500px] -top-[200px] -left-[100px]" />
      <div className="bg-decoration bg-circle bg-[#F7A8C4]/20 w-[400px] h-[400px] top-[10%] -right-[100px]" />
      <div className="bg-decoration bg-circle bg-[#6DD5A8]/15 w-[350px] h-[350px] bottom-[5%] left-[20%]" />

      {/* Subtle grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle, #1E3A5F 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Toast Notification */}
      {showToast && (
        <div className="toast-container animate-slide-down">
          <div className="flex items-center gap-2 px-5 py-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-gray-100">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-medium text-gray-700">
              已选择 <span className="font-bold">{toastName}</span>，正在跳转...
            </span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="animate-fade-in-up stagger-1">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 text-xs font-medium tracking-wide text-[#3B6CB4] bg-[#1E3A5F]/5 rounded-full border border-[#7EB3E0]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3B6CB4] animate-pulse" />
              ZHONGKAI CAMPUS GUIDE
            </div>
          </div>

          <h1 className="animate-fade-in-up stagger-2 text-3xl sm:text-4xl lg:text-5xl font-black text-[#1a1a2e] tracking-tight leading-tight">
            选择你的
            <span className="relative inline-block">
              <span className="relative z-10">校园助手</span>
              <span className="absolute bottom-1 left-0 right-0 h-2.5 sm:h-3 bg-[#6DD5A8]/25 rounded-sm -z-0" />
            </span>
          </h1>

          <p className="animate-fade-in-up stagger-3 mt-3 text-sm sm:text-base text-gray-500 font-light max-w-md mx-auto leading-relaxed">
            三位风格各异的校园向导，为你解答一切校园问题
          </p>
        </div>

        {/* Cards Container */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 lg:gap-8">
          {personas.map((persona, index) => (
            <div
              key={persona.id}
              className={`animate-fade-in-up stagger-${index + 2}`}
            >
              <div
                onClick={() => handleSelect(persona)}
                className={`persona-card ${persona.cardClass} group relative bg-white/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl border-2 ${persona.borderColor} p-6 sm:p-8 cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-xl ${
                  selectedId === persona.id ? 'card-selected ring-2 ring-offset-2' : ''
                } ${selectedId === persona.id && persona.id === 'zhongxiaokai' ? 'ring-[#3B6CB4]' : ''} ${
                  selectedId === persona.id && persona.id === 'yingjiang' ? 'ring-[#E8567F]' : ''
                } ${selectedId === persona.id && persona.id === 'baishitong' ? 'ring-[#2D9F6F]' : ''}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(persona);
                  }
                }}
                aria-label={`选择${persona.name}`}
              >
                {/* Selected badge */}
                {selectedId === persona.id && (
                  <div className="absolute -top-2 -right-2 z-20 flex items-center justify-center w-7 h-7 bg-white rounded-full shadow-md border border-gray-100">
                    <svg
                      className="w-4 h-4 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}

                {/* Icon */}
                <div className={`${persona.iconBg} w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-5 sm:mb-6 transition-transform duration-300 group-hover:scale-105`}>
                  <span className={`text-3xl sm:text-4xl ${persona.floatClass} inline-block`}>
                    {persona.icon}
                  </span>
                </div>

                {/* Name */}
                <h2 className={`${persona.nameColor} text-xl sm:text-2xl font-bold mb-2 tracking-tight`}>
                  {persona.name}
                </h2>

                {/* Tagline */}
                <p className={`${persona.taglineColor} text-sm font-medium mb-3 sm:mb-4 italic`}>
                  &ldquo;{persona.tagline}&rdquo;
                </p>

                {/* Description */}
                <p className="text-gray-500 text-sm leading-relaxed mb-5 sm:mb-6">
                  {persona.description}
                </p>

                {/* Badge / CTA */}
                <div className={`inline-flex items-center gap-1.5 ${persona.badgeBg} px-3.5 py-1.5 rounded-full transition-all duration-300 group-hover:gap-2.5`}>
                  <span className={`${persona.badgeText} text-xs font-medium`}>
                    选择 TA
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 ${persona.badgeText} transition-transform duration-300 group-hover:translate-x-0.5`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="animate-fade-in-up mt-8 sm:mt-10 text-center">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回选择校区
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SelectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#FAFBFE] to-[#F0F4F8]">
        <span className="text-gray-400">加载中...</span>
      </div>
    }>
      <SelectContent />
    </Suspense>
  );
}
