
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

const PREDEFINED_SAFETY_TIPS = [
  "Meet in a well-lit, busy public place.",
  "Tell a family member or friend your plans.",
  "Bring your mobile phone, fully charged.",
  "If you feel uncomfortable, it's okay to leave.",
  "Meet during daylight hours."
];

const PREDEFINED_PLACES = [
  "Local Public Library",
  "Central Community Center",
  "Starbucks or local Coffee Shop",
  "Town Park Main Entrance",
  "Active Senior Center"
];

export const Dashboard: React.FC<DashboardProps> = ({ session, invites, remotePeers, onSendInvite, onRespond, onReset }) => {
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);

  // Incoming invites for me that are still pending
  const incoming = useMemo(() => 
    invites.filter(i => i.toSessionId === session.id && i.status === 'PENDING'), 
  [invites, session.id]);

  // Check if I have an active accepted match (either sent or received)
  const activeMatch = useMemo(() => 
    invites.find(i => 
      i.status === 'ACCEPTED' && 
      (i.fromSessionId === session.id || i.toSessionId === session.id) &&
      (Date.now() - (i.respondedAt || 0) < 3600000) // Within 1 hour
    ),
  [invites, session.id]);

  const buddy = useMemo(() => {
    if (!activeMatch) return null;
    const buddyId = activeMatch.fromSessionId === session.id ? activeMatch.toSessionId : activeMatch.fromSessionId;
    return remotePeers.find(p => p.id === buddyId);
  }, [activeMatch, remotePeers, session.id]);

  // If we have an active match, show the success screen
  if (activeMatch) {
    return (
      <div className="p-6 space-y-6 h-full overflow-y-auto no-scrollbar pb-24 animate-pop">
        <div className="bg-indigo-700 rounded-[3rem] p-8 text-white shadow-2xl border-b-[10px] border-indigo-900">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-1">
              <span className="bg-pink-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">Match Connected!</span>
              <h3 className="text-3xl font-extrabold tracking-tighter leading-tight">Meeting {buddy?.displayName || 'a Neighbor'}</h3>
            </div>
            <div className="text-5xl animate-bounce">🤝</div>
          </div>

          <div className="bg-white/10 rounded-[2rem] p-6 border border-white/10 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-4xl">{ICONS[activeMatch.activity]}</span>
              <span className="text-2xl font-black uppercase tracking-tight">{activeMatch.activity}</span>
            </div>
            <div className="bg-white text-indigo-900 p-5 rounded-2xl shadow-xl">
              <p className="text-[9px] font-black uppercase tracking-widest text-pink-500 mb-1">Recommended Safe Spot</p>
              <p className="font-bold text-base leading-snug">
                {activeMatch.aiSuggestedSpot || "Suggesting a busy public space nearby..."}
              </p>
            </div>
          </div>

          <button onClick={onReset} className="w-full py-5 bg-white text-indigo-900 rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all uppercase tracking-tighter">I'm Home / Finish</button>
        </div>

        <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-indigo-50 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">🛡️</div>
            <div>
              <h4 className="text-lg font-black text-indigo-900 uppercase tracking-tighter leading-none">Safety Checklist</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Read before leaving</p>
            </div>
          </div>
          <div className="space-y-3">
            {PREDEFINED_SAFETY_TIPS.map((tip, i) => (
              <div key={i} className="flex gap-4 items-start p-4 bg-indigo-50/50 rounded-2xl border border-indigo-50">
                <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0 shadow-md">✓</div>
                <p className="text-sm font-bold text-indigo-800 leading-tight">{tip}</p>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-indigo-50">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 text-center">Always Public Locations</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {PREDEFINED_PLACES.map((place, i) => (
                <span key={i} className="px-4 py-2 bg-indigo-50 text-indigo-600 font-bold rounded-xl text-[9px] uppercase border border-indigo-100">{place}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-indigo-50/20">
      <div className="p-6 space-y-6 flex-1 overflow-y-auto no-scrollbar pb-40">
        <div className="pt-2 space-y-1">
          <h2 className="text-4xl font-black text-indigo-900 tracking-tighter uppercase leading-none">Neighbors</h2>
          <p className="text-pink-500 font-extrabold text-xs tracking-widest uppercase">
            {AREAS.find(a => a.id === session.areaId)?.name || 'General Area'}
          </p>
        </div>

        {remotePeers.length === 0 ? (
          <div className="py-20 text-center border-4 border-dashed border-indigo-100 rounded-[3.5rem] bg-white shadow-inner flex flex-col items-center">
            <div className="text-7xl mb-6 animate-pulse grayscale opacity-20">📡</div>
            <p className="text-[11px] font-black text-indigo-200 uppercase tracking-[0.3em] max-w-[180px] leading-relaxed">Checking for activity buddies nearby...</p>
          </div>
        ) : (
          <div className="grid gap-4 animate-pop">
            {remotePeers.map(peer => (
              <button 
                key={peer.id}
                onClick={() => setSelectedPeerId(selectedPeerId === peer.id ? null : peer.id)}
                className={`w-full text-left p-6 rounded-[2.5rem] border-[3px] transition-all flex items-center gap-5 relative bg-white shadow-lg ${
                  selectedPeerId === peer.id ? 'border-pink-400 bg-pink-50 scale-[1.02] z-10' : 'border-transparent'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-black shadow-inner border-2 ${
                  selectedPeerId === peer.id ? 'bg-pink-500 text-white border-white' : 'bg-indigo-50 text-indigo-200 border-indigo-100'
                }`}>
                  {peer.displayName[0]}
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-xl text-indigo-900 leading-none tracking-tight">{peer.displayName}</h4>
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mt-1.5">{peer.interests.join(" • ")}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button for sending request */}
      {selectedPeerId && (
        <div className="fixed bottom-12 left-8 right-8 z-[100] animate-pop">
          <button 
            onClick={() => { onSendInvite(selectedPeerId, session.interests[0]); setSelectedPeerId(null); }}
            className="w-full bg-indigo-900 text-white font-black py-7 rounded-[2.5rem] text-xl shadow-2xl flex items-center justify-center gap-3 uppercase active:scale-95 transition-all tracking-tighter"
          >
            Invite to {session.interests[0]} {ICONS[session.interests[0]]}
          </button>
        </div>
      )}

      {/* Incoming Invite Notification / Modal */}
      {incoming.length > 0 && (
        <div className="fixed inset-0 bg-indigo-900/90 backdrop-blur-xl z-[200] flex items-center justify-center p-8">
          <div className="bg-white rounded-[3.5rem] p-10 w-full max-w-sm shadow-2xl text-center border-b-[12px] border-pink-500 animate-pop">
            <div className="w-24 h-24 bg-pink-50 rounded-full flex items-center justify-center text-6xl mx-auto mb-8 shadow-inner border-[6px] border-white animate-bounce">👋</div>
            <h3 className="text-3xl font-black text-indigo-900 mb-3 tracking-tighter leading-none">New Request!</h3>
            <p className="text-slate-500 mb-10 font-bold text-lg leading-tight px-2">
              <span className="text-indigo-900 uppercase font-black">{remotePeers.find(p => p.id === incoming[0].fromSessionId)?.displayName || 'A Neighbor'}</span> 
              <br/>is looking for a <span className="text-pink-600 font-black uppercase underline decoration-pink-100 underline-offset-8 decoration-[8px]">{incoming[0].activity}</span> buddy.
            </p>
            <div className="flex flex-col gap-4">
              <button onClick={() => onRespond(incoming[0].id, 'ACCEPTED')} className="w-full py-6 bg-pink-500 text-white font-black rounded-[2rem] text-xl shadow-xl active:scale-95 transition-all uppercase tracking-tighter">Accept & See Spot</button>
              <button onClick={() => onRespond(incoming[0].id, 'DECLINED')} className="w-full py-3 text-slate-300 font-black uppercase text-[10px] tracking-[0.2em] hover:text-red-400">Not interested</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
