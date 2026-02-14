
import React from 'react';
import { AREAS } from '../constants';
import { AreaId } from '../types';

interface LocationPickerProps {
  selectedArea: AreaId | null;
  onSelect: (id: AreaId) => void;
  onBack: () => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ onSelect, onBack }) => {
  return (
    <div className="p-8 flex flex-col h-full animate-slideIn">
      <button onClick={onBack} className="mb-8 text-slate-500 font-black uppercase tracking-widest text-xs">← Back</button>
      
      <h2 className="text-4xl font-black mb-4 text-slate-900 tracking-tighter">WHERE DO YOU WALK?</h2>
      <p className="text-slate-500 font-bold mb-12 text-lg">We only show neighbors in the same broad area. Your GPS is never used.</p>

      <div className="space-y-4 flex-1">
        {AREAS.map((area) => (
          <button key={area.id} onClick={() => onSelect(area.id)}
            className="w-full text-left p-8 bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-sm hover:border-amber-400 hover:shadow-xl transition-all flex justify-between items-center group">
            <span className="text-2xl font-black text-slate-800 tracking-tight">{area.name}</span>
            <span className="text-3xl text-amber-400 group-hover:translate-x-2 transition-transform">→</span>
          </button>
        ))}
      </div>

      <div className="mt-12 bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex gap-5">
        <span className="text-4xl">🔒</span>
        <p className="text-xs text-indigo-800 font-bold leading-relaxed">
          <strong>PRIVACY FIRST:</strong> This app is built to protect you. We never know exactly where you are, only the general county or city.
        </p>
      </div>
    </div>
  );
};
