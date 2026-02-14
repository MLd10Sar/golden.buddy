
import React from 'react';

interface NamePickerProps {
  name: string;
  onSetName: (name: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const NamePicker: React.FC<NamePickerProps> = ({ name, onSetName, onNext, onBack }) => {
  return (
    <div className="flex flex-col h-full justify-center items-center px-8 pb-20 animate-fadeIn space-y-12">
      <div className="text-center space-y-6">
        <div className="text-7xl mb-6">👤</div>
        <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">What's your name?</h1>
        <p className="text-slate-400 font-bold text-lg">Your neighbors will see this</p>
      </div>

      <div className="w-full max-w-sm">
        <input type="text" value={name} onChange={(e) => onSetName(e.target.value)}
          placeholder="e.g. Martha" autoFocus maxLength={20}
          className="w-full px-8 py-6 rounded-[2.5rem] text-2xl font-black border-4 border-amber-300 bg-white text-slate-900 focus:border-amber-500 outline-none shadow-xl transition-all placeholder-slate-200" />
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <button onClick={onNext} disabled={!name.trim()}
          className="w-full py-6 bg-amber-500 disabled:bg-slate-200 text-amber-950 font-black rounded-[2.5rem] text-2xl transition-all active:scale-95 shadow-xl uppercase tracking-tighter">
          Continue
        </button>
        <button onClick={onBack} className="w-full py-4 text-slate-400 font-black uppercase tracking-widest text-xs">Go Back</button>
      </div>
    </div>
  );
};
