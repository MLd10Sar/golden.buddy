
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
  "Stay in public view at all times.",
  "Bring a fully charged mobile phone.",
  "Tell a family member your plans.",
  "Meet during daylight hours if possible.",
  "Trust your gut—leave if you feel unsafe."
];

const SAFE_SPOTS = [
  "Town Public Library",
  "Main Street Coffee Shops",
  "Senior Community Center",
  "Public Parks with seating",
  "Busy Activity Clubs"
];

export const Dashboard: React.FC<DashboardProps> = ({ session, invites, remotePeers, onSendInvite, onRespond, onReset }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const incoming = useMemo(() => 
    invites.filter(i => i.toSessionId === session.id && i.status === 'PENDING'), 
  [invites, session.id]);

  const activeMatch = useMemo(() => 
    invites.find(i => 
      i.status === 'ACCEPTED' && 
      (i.fromSessionId === session.id || i.toSessionId === session.id) &&
      (Date.now() - (i.respondedAt || 0) < 1800000) // 30 mins window
    ),
  [invites, session.id]);

  const buddy = useMemo(() => {
    if (!activeMatch) return null;
    const id = activeMatch.fromSessionId === session.id ? activeMatch.toSessionId : activeMatch.fromSessionId;
    return remotePeers.find(p => p.id === id);
  }, [activeMatch, remotePeers, session.id]);

  if (activeMatch) {
    return (
      <div className="p-8 space-y-8 h-full overflow-y-auto no-scrollbar pb-20 animate-pop">
        {/* Match Card */}
        <div className="bg-indigo-700 rounded-[3.5rem] p-10 text-white shadow-2xl border-b-[14px] border-indigo-900">
          <div className="flex justify-between items-start mb-8">
            <div className="space-y-2">
              <span className="bg-pink-500 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">Match Confirmed!</span>
              <h3 className="text-4xl font-extrabold tracking-tighter leading-tight">Meet {buddy?.displayName || 'Neighbor'}</h3>
            </div>
            <div className="text-6xl animate-bounce">🎊</div>
          </div>

          <div className="bg-white/10 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/20 mb-10">
            <div className="flex items-center gap-5 mb-6">
              <span className="text-5xl">{ICONS[activeMatch.activity]}</span>
              <span className="text-3xl font-black uppercase tracking-tight">{activeMatch.activity}</span>
            </div>
            <div className="bg-white text-indigo-900 p-6 rounded-3xl shadow-xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-pink-500 mb-2">Smart Location Recommendation</p>
              <p className="font-bold text-lg leading-snug">
                {activeMatch.aiSuggestedSpot || "Locating a trusted public meeting point..."}
              </p>
            </div>
          </div>

          <button onClick={onReset} className="w-full py-7 bg-white text-indigo-900 rounded-[2.5rem] font-black text-xl shadow-2xl active:scale-95 transition-all uppercase tracking-tighter">End & Reset</button>
        </div>

        {/* Safety Guide */}
        <div className="clay-card p-10 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-pink-50 rounded-[1.5rem] flex items-center justify-center text-4xl shadow-inner">🛡️</div>
            <div>
              <h4 className="text-xl font-black text-indigo-900 uppercase tracking-tighter leading-none">Safety Rules</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Our Community Protocol</p>
            </div>
          </div>
          <div className="grid gap-4">
            {SAFETY_TIPS.map((tip, i) => (
              <div key={i} className="flex gap-5 items-start p-5 bg-indigo-50/50 rounded-3xl border border-indigo-50">
                <div className="w-7 h-7 bg-pink-500 rounded-full flex items-center justify-center text-white text-[11px] font-black shrink-0 mt-0.5 shadow-md">✓</div>
                <p className="text-base font-bold text-indigo-800 leading-tight">{tip}</p>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-indigo-50">
            <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest mb-4 text-center">Suggested Safe Spots</p>
            <div className="flex flex-wrap gap-3 justify-center">
              {SAFE_SPOTS.map((p, i) => (
                <span key={i} className="px-5 py-2.5 bg-indigo-50 text-indigo-600 font-black rounded-2xl text-[10px] uppercase border border-indigo-100">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative bg-indigo-50/20">
      <div className="p-8 space-y-8 flex-1 overflow-y-auto no-scrollbar pb-40">
        <div className="pt-4 space-y-2">
          <h2 className="text-5xl font-black text-indigo-900 tracking-tighter uppercase leading-none">Nearby</h2>
          <p className="text-pink-500 font-extrabold text-sm tracking-[0.2em] uppercase">
            {AREAS.find(a => a.id === session.areaId)?.name || 'General Area'}
          </p>
        </div>

        {remotePeers.length === 0 ? (
          <div className="py-24 text-center border-4 border-dashed border-indigo-100 rounded-[4rem] bg-white shadow-inner flex flex-col items-center">
            <div className="text-8xl mb-8 animate-pulse grayscale opacity-20">📡</div>
            <p className="text-xs font-black text-indigo-200 uppercase tracking-[0.4em] max-w-[200px] leading-relaxed">Scanning for neighbors in your mesh...</p>
          </div>
        ) : (
          <div className="grid gap-5 animate-pop">
            {remotePeers.map(peer => (
              <button 
                key={peer.id}
                onClick={() => setSelectedId(selectedId === peer.id ? null : peer.id)}
                className={`w-full text-left p-8 rounded-[3rem] border-[3px] transition-all flex items-center gap-6 relative clay-card ${
                  selectedId === peer.id ? 'border-pink-400 bg-pink-50 scale-[1.03] z-10' : 'border-transparent'
                }`}
              >
                <div className={`w-18 h-18 rounded-[2rem] flex items-center justify-center text-4xl font-black shadow-inner border-4 ${
                  selectedId === peer.id ? 'bg-pink-500 text-white border-white' : 'bg-indigo-50 text-indigo-200 border-indigo-100'
                }`}>
                  {peer.displayName[0]}
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-2xl text-indigo-900 leading-none tracking-tight">{peer.displayName}</h4>
                  <p className="text-[11px] font-black text-indigo-300 uppercase tracking-widest mt-2">{peer.interests.join(" • ")}</p>
                </div>
                {selectedId === peer.id && (
                  <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center text-white text-sm shadow-2xl animate-pop border-4 border-white">✓</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedId && (
        <div className="fixed bottom-14 left-10 right-10 z-[100] animate-pop">
          <button 
            onClick={() => { onSendInvite(selectedId, session.interests[0]); setSelectedId(null); }}
            className="w-full bg-indigo-900 text-white font-black py-8 rounded-[3rem] text-2xl shadow-2xl flex items-center justify-center gap-4 uppercase active:scale-95 transition-all tracking-tighter"
          >
            Send Request {ICONS[session.interests[0]]}
          </button>
        </div>
      )}

      {incoming.length > 0 && (
        <div className="fixed inset-0 bg-indigo-900/90 backdrop-blur-2xl z-[200] flex items-center justify-center p-10">
          <div className="bg-white rounded-[4rem] p-12 w-full max-w-sm shadow-2xl text-center border-b-[16px] border-pink-500 animate-pop">
            <div className="w-32 h-32 bg-pink-50 rounded-full flex items-center justify-center text-7xl mx-auto mb-10 shadow-inner border-[8px] border-white animate-bounce">👋</div>
            <h3 className="text-4xl font-black text-indigo-900 mb-4 tracking-tighter leading-none">New Buddy!</h3>
            <p className="text-slate-500 mb-12 font-bold text-xl leading-tight">
              <span className="text-indigo-900 uppercase font-black">{remotePeers.find(p => p.id === incoming[0].fromSessionId)?.displayName || 'A Neighbor'}</span> 
              <br/>wants to go for <span className="text-pink-600 font-black uppercase underline decoration-pink-100 underline-offset-8 decoration-[10px]">{incoming[0].activity}</span>.
            </p>
            <div className="flex flex-col gap-5">
              <button onClick={() => onRespond(incoming[0].id, 'ACCEPTED')} className="w-full py-8 bg-pink-500 text-white font-black rounded-[2.5rem] text-2xl shadow-2xl active:scale-95 transition-all uppercase tracking-tighter">Accept & Connect</button>
              <button onClick={() => onRespond(incoming[0].id, 'DECLINED')} className="w-full py-4 text-slate-300 font-black uppercase text-xs tracking-[0.3em]">Not Right Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
