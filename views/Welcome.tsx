
import React from 'react';

interface WelcomeProps {
  onNext: () => void;
}

export const WelcomeView: React.FC<WelcomeProps> = ({ onNext }) => {
  return (
    <div className="p-8 flex flex-col items-center text-center animate-fadeIn min-h-full">
      <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center text-5xl mb-12 shadow-inner border-4 border-white animate-bounce">
        👋
      </div>
      <h2 className="text-4xl font-black mb-6 text-slate-900 tracking-tighter">HELLO THERE!</h2>
      <p className="text-xl text-slate-600 mb-12 leading-relaxed">
        Let's find you a local activity buddy. <br/>
        <span className="font-black text-amber-600 uppercase tracking-wide">Privacy first. Simple as that.</span>
      </p>
      
      <div className="bg-white p-8 rounded-[3rem] shadow-xl border-2 border-slate-50 mb-12 w-full text-left">
        <h3 className="font-black mb-6 text-slate-400 uppercase tracking-widest text-[10px]">Simple Steps</h3>
        <ul className="space-y-6">
          <li className="flex items-start gap-4">
            <span className="bg-amber-400 text-amber-950 rounded-2xl w-8 h-8 flex items-center justify-center shrink-0 font-black text-lg shadow-sm">1</span>
            <p className="text-slate-700 font-bold text-lg">Pick your general neighborhood.</p>
          </li>
          <li className="flex items-start gap-4">
            <span className="bg-amber-400 text-amber-950 rounded-2xl w-8 h-8 flex items-center justify-center shrink-0 font-black text-lg shadow-sm">2</span>
            <p className="text-slate-700 font-bold text-lg">Choose things you enjoy (Walk, Chess, etc).</p>
          </li>
          <li className="flex items-start gap-4">
            <span className="bg-amber-400 text-amber-950 rounded-2xl w-8 h-8 flex items-center justify-center shrink-0 font-black text-lg shadow-sm">3</span>
            <p className="text-slate-700 font-bold text-lg">Meet a neighbor safely in public.</p>
          </li>
        </ul>
      </div>

      <button onClick={onNext} className="w-full bg-amber-500 hover:bg-amber-600 text-amber-950 font-black py-6 rounded-[2.5rem] text-2xl shadow-xl transition-all active:scale-95 uppercase tracking-tighter">
        Get Started
      </button>

      <p className="mt-12 text-[10px] font-black text-slate-300 uppercase tracking-widest">
        Community-Driven • 100% Privacy
      </p>
    </div>
  );
};
