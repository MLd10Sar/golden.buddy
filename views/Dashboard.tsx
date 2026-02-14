
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

const TIPS = [
  "Choose busy public spaces.",
  "Tell a friend your location.",
  "Keep your mobile nearby.",
  "Trust your intuition always.",
  "Daylight meetings are best."
];

export const Dashboard: React.FC<DashboardProps> = ({ session, invites, remotePeers, onSendInvite, onRespond, onReset }) => {
  const [sel, setSel] = useState<string | null>(null);

  const incoming = useMemo(() => 
    invites.filter(i => i.toSessionId === session.id && i.status === 'PENDING'), 
  [invites, session.id]);

  const match = useMemo(() => 
    invites.find(i => 
      i.status === 'ACCEPTED' && 
      (i.fromSessionId === session.id || i.toSessionId === session.id) &&
      (Date.now() - (i.respondedAt || 0) < 3600000)
    ),
  [invites, session.id]);

  const buddy = useMemo(() => {
    if (!match) return null;
    const bid = match.fromSessionId === session.id ? match.toSessionId : match.fromSessionId;
    return remotePeers.find(p => p.id === bid);
  }, [match, remotePeers, session.id]);

  if (match) {
    return (
      <div className="p-6 space-y-6 h-full overflow-y-auto no-scrollbar pb-20 animate-spring-up">
        {/* Success Card */}
        <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl border-b-[12px] border-emerald-600">
           <div className="flex justify-between items-start mb-8">
             <div className="space-y-2">
               <span className="bg-emerald-500 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">Match Confirmed</span>
               <h3 className="text-4xl font-black tracking-tighter leading-none">Meeting {buddy?.displayName || 'Neighbor'}</h3>
             </div>
             <div className="text-6xl animate-bounce">🌱</div>
           </div>

           <div className="bg-white/5 rounded-[2rem] p-6 border border-white/10 mb-8">
             <div className="flex items-center gap-4 mb-4">
               <span className="text-4xl">{ICONS[match.activity]}</span>
               <span className="text-2xl font-black uppercase tracking-tight">{match.activity}</span>
             </div>
             <div className="bg-white text-slate-900 p-6 rounded-2xl shadow-xl">
               <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Safe Spot Idea</p>
               <p className="font-bold text-lg leading-snug">{match.aiSuggestedSpot || "Finding safe public spot..."}</p>
             </div>
           </div>

           <button onClick={onReset} className="w-full py-6 bg-emerald-500 text-slate-950 rounded-[2rem] font-black text-xl shadow-xl active:scale-95 transition-all uppercase tracking-tighter">I'm Home / Finish</button>
        </div>

        {/* Safety Guide */}
        <div className="clay-card p-10 space-y-8">
           <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-4xl shadow-inner">🛡️</div>
             <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Safety Guide</h4>
           </div>
           <div className="grid gap-3">
             {TIPS.map((tip, i) => (
               <div key={i} className="flex gap-4 items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0 shadow-sm">✓</div>
                 <p className="text-sm font-bold text-slate-600 leading-tight">{tip}</p>
               </div>
             ))}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="p-6 space-y-6 flex-1 overflow-y-auto no-scrollbar pb-40">
        <div className="pt-4 space-y-1">
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">Nearby</h2>
          <p className="text-emerald-500 font-bold text-sm tracking-[0.2em] uppercase">
            {AREAS.find(a => a.id === session.areaId)?.name || 'Community Mesh'}
          </p>
        </div>

        {remotePeers.length === 0 ? (
          <div className="py-24 text-center border-4 border-dashed border-slate-200 rounded-[4rem] bg-white shadow-inner flex flex-col items-center">
            <div className="text-8xl mb-8 animate-pulse grayscale opacity-20">📡</div>
            <p className="text-xs font-black text-slate-300 uppercase tracking-[0.4em] max-w-[180px]">Scanning for mesh neighbors...</p>
          </div>
        ) : (
          <div className="grid gap-5">
            {remotePeers.map(peer => (
              <button 
                key={peer.id}
                onClick={() => setSel(sel === peer.id ? null : peer.id)}
                className={`w-full text-left p-8 rounded-[3rem] border-[4px] transition-all flex items-center gap-6 relative clay-card ${
                  sel === peer.id ? 'border-emerald-500 bg-emerald-50/30 scale-[1.02] z-10' : 'border-transparent'
                }`}
              >
                <div className={`w-18 h-18 rounded-[2rem] flex items-center justify-center text-4xl font-black shadow-inner border-2 ${
                  sel === peer.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'
                }`}>
                  {peer.displayName[0]}
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-2xl text-slate-900 leading-none tracking-tight">{peer.displayName}</h4>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-2">{peer.interests.join(" • ")}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {sel && (
        <div className="fixed bottom-12 left-8 right-8 z-[100] animate-spring-up">
          <button 
            onClick={() => { onSendInvite(sel, session.interests[0]); setSel(null); }}
            className="w-full bg-slate-900 text-white font-black py-8 rounded-[2.5rem] text-2xl shadow-2xl flex items-center justify-center gap-4 uppercase active:scale-95 transition-all tracking-tighter border-b-[8px] border-emerald-600"
          >
            Invite to {session.interests[0]} {ICONS[session.interests[0]]}
          </button>
        </div>
      )}

      {incoming.length > 0 && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[200] flex items-center justify-center p-8">
          <div className="bg-white rounded-[4rem] p-12 w-full max-w-sm shadow-2xl text-center border-b-[16px] border-emerald-500 animate-spring-up">
            <div className="w-28 h-28 bg-emerald-50 rounded-full flex items-center justify-center text-7xl mx-auto mb-10 shadow-inner animate-bounce">👋</div>
            <h3 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter leading-none uppercase">Buddy Invite!</h3>
            <p className="text-slate-500 mb-12 font-bold text-xl leading-tight">
              <span className="text-slate-900 uppercase font-black">{remotePeers.find(p => p.id === incoming[0].fromSessionId)?.displayName || 'A Neighbor'}</span> 
              <br/>wants to go for <span className="text-emerald-600 font-black uppercase underline decoration-emerald-100 underline-offset-8 decoration-[10px]">{incoming[0].activity}</span>.
            </p>
            <div className="flex flex-col gap-5">
              <button onClick={() => onRespond(incoming[0].id, 'ACCEPTED')} className="w-full py-8 bg-emerald-500 text-slate-950 font-black rounded-[2.5rem] text-2xl shadow-2xl active:scale-95 transition-all uppercase tracking-tighter">Accept Match</button>
              <button onClick={() => onRespond(incoming[0].id, 'DECLINED')} className="w-full py-4 text-slate-300 font-black uppercase text-xs tracking-widest">Maybe next time</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
