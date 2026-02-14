
import React from 'react';

interface WelcomeProps {
  onNext: () => void;
}

export const WelcomeView: React.FC<WelcomeProps> = ({ onNext }) => {
  return (
    <div className="p-10 flex flex-col items-center text-center animate-pop min-h-full bg-white">
      <div className="w-32 h-32 bg-indigo-50 rounded-[3rem] flex items-center justify-center text-7xl mb-12 shadow-inner border-4 border-white">
        👴
      </div>
      <div className="space-y-3 mb-12">
        <h2 className="text-5xl font-black text-indigo-900 tracking-tighter leading-[0.9] uppercase">Hello Neighbor</h2>
        <p className="text-lg text-indigo-300 font-bold leading-tight px-4">Find safe, local activity buddies in your community.</p>
      </div>
      
      <div className="bg-white rounded-[3rem] shadow-xl border border-indigo-50 p-10 mb-12 w-full text-left">
        <h3 className="font-black mb-8 text-pink-300 uppercase tracking-[0.4em] text-[9px] text-center">Safety Protocol</h3>
        <ul className="space-y-10">
          <li className="flex items-start gap-6">
            <div className="bg-pink-500 text-white rounded-[1.2rem] w-12 h-12 flex items-center justify-center shrink-0 font-black text-2xl shadow-lg border-4 border-white">1</div>
            <p className="text-indigo-900 font-black text-xl leading-tight mt-1">Select your general neighborhood.</p>
          </li>
          <li className="flex items-start gap-6">
            <div className="bg-pink-500 text-white rounded-[1.2rem] w-12 h-12 flex items-center justify-center shrink-0 font-black text-2xl shadow-lg border-4 border-white">2</div>
            <p className="text-indigo-900 font-black text-xl leading-tight mt-1">Find a buddy for coffee or walks.</p>
          </li>
          <li className="flex items-start gap-6">
            <div className="bg-pink-500 text-white rounded-[1.2rem] w-12 h-12 flex items-center justify-center shrink-0 font-black text-2xl shadow-lg border-4 border-white">3</div>
            <p className="text-indigo-900 font-black text-xl leading-tight mt-1">Meet safely at public spots.</p>
          </li>
        </ul>
      </div>

      <button onClick={onNext} className="w-full bg-pink-500 text-white font-black py-7 rounded-[2.5rem] text-2xl shadow-2xl active:scale-95 transition-all uppercase tracking-tighter">
        Get Started
      </button>

      <p className="mt-12 text-[10px] font-black text-indigo-200 uppercase tracking-[0.4em]">
        Live Sync • Privacy First
      </p>
    </div>
  );
};
