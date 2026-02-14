
import React from 'react';
import { INTERESTS } from '../constants';
import { Interest } from '../types';

interface InterestPickerProps {
  selectedInterests: Interest[];
  onToggle: (interest: Interest) => void;
  onNext: () => void;
  onBack: () => void;
}

export const InterestPicker: React.FC<InterestPickerProps> = ({ selectedInterests, onToggle, onNext, onBack }) => {
  return (
    <div className="p-8 flex flex-col h-full animate-slideIn">
      <button onClick={onBack} className="mb-8 text-slate-500 font-black uppercase tracking-widest text-xs">← Back</button>

      <h2 className="text-4xl font-black mb-4 text-slate-900 tracking-tighter leading-none">WHAT DO YOU ENJOY?</h2>
      <p className="text-slate-500 font-bold mb-12 text-lg">We'll find others who like the same activities.</p>

      <div className="space-y-4 flex-1">
        {INTERESTS.map((interest) => {
          const isSelected = selectedInterests.includes(interest);
          return (
            <button key={interest} onClick={() => onToggle(interest)}
              className={`w-full text-left p-6 rounded-[2rem] border-4 transition-all flex items-center gap-6 shadow-sm ${
                isSelected ? 'border-amber-500 bg-amber-50' : 'border-slate-100 bg-white'
              }`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${isSelected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-300'}`}>
                {isSelected ? '✓' : ''}
              </div>
              <span className={`text-2xl font-black ${isSelected ? 'text-amber-950' : 'text-slate-800'}`}>{interest}</span>
            </button>
          );
        })}
      </div>

      <button onClick={onNext} disabled={selectedInterests.length === 0}
        className="w-full py-6 bg-amber-500 disabled:bg-slate-200 text-amber-950 font-black rounded-[2.5rem] text-2xl shadow-xl active:scale-95 transition-all mt-12 uppercase tracking-tighter">
        Find My Neighbors
      </button>
    </div>
  );
};
