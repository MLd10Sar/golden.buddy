
import React from 'react';

interface WelcomeProps {
  onNext: () => void;
}

export const WelcomeView: React.FC<WelcomeProps> = ({ onNext }) => {
  return (
    <div className="p-10 flex flex-col items-center text-center animate-spring min-h-full bg-slate-50">
      <div className="w-32 h-32 bg-amber-100 rounded-[3rem] flex items-center justify-center text-7xl mb-12 shadow-inner border-4 border-white">
        👋
      </div>
      <div className="space-y-4 mb-14">
        <h2 className="text-6xl font-black text-slate-900 tracking-tighter leading-[0.9] uppercase">Hello Neighbor</h2>
        <p className="text-xl text-slate-400 font-bold leading-tight">Your simple bridge to local activity buddies.</p>
      </div>
      
      <div className="clay-card p-10 mb-14 w-full text-left">
        <h3 className="font-black mb-8 text-slate-300 uppercase tracking-[0.3em] text-[10px] text-center">Safety Protocol</h3>
        <ul className="space-y-10">
          <li className="flex items-start gap-6">
            <div className="bg-amber-400 text-amber-950 rounded-2xl w-12 h-12 flex items-center justify-center shrink-0 font-black text-2xl shadow-xl border-2 border-white">1</div>
            <p className="text-slate-800 font-black text-2xl leading-none mt-2">Pick your area.</p>
          </li>
          <li className="flex items-start gap-6">
            <div className="bg-amber-400 text-amber-950 rounded-2xl w-12 h-12 flex items-center justify-center shrink-0 font-black text-2xl shadow-xl border-2 border-white">2</div>
            <p className="text-slate-800 font-black text-2xl leading-none mt-2">Find a buddy.</p>
          </li>
          <li className="flex items-start gap-6">
            <div className="bg-amber-400 text-amber-950 rounded-2xl w-12 h-12 flex items-center justify-center shrink-0 font-black text-2xl shadow-xl border-2 border-white">3</div>
            <p className="text-slate-800 font-black text-2xl leading-none mt-2">Meet in public.</p>
          </li>
        </ul>
      </div>

      <button onClick={onNext} className="w-full bg-amber-500 text-amber-950 font-black py-8 rounded-[2.5rem] text-3xl shadow-[0_20px_50px_-15px_rgba(245,158,11,0.6)] active:scale-95 transition-all uppercase tracking-tighter">
        Get Started
      </button>

      <p className="mt-12 text-[11px] font-black text-slate-300 uppercase tracking-[0.5em]">
        Private • Live • Free
      </p>
    </div>
  );
};
