
import React from 'react';
import { Session, AccessibilitySettings } from '../types';
import { AREAS } from '../constants';

interface ProfileViewProps {
  session: Session;
  onBack: () => void;
  onEditInterests: () => void;
  onUpdateName: (newName: string) => void;
  onReset: () => void;
  onUpdateAccessibility: (settings: Partial<AccessibilitySettings>) => void;
  onUpdateInviteDuration: (durationMs: number) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ 
  session, 
  onBack, 
  onReset, 
  onUpdateAccessibility, 
  onUpdateInviteDuration 
}) => {
  const area = AREAS.find(a => a.id === session.areaId);
  const { accessibility, inviteDuration } = session;

  const durationOptions = [
    { label: '30m', value: 30 * 60 * 1000 },
    { label: '1h', value: 60 * 60 * 1000 },
    { label: '2h', value: 120 * 60 * 1000 },
    { label: '4h', value: 240 * 60 * 1000 },
  ];

  return (
    <div className="p-8 animate-fadeIn flex flex-col h-full space-y-8">
      <button onClick={onBack} className="self-start text-slate-500 font-black uppercase tracking-widest text-xs flex items-center gap-1">← Dashboard</button>

      {/* Profile Card */}
      <div className="bg-white rounded-[3rem] p-8 shadow-xl border-2 border-slate-50 text-center flex-shrink-0">
        <div className="w-20 h-20 bg-amber-100 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl shadow-inner border-4 border-white">👤</div>
        <h2 className="text-2xl font-black text-slate-900 mb-6 tracking-tighter uppercase">Buddy Card</h2>

        <div className="space-y-6 text-left">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Display Name</p>
            <p className="text-2xl font-black text-slate-900">{session.displayName}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Neighborhood</p>
            <p className="text-lg font-bold text-slate-700">{area?.name}</p>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Activities</p>
            <div className="flex flex-wrap gap-1.5">
              {session.interests.map(i => (
                <span key={i} className="px-3 py-1 bg-amber-100 text-amber-800 font-black rounded-xl text-[10px] uppercase">{i}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Section */}
      <div className="bg-white rounded-[3rem] p-8 shadow-xl border-2 border-slate-50">
        <h3 className="text-xl font-black text-slate-900 mb-6 tracking-tighter uppercase flex items-center gap-2">
          <span className="text-2xl">⚙️</span> Settings
        </h3>

        <div className="space-y-8">
          {/* Invite Duration Scaling */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invite Expiry</label>
              <span className="text-xs font-bold text-amber-600 uppercase">
                {durationOptions.find(o => o.value === inviteDuration)?.label || '1h'}
              </span>
            </div>
            <div className="flex bg-slate-50 p-1.5 rounded-2xl gap-2">
              {durationOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onUpdateInviteDuration(opt.value)}
                  className={`flex-1 py-3 rounded-xl font-black transition-all text-xs ${
                    inviteDuration === opt.value 
                    ? 'bg-amber-400 text-amber-950 shadow-md scale-[1.02]' 
                    : 'text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size Scaling */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Text Size</label>
              <span className="text-xs font-bold text-amber-600 uppercase">{accessibility.fontSize.replace('-', ' ')}</span>
            </div>
            <div className="flex bg-slate-50 p-1.5 rounded-2xl gap-2">
              {(['standard', 'large', 'extra-large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => onUpdateAccessibility({ fontSize: size })}
                  className={`flex-1 py-3 rounded-xl font-black transition-all ${
                    accessibility.fontSize === size 
                    ? 'bg-amber-400 text-amber-950 shadow-md scale-[1.02]' 
                    : 'text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <span className={size === 'standard' ? 'text-xs' : size === 'large' ? 'text-base' : 'text-xl'}>A</span>
                </button>
              ))}
            </div>
          </div>

          {/* High Contrast Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
            <div>
              <p className="font-black text-slate-900 leading-tight">High Contrast</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Better readability</p>
            </div>
            <button
              onClick={() => onUpdateAccessibility({ contrastMode: accessibility.contrastMode === 'normal' ? 'high' : 'normal' })}
              className={`w-14 h-8 rounded-full relative transition-colors duration-300 ${accessibility.contrastMode === 'high' ? 'bg-amber-500' : 'bg-slate-200'}`}
              aria-pressed={accessibility.contrastMode === 'high'}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ${accessibility.contrastMode === 'high' ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {/* Screen Reader Mode */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
            <div>
              <p className="font-black text-slate-900 leading-tight">Screen Reader</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Optimized voice labels</p>
            </div>
            <button
              onClick={() => onUpdateAccessibility({ screenReaderOptimized: !accessibility.screenReaderOptimized })}
              className={`w-14 h-8 rounded-full relative transition-colors duration-300 ${accessibility.screenReaderOptimized ? 'bg-amber-500' : 'bg-slate-200'}`}
              aria-pressed={accessibility.screenReaderOptimized}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ${accessibility.screenReaderOptimized ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4 pb-12">
        <button onClick={onReset} className="w-full py-4 bg-red-50 text-red-600 font-black rounded-[2rem] text-[10px] uppercase tracking-[0.2em] border-2 border-red-100 shadow-sm active:bg-red-100 transition-colors">End Session & Delete Data</button>
        <p className="text-[10px] text-slate-300 font-black text-center uppercase tracking-widest leading-loose">
          Data is never stored permanently.
        </p>
      </div>
    </div>
  );
};
