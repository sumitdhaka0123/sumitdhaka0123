import React from 'react';

interface SenzoLogoProps {
  layout?: 'full' | 'compact' | 'icon' | 'banner';
  className?: string;
  theme?: 'light' | 'dark';
}

export default function SenzoLogo({ layout = 'full', className = '', theme = 'light' }: SenzoLogoProps) {
  const isDark = theme === 'dark';
  
  // High-fidelity SVG paths representing the sporty aerodynamic wings
  const renderSwoosh = (sizeClass: string) => (
    <svg 
      viewBox="0 0 350 100" 
      className={`${sizeClass} fill-current select-none`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top Black/Silver Wing */}
      <path 
        d="M 155,36 C 205,12 280,12 340,24 C 275,28 215,36 170,39 C 165,39 160,38 155,36 Z" 
        className={isDark ? 'text-slate-300' : 'text-slate-950'} 
      />
      {/* Middle Sporty Red Wing */}
      <path 
        d="M 68,61 C 120,38 210,30 325,32 C 235,38 150,56 80,63 C 75,63 71,62 68,61 Z" 
        className="text-red-600" 
      />
      {/* Bottom Black/Silver Wing */}
      <path 
        d="M 180,48 C 225,36 275,34 315,36 C 265,42 220,48 188,49 C 185,49 182,49 180,48 Z" 
        className={isDark ? 'text-slate-300' : 'text-slate-950'} 
      />
    </svg>
  );

  if (layout === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {renderSwoosh('h-8 w-auto')}
      </div>
    );
  }

  if (layout === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {renderSwoosh('h-7 w-auto shrink-0')}
        <div className="flex flex-col select-none">
          <div className="flex items-baseline font-sans font-black tracking-tight text-lg leading-none">
            <span className="text-red-600">Sen</span>
            <span className={isDark ? 'text-white' : 'text-slate-950'}>zo</span>
          </div>
          <span className={`text-[7px] font-black tracking-[0.25em] uppercase font-sans leading-none mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
            E-SCOOTER
          </span>
        </div>
      </div>
    );
  }

  if (layout === 'banner') {
    return (
      <div className={`flex flex-col items-center justify-center text-center p-4 ${className}`}>
        {renderSwoosh('h-16 w-auto mb-2')}
        <div className="flex items-baseline font-sans font-black tracking-tight text-3xl select-none">
          <span className="text-red-600 font-black">Sen</span>
          <span className={isDark ? 'text-white' : 'text-slate-950'}>zo</span>
        </div>
        <div className={`w-40 h-[1px] my-1.5 ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
        <span className={`text-[11px] font-extrabold tracking-[0.3em] uppercase font-sans ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>
          E-SCOOTER
        </span>
      </div>
    );
  }

  // Default 'full' layout (stacked logo with underline and E-SCOOTER subtitle)
  return (
    <div className={`flex flex-col items-center p-2 ${className}`}>
      {/* Wings graphic container */}
      <div className="w-full flex justify-center">
        {renderSwoosh('w-52 h-auto')}
      </div>
      
      {/* Senzo brand name */}
      <div className="flex items-baseline font-sans font-black tracking-tight text-4xl mt-1 select-none">
        <span className="text-red-600">Sen</span>
        <span className={isDark ? 'text-white' : 'text-slate-950'}>zo</span>
      </div>

      {/* Decorative horizontal divider line */}
      <div className={`w-full max-w-[260px] h-[1px] mt-2 mb-1.5 ${isDark ? 'bg-slate-800' : 'bg-slate-300'}`}></div>

      {/* Subtitle Company Name / Brand */}
      <div className={`text-xs font-black tracking-[0.35em] uppercase font-sans ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
        E-SCOOTER
      </div>
    </div>
  );
}
