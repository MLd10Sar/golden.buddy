import React from 'react';

interface WelcomeProps {
  onNext: () => void;
}

export const WelcomeView: React.FC<WelcomeProps> = ({ onNext }) => {
  return (
    <div className="p-12 flex flex-col items-center text-center animate-pop min-h-full bg-white">
      <div className="w-36 h-36 bg-indigo-50 rounded-[3.5rem] flex items-center justify-center text-8xl mb-14 shadow-inner border-4 border-white">
        👵
      </div>
      <div className="space-y-4 mb-16">
        <h2 className="text-6xl font-black text-indigo-900 tracking-tighter leading-[0.85] uppercase">Hello Neighbor</h2>
        <p className="text-xl text-indigo-300 font-bold leading-tight">A simple way to find activity buddies in your neighborhood.</p>
      </div>
      
      <div className="clay-card p-12 mb-16 w-full text-left">
        <h3 className="font-black mb-10 text-pink-300 uppercase tracking-[0.4em] text-[10px] text-center">Safety Protocol</h3>
        <ul className="space-y-12">
          <li className="flex items-start gap-8">
            <div className="bg-pink-500 text-white rounded-[1.5rem] w-14 h-14 flex items-center justify-center shrink-0 font-black text-3xl shadow-xl border-4 border-white">1</div>
            <p className="text-indigo-900 font-black text-2xl leading-tight mt-1">Pick your local neighborhood.</p>
          </li>
          <li className="flex items-start gap-8">
            <div className="bg-pink-500 text-white rounded-[1.5rem] w-14 h-14 flex items-center justify-center shrink-0 font-black text-3xl shadow-xl border-4 border-white">2</div>
            <p className="text-indigo-900 font-black text-2xl leading-tight mt-1">Find a buddy for activities.</p>
          </li>
          <li className="flex items-start gap-8">
            <div className="bg-pink-500 text-white rounded-[1.5rem] w-14 h-14 flex items-center justify-center shrink-0 font-black text-3xl shadow-xl border-4 border-white">3</div>
            <p className="text-indigo-900 font-black text-2xl leading-tight mt-1">Meet safely in public spots.</p>
          </li>
        </ul>
      </div>

      <button onClick={onNext} className="w-full bg-pink-500 text-white font-black py-8 rounded-[3rem] text-3xl shadow-[0_25px_50px_-15px_rgba(236,72,153,0.5)] active:scale-95 transition-all uppercase tracking-tighter">
        Get Started
      </button>

      <p className="mt-14 text-[11px] font-black text-indigo-200 uppercase tracking-[0.5em]">
        Live Mesh • No Privacy Sharing
      </p>
    </div>
  );
};
