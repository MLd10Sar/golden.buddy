
import React, { useState, useMemo } from 'react';
import { Session, Invite, Interest } from '../types';
import { AREAS } from '../constants';

interface DashboardProps {
  session: Session;
  invites: Invite[];
  remotePeers: Session[];
  onSendInvite: (toId: string, activity: Interest) => void;
  onRespond: (inviteId: string, action: 'ACCEPTED' | 'DECLINED', note?: string) => void;
  onUpdateNote: (inviteId: string, note: string) => void;
  onReset: () => void;
}

const ACTIVITY_ICONS: Record<Interest, string> = {
  'Walking': '👟',
  'Chess': '♟️',
  'Coffee & Chat': '☕',
  'Bird Watching': '🦜',
  'Gardening': '🌱'
};

const SAFETY_TIPS = [
  "Meet only in well-lit public places.",
  "Tell a family member about your plans.",
  "Bring a fully charged mobile phone.",
  "Trust your intuition; it's okay to leave.",
  "Do not share private home addresses."
];

const PUBLIC_PLACE_TYPES = [
  "Local Public Libraries",
  "Town Community Centers",
  "Coffee Shops with seating",
  "Public Parks with benches",
  "Senior Activity Centers"
];

export const Dashboard: React.FC<DashboardProps> = ({ session, invites, remotePeers, onSendInvite, onRespond, onReset }) => {
  const [selectedBuddyId, setSelectedBuddyId] = useState<string | null>(null);

  const incomingInvites = useMemo(() => 
    invites.filter(inv => inv.toSessionId === session.id && inv.status === 'PENDING'), 
  [invites, session.id]);

  const activeCoordination = useMemo(() => 
    invites.find(inv => 
      inv.status === 'ACCEPTED' && 
      (inv.fromSessionId === session.id || inv.toSessionId === session.id) &&
      (Date.now() - (inv.respondedAt || 0) < 3600000)
    ),
  [invites, session.id]);

  const buddy = useMemo(() => {
    if (!activeCoordination) return null;
    const pid = activeCoordination.fromSessionId === session.id ? activeCoordination.toSessionId : activeCoordination.fromSessionId;
    return remotePeers.find(p => p.id === pid);
  }, [activeCoordination, remotePeers, session.id]);

  const areaName = AREAS.find(a => a.id === session.areaId)?.name || "Local Area";

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 space-y-6 flex-1 overflow-y-auto no-scrollbar pb-32">
        <div className="space-y-1 pt-2">
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-none uppercase">Buddy Feed</h2>
          <p className="text-slate-400 font-bold text-sm tracking-wide">{areaName}</p>
        </div>

        {activeCoordination ? (
          <div className="space-y-6 animate-spring">
            {/* Match Success Card */}
            <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-2xl border-b-8 border-indigo-800">
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <span className="bg-indigo-400 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest leading-none mb-2 inline-block">Perfect Match!</span>
                  <h3 className="text-3xl font-extrabold tracking-tight">Meet {buddy?.displayName || 'your neighbor'}</h3>
                </div>
                <div className="text-5xl">🎊</div>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-3xl p-6 border border-white/20 mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-4xl">{ACTIVITY_ICONS[activeCoordination.activity]}</span>
                  <span className="text-2xl font-black">{activeCoordination.activity}</span>
                </div>
                <div className="bg-white text-indigo-900 p-5 rounded-2xl shadow-inner">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 mb-2">Location Strategy</p>
                  <p className="font-bold leading-relaxed">{activeCoordination.aiSuggestedSpot || "Suggesting a safe public spot..."}</p>
                </div>
              </div>

              <button onClick={onReset} className="w-full py-6 bg-white text-slate-900 rounded-[2rem] font-extrabold text-lg shadow-xl active:scale-95 transition-all">End and Return</button>
            </div>

            {/* Safety Tips Card */}
            <div className="bg-white rounded-[2.5rem] p-8 border-2 border-slate-100 shadow-lg space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-xl">🛡️</div>
                <h4 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight">Safety Protocol</h4>
              </div>
              <ul className="space-y-4">
                {SAFETY_TIPS.map((tip, i) => (
                  <li key={i} className="flex gap-4 items-start">
                    <span className="w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center text-[10px] font-black text-amber-950 shrink-0 mt-0.5">✓</span>
                    <p className="text-sm font-bold text-slate-600 leading-tight">{tip}</p>
                  </li>
                ))}
              </ul>
              <div className="pt-4 border-t border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Suggested Spot Types</p>
                <div className="flex flex-wrap gap-2">
                  {PUBLIC_PLACE_TYPES.map((type, i) => (
                    <span key={i} className="px-3 py-1.5 bg-slate-50 text-slate-500 font-extrabold rounded-xl text-[9px] border border-slate-100">{type}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {remotePeers.length === 0 ? (
              <div className="py-24 text-center border-4 border-dashed border-slate-200 rounded-[3.5rem] bg-white/50 flex flex-col items-center">
                <div className="text-7xl animate-pulse mb-6">📡</div>
                <p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest max-w-[200px] leading-relaxed">Scanning for neighbors active in {areaName}...</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {remotePeers.map(peer => (
                  <button 
                    key={peer.id}
                    onClick={() => setSelectedBuddyId(selectedBuddyId === peer.id ? null : peer.id)}
                    className={`w-full text-left p-6 rounded-[2rem] border-2 transition-all flex items-center gap-5 relative group ${
                      selectedBuddyId === peer.id ? 'border-amber-400 bg-amber-50 shadow-xl scale-[1.02]' : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black ${
                      selectedBuddyId === peer.id ? 'bg-amber-400 text-amber-950 shadow-inner' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {peer.displayName[0]}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-extrabold text-xl text-slate-900 leading-none">{peer.displayName}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{peer.interests.join(" • ")}</p>
                    </div>
                    {selectedBuddyId === peer.id && (
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs shadow-lg animate-spring">✓</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Persistent Selection Button */}
      {selectedBuddyId && !activeCoordination && (
        <div className="fixed bottom-10 left-6 right-6 md:absolute md:bottom-8 z-[100] animate-spring">
          <button 
            onClick={() => { onSendInvite(selectedBuddyId, session.interests[0]); setSelectedBuddyId(null); }}
            className="w-full bg-slate-900 text-white font-black py-7 rounded-[2rem] text-xl shadow-[0_25px_60px_-15px_rgba(15,23,42,0.6)] flex items-center justify-center gap-3 uppercase active:scale-95 transition-all tracking-tight"
          >
            Invite to {ACTIVITY_ICONS[session.interests[0]]} {session.interests[0]}
          </button>
        </div>
      )}

      {/* High-Impact Invitation Overlay */}
      {incomingInvites.length > 0 && !activeCoordination && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white rounded-[3.5rem] p-10 w-full max-w-xs shadow-2xl text-center border-b-[12px] border-green-500 animate-spring">
             <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner border-4 border-white animate-bounce">👋</div>
             <h3 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">New Neighbor!</h3>
             <p className="text-slate-500 mb-10 font-bold text-base leading-relaxed">
               <span className="text-slate-900 uppercase font-black">{remotePeers.find(p => p.id === incomingInvites[0].fromSessionId)?.displayName || 'A neighbor'}</span> 
               <br/>invites you for a <span className="text-green-600 font-black uppercase underline decoration-green-200 decoration-4 underline-offset-4">{incomingInvites[0].activity}</span>.
             </p>
             <div className="flex flex-col gap-4">
               <button onClick={() => onRespond(incomingInvites[0].id, 'ACCEPTED')} className="w-full py-6 bg-green-500 text-white font-black rounded-[2rem] text-xl shadow-xl active:scale-95 transition-all">Accept Match</button>
               <button onClick={() => onRespond(incomingInvites[0].id, 'DECLINED')} className="w-full py-3 text-slate-300 font-extrabold uppercase text-[10px] tracking-widest">Not today</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
