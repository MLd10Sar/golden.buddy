
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
  "Choose a well-populated public place.",
  "Tell someone you trust about your meeting.",
  "Stay in the public area at all times.",
  "Don't share sensitive personal info.",
  "Keep your mobile phone nearby and charged."
];

const PLACE_CATEGORIES = [
  "Local Public Libraries",
  "Town Community Centers",
  "Bustling Coffee Shops",
  "Public Parks with Benches",
  "Senior Activity Clubs"
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
      <div className="p-6 space-y-6 flex-1 overflow-y-auto no-scrollbar pb-40">
        <div className="pt-2">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Neighbors</h2>
          <p className="text-slate-400 font-bold text-sm tracking-widest mt-1 uppercase">{areaName}</p>
        </div>

        {activeCoordination ? (
          <div className="space-y-6 animate-spring">
            {/* Match Success Card */}
            <div className="bg-[#4f46e5] rounded-[3rem] p-8 text-white shadow-2xl border-b-[10px] border-[#3730a3]">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <span className="bg-[#6366f1] text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest mb-3 inline-block shadow-sm">Match Confirmed</span>
                  <h3 className="text-3xl font-black tracking-tight leading-none">Meeting {buddy?.displayName || 'Neighbor'}</h3>
                </div>
                <div className="text-5xl animate-bounce">🎊</div>
              </div>

              <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] p-6 border border-white/20 mb-10 shadow-inner">
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-4xl drop-shadow-lg">{ACTIVITY_ICONS[activeCoordination.activity]}</span>
                  <span className="text-2xl font-black tracking-tight uppercase">{activeCoordination.activity}</span>
                </div>
                <div className="bg-white text-[#1e1b4b] p-6 rounded-2xl shadow-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#4f46e5] mb-2">Location Idea</p>
                  <p className="font-bold text-lg leading-snug">{activeCoordination.aiSuggestedSpot || "Finding a safe public spot..."}</p>
                </div>
              </div>

              <button onClick={onReset} className="w-full py-6 bg-white text-slate-900 rounded-[2.5rem] font-black text-xl shadow-2xl active:scale-95 transition-all uppercase tracking-tighter">Done & Finish</button>
            </div>

            {/* Enhanced Safety Section */}
            <div className="bg-white rounded-[3rem] p-8 border-2 border-slate-100 shadow-xl space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">🛡️</div>
                <div>
                   <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Safety First</h4>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Our shared community guide</p>
                </div>
              </div>
              
              <div className="grid gap-4">
                {SAFETY_TIPS.map((tip, i) => (
                  <div key={i} className="flex gap-4 items-start p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0 shadow-sm">✓</div>
                    <p className="text-sm font-bold text-slate-600 leading-tight">{tip}</p>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-slate-50">
                <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 text-center">Trusted Meeting Spots</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {PLACE_CATEGORIES.map((type, i) => (
                    <span key={i} className="px-4 py-2 bg-amber-50 text-amber-700 font-black rounded-xl text-[9px] border border-amber-100 uppercase tracking-widest">{type}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {remotePeers.length === 0 ? (
              <div className="py-24 text-center border-4 border-dashed border-slate-200 rounded-[3.5rem] bg-white flex flex-col items-center shadow-inner">
                <div className="text-8xl animate-pulse mb-8 drop-shadow-2xl">📡</div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] max-w-[180px] leading-relaxed">Finding active neighbors...</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {remotePeers.map(peer => (
                  <button 
                    key={peer.id}
                    onClick={() => setSelectedBuddyId(selectedBuddyId === peer.id ? null : peer.id)}
                    className={`w-full text-left p-6 rounded-[2.5rem] border-[3px] transition-all flex items-center gap-6 relative shadow-sm ${
                      selectedBuddyId === peer.id ? 'border-amber-400 bg-amber-50 shadow-2xl scale-[1.03] z-10' : 'border-slate-50 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-3xl font-black shadow-inner border-2 ${
                      selectedBuddyId === peer.id ? 'bg-amber-400 text-white border-white' : 'bg-slate-50 text-slate-300 border-slate-100'
                    }`}>
                      {peer.displayName[0]}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-black text-2xl text-slate-900 leading-none tracking-tight">{peer.displayName}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{peer.interests.join(" • ")}</p>
                    </div>
                    {selectedBuddyId === peer.id && (
                      <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white text-sm shadow-xl animate-spring border-4 border-white">✓</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Invite Button */}
      {selectedBuddyId && !activeCoordination && (
        <div className="fixed bottom-12 left-8 right-8 md:absolute md:bottom-10 z-[100] animate-spring">
          <button 
            onClick={() => { onSendInvite(selectedBuddyId, session.interests[0]); setSelectedBuddyId(null); }}
            className="w-full bg-slate-900 text-white font-black py-8 rounded-[2.5rem] text-2xl shadow-[0_25px_60px_-15px_rgba(15,23,42,0.6)] flex items-center justify-center gap-4 uppercase active:scale-95 transition-all tracking-tighter"
          >
            Send Invite {ACTIVITY_ICONS[session.interests[0]]}
          </button>
        </div>
      )}

      {/* High-Impact Match Overlay */}
      {incomingInvites.length > 0 && !activeCoordination && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[200] flex items-center justify-center p-8">
          <div className="bg-white rounded-[4rem] p-12 w-full max-w-sm shadow-2xl text-center border-b-[16px] border-emerald-500 animate-spring">
             <div className="w-28 h-28 bg-emerald-50 rounded-full flex items-center justify-center text-6xl mx-auto mb-8 shadow-inner border-[6px] border-white animate-bounce">👋</div>
             <h3 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter leading-none">Buddy Request!</h3>
             <p className="text-slate-500 mb-12 font-bold text-lg leading-tight">
               <span className="text-slate-900 uppercase font-black">{remotePeers.find(p => p.id === incomingInvites[0].fromSessionId)?.displayName || 'Neighbor'}</span> 
               <br/>invites you for <span className="text-emerald-600 font-black uppercase underline decoration-emerald-200 underline-offset-8">{incomingInvites[0].activity}</span>.
             </p>
             <div className="flex flex-col gap-4">
               <button onClick={() => onRespond(incomingInvites[0].id, 'ACCEPTED')} className="w-full py-7 bg-emerald-500 text-white font-black rounded-[2.5rem] text-2xl shadow-2xl active:scale-95 transition-all uppercase tracking-tighter">Accept Match</button>
               <button onClick={() => onRespond(incomingInvites[0].id, 'DECLINED')} className="w-full py-4 text-slate-300 font-black uppercase text-xs tracking-widest">Maybe next time</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
