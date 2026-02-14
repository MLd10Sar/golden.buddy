
import React from 'react';

interface WelcomeProps {
  onNext: () => void;
}

export const WelcomeView: React.FC<WelcomeProps> = ({ onNext }) => {
  return (
    <div className="p-8 flex flex-col items-center text-center animate-fadeIn min-h-full bg-white">
      <div className="w-28 h-28 bg-amber-100 rounded-[2.5rem] flex items-center justify-center text-6xl mb-10 shadow-inner border-4 border-white animate-spring">
        👋
      </div>
      <div className="space-y-3 mb-12">
        <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-none uppercase">Hello There</h2>
        <p className="text-lg text-slate-500 font-bold leading-tight">Finding you an activity buddy.</p>
      </div>
      
      <div className="bg-slate-50 p-10 rounded-[3.5rem] border-2 border-slate-100 mb-12 w-full text-left shadow-clay">
        <h3 className="font-extrabold mb-8 text-slate-300 uppercase tracking-widest text-[10px]">Simple Safety Steps</h3>
        <ul className="space-y-8">
          <li className="flex items-start gap-5">
            <div className="bg-amber-400 text-amber-950 rounded-2xl w-10 h-10 flex items-center justify-center shrink-0 font-black text-xl shadow-lg border-2 border-white">1</div>
            <p className="text-slate-800 font-extrabold text-xl leading-snug">Pick your broad neighborhood.</p>
          </li>
          <li className="flex items-start gap-5">
            <div className="bg-amber-400 text-amber-950 rounded-2xl w-10 h-10 flex items-center justify-center shrink-0 font-black text-xl shadow-lg border-2 border-white">2</div>
            <p className="text-slate-800 font-extrabold text-xl leading-snug">Choose things you enjoy.</p>
          </li>
          <li className="flex items-start gap-5">
            <div className="bg-amber-400 text-amber-950 rounded-2xl w-10 h-10 flex items-center justify-center shrink-0 font-black text-xl shadow-lg border-2 border-white">3</div>
            <p className="text-slate-800 font-extrabold text-xl leading-snug">Meet safely in public spots.</p>
          </li>
        </ul>
      </div>

      <button onClick={onNext} className="w-full bg-amber-500 hover:bg-amber-600 text-amber-950 font-black py-7 rounded-[2.5rem] text-2xl shadow-[0_20px_50px_-15px_rgba(245,158,11,0.5)] transition-all active:scale-95 uppercase tracking-tight">
        Get Started
      </button>

      <p className="mt-10 text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
        Live & Private • Community First
      </p>
    </div>
  );
};
