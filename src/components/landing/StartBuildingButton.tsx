import React from 'react';
import { ArrowRight } from 'lucide-react';

export function StartBuildingButton() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-4 items-center visible z-20">
      <button className="group flex overflow-hidden uppercase transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_40px_-10px_rgba(59,130,246,0.5)] focus:outline-none text-sm font-medium text-white tracking-widest font-mono rounded-full pt-5 pr-12 pb-5 pl-12 relative items-center justify-center">
        <style>{`
          @keyframes beam-spin { to { transform: rotate(360deg); } }
          @keyframes dots-move {
              0% { background-position: 0 0; }
              100% { background-position: 24px 24px; }
          }
        `}</style>

        {/* Full Border Beam (Single Beam) */}
        <div className="absolute inset-0 -z-20 rounded-full overflow-hidden p-[1px]">
          <div className="absolute inset-[-100%] bg-[conic-gradient(from_0deg,transparent_0_300deg,#3b82f6_360deg)]" style={{ animation: 'beam-spin 3s linear infinite' }}></div>
          <div className="absolute inset-[1px] rounded-full bg-black"></div>
        </div>

        {/* Inner Background & Effects */}
        <div className="-z-10 overflow-hidden bg-slate-950 rounded-full absolute top-[2px] right-[2px] bottom-[2px] left-[2px]">
          {/* Light Monotone Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-800/60 to-transparent"></div>

          {/* Animated Dots Pattern */}
          <div className="opacity-30 mix-blend-overlay absolute top-0 right-0 bottom-0 left-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '12px 12px', animation: 'dots-move 8s linear infinite' }}></div>

          {/* Blue Glow on Hover */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-1/2 bg-blue-500/10 blur-2xl rounded-full pointer-events-none transition-colors duration-500 group-hover:bg-blue-500/30"></div>
        </div>

        {/* Content */}
        <span className="relative z-10 text-white/90 transition-colors group-hover:text-white">
          Enter Patient Portal
        </span>
        <ArrowRight className="relative z-10 ml-3 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 text-white" />
      </button>
    </div>
  );
}
