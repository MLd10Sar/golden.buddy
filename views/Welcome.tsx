
import React from 'react';

interface WelcomeProps {
  onNext: () => void;
}

export const WelcomeView: React.FC<WelcomeProps> = ({ onNext }) => {
  return (
    <div className="p-12 flex flex-col items-center text-center animate-spring-up min-h-full bg-white">
      <div className="w-36 h-36 bg-emerald-50 rounded-[3rem] flex items-center justify-center text-8xl mb-14 shadow-inner border-4 border-white neon-glow">
        👋
      </div>
      <div className="space-y-4 mb-16">
        <h2 className="text-6xl font-black text-slate-900 tracking-tighter leading-[0.85] uppercase">Hello Neighbor</h2>
        <p className="text-xl text-slate-400 font-bold leading-tight">Your simple bridge to local activity buddies.</p>
      </div>
      
      <div className="clay-card p-12 mb-16 w-full text-left">
        <h3 className="font-black mb-10 text-emerald-500 uppercase tracking-[0.4em] text-[10px] text-center">Safety Mesh Protocol</h3>
        <ul className="space-y-12">
          <li className="flex items-start gap-8">
            <div className="bg-emerald-500 text-white rounded-2xl w-14 h-14 flex items-center justify-center shrink-0 font-black text-3xl shadow-xl border-4 border-white">1</div>
            <p className="text-slate-900 font-black text-2xl leading-tight mt-1">Pick your local neighborhood.</p>
          </li>
          <li className="flex items-start gap-8">
            <div className="bg-emerald-500 text-white rounded-2xl w-14 h-14 flex items-center justify-center shrink-0 font-black text-3xl shadow-xl border-4 border-white">2</div>
            <p className="text-slate-900 font-black text-2xl leading-tight mt-1">Find a buddy for activities.</p>
          </li>
          <li className="flex items-start gap-8">
            <div className="bg-emerald-500 text-white rounded-2xl w-14 h-14 flex items-center justify-center shrink-0 font-black text-3xl shadow-xl border-4 border-white">3</div>
            <p className="text-slate-900 font-black text-2xl leading-tight mt-1">Meet safely in public spots.</p>
          </li>
        </ul>
      </div>

      <button onClick={onNext} className="w-full bg-emerald-500 text-slate-950 font-black py-8 rounded-[2.5rem] text-3xl shadow-2xl active:scale-95 transition-all uppercase tracking-tighter">
        Get Started
      </button>

      <p className="mt-14 text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">
        Live Mesh • V6.0 Stable
      </p>
    </div>
  );
};
