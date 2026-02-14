
import React, { useState, useMemo } from 'react';
import { Session, Invite, Interest } from '../types';
import { AREAS } from '../constants';

interface DashboardProps {
  session: Session;
  invites: Invite[];
  remotePeers: Session[];
  onSendInvite: (toId: string, activity: Interest) => void;
  onRespond: (inviteId: string, action: 'ACCEPTED' | 'DECLINED') => void;
  onReset: () => void;
}

const ICONS: Record<Interest, string> = {
  'Walking': '👟',
  'Chess': '♟️',
  'Coffee & Chat': '☕',
  'Bird Watching': '🦜',
  'Gardening': '🌱'
};

const SAFETY_TIPS = [
  "Meet only in well-lit public places.",
  "Tell a family member where you are going.",
  "Bring a charged mobile phone.",
  "If you feel uncomfortable, it's okay to leave.",
  "Keep personal financial info private."
];

const PLACES = [
  "Local Public Libraries",
  "Town Community Centers",
  "Busy Coffee Shops",
  "Parks with benches",
  "Senior Social Clubs"
];

export const Dashboard: React.FC<DashboardProps> = ({ session, invites, remotePeers, onSendInvite, onRespond, onReset }) => {
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);

  const incoming = useMemo(() => 
    invites.filter(i => i.toSessionId === session.id && i.status === 'PENDING'), 
  [invites, session.id]);

  const activeMatch = useMemo(() => 
    invites.find(i => 
      i.status === 'ACCEPTED' && 
      (i.fromSessionId === session.id || i.toSessionId === session.id) &&
      (Date.now() - (i.respondedAt || 0) < 3600000)
    ),
  [invites, session.id]);

  const buddy = useMemo(() => {
    if (!activeMatch) return null;
    const id = activeMatch.fromSessionId === session.id ? activeMatch.toSessionId : activeMatch.fromSessionId;
    return remotePeers.find(p => p.id === id);
  }, [activeMatch, remotePeers, session.id]);

  if (activeMatch) {
    return (
      <div className="p-6 space-y-6 h-full overflow-y-auto no-scrollbar pb-10 animate-spring">
        <div className="bg-indigo-600 rounded-[3rem] p-10 text-white shadow-2xl border-b-[12px] border-indigo-900">
           <div className="flex justify-between items-start mb-8">
             <div className="space-y-2">
               <span className="bg-indigo-400 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">Success!</span>
               <h3 className="text-4xl font-black tracking-tighter leading-none">Meeting {buddy?.displayName || 'Buddy'}</h3>
             </div>
             <div className="text-6xl animate-bounce">🤝</div>
           </div>

           <div className="bg-white/10 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/20 mb-8">
             <div className="flex items-center gap-5 mb-6">
               <span className="text-5xl">{ICONS[activeMatch.activity]}</span>
               <span className="text-3xl font-black uppercase tracking-tight">{activeMatch.activity}</span>
             </div>
             <div className="bg-white text-indigo-900 p-6 rounded-[2rem] shadow-inner">
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-3 text-center">Location Guide</p>
               <p className="font-bold text-lg leading-snug text-center">
                 {activeMatch.aiSuggestedSpot || "Locating a trusted safe spot nearby..."}
               </p>
             </div>
           </div>

           <button onClick={onReset} className="w-full py-7 bg-white text-slate-900 rounded-[2.5rem] font-black text-xl shadow-xl active:scale-95 transition-all uppercase tracking-tighter">End Coordination</button>
        </div>

        <div className="clay-card p-8 space-y-8">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-3xl">🛡️</div>
             <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Safety Rules</h4>
           </div>
           <div className="grid gap-3">
             {SAFETY_TIPS.map((tip, i) => (
               <div key={i} className="flex gap-4 items-start p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0 mt-0.5 shadow-sm">✓</div>
                 <p className="text-sm font-bold text-slate-600 leading-tight">{tip}</p>
               </div>
             ))}
           </div>
           <div className="pt-6 border-t border-slate-50">
             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4 text-center">Safe Place Categories</p>
             <div className="flex flex-wrap gap-2 justify-center">
               {PLACES.map((p, i) => (
                 <span key={i} className="px-4 py-2 bg-amber-50 text-amber-700 font-black rounded-xl text-[9px] uppercase border border-amber-100">{p}</span>
               ))}
             </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="p-6 space-y-6 flex-1 overflow-y-auto no-scrollbar pb-40">
        <div className="pt-4 space-y-1">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Neighbors</h2>
          <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">{AREAS.find(a => a.id === session.areaId)?.name || 'Nearby'}</p>
        </div>

        {remotePeers.length === 0 ? (
          <div className="py-24 text-center border-4 border-dashed border-slate-200 rounded-[3.5rem] bg-white shadow-inner flex flex-col items-center">
             <div className="text-8xl mb-8 animate-pulse grayscale opacity-30">📡</div>
             <p className="text-xs font-black text-slate-300 uppercase tracking-[0.3em] max-w-[180px]">Looking for neighbors...</p>
          </div>
        ) : (
          <div className="grid gap-4 animate-spring">
            {remotePeers.map(peer => (
              <button 
                key={peer.id}
                onClick={() => setSelectedPeerId(selectedPeerId === peer.id ? null : peer.id)}
                className={`w-full text-left p-6 rounded-[2.5rem] border-[3px] transition-all flex items-center gap-6 relative clay-card ${
                  selectedPeerId === peer.id ? 'border-amber-400 bg-amber-50 scale-[1.03] z-10' : 'border-transparent'
                }`}
              >
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-3xl font-black shadow-inner border-2 ${
                  selectedPeerId === peer.id ? 'bg-amber-400 text-white border-white' : 'bg-slate-100 text-slate-300 border-slate-200'
                }`}>
                  {peer.displayName[0]}
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-2xl text-slate-900 leading-none tracking-tight">{peer.displayName}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{peer.interests.join(" • ")}</p>
                </div>
                {selectedPeerId === peer.id && (
                  <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white text-sm shadow-xl animate-spring border-4 border-white">✓</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedPeerId && (
        <div className="fixed bottom-12 left-8 right-8 z-[100] animate-spring">
          <button 
            onClick={() => { onSendInvite(selectedPeerId, session.interests[0]); setSelectedPeerId(null); }}
            className="w-full bg-slate-900 text-white font-black py-8 rounded-[2.5rem] text-2xl shadow-2xl flex items-center justify-center gap-4 uppercase active:scale-95 transition-all tracking-tighter"
          >
            Invite to {session.interests[0]} {ICONS[session.interests[0]]}
          </button>
        </div>
      )}

      {incoming.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[200] flex items-center justify-center p-8">
           <div className="bg-white rounded-[4rem] p-12 w-full max-w-sm shadow-2xl text-center border-b-[16px] border-emerald-500 animate-spring">
              <div className="w-28 h-28 bg-emerald-50 rounded-full flex items-center justify-center text-6xl mx-auto mb-8 shadow-inner border-[6px] border-white animate-bounce">👋</div>
              <h3 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter leading-none">New Request!</h3>
              <p className="text-slate-500 mb-12 font-bold text-lg leading-tight">
                <span className="text-slate-900 uppercase font-black">{remotePeers.find(p => p.id === incoming[0].fromSessionId)?.displayName || 'Neighbor'}</span> 
                <br/>wants to go for <span className="text-emerald-600 font-black uppercase underline decoration-emerald-200 underline-offset-8">{incoming[0].activity}</span>.
              </p>
              <div className="flex flex-col gap-4">
                <button onClick={() => onRespond(incoming[0].id, 'ACCEPTED')} className="w-full py-7 bg-emerald-500 text-white font-black rounded-[2.5rem] text-2xl shadow-2xl active:scale-95 transition-all uppercase tracking-tighter">Accept Match</button>
                <button onClick={() => onRespond(incoming[0].id, 'DECLINED')} className="w-full py-4 text-slate-300 font-black uppercase text-xs tracking-widest">Maybe Later</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
