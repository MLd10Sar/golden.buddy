import React, { useState, useMemo, useEffect } from 'react';
import { Session, Invite, Interest } from '../types';
import { AREAS } from '../constants';
import { getSmartMeetingSpot } from '../services/geminiService'; // Import the service

interface DashboardProps {
  session: Session;
  invites: Invite[];
  remotePeers: Session[];
  onSendInvite: (toId: string, activity: Interest) => void;
  onRespond: (inviteId: string, action: 'ACCEPTED' | 'DECLINED', note?: string, aiSpot?: any) => void;
  onUpdateNote: (inviteId: string, note: string) => void;
  onReset: () => void;
}

const ACTIVITY_ICONS: Record<Interest, string> = {
  'Walking': '👟', 'Chess': '♟️', 'Coffee & Chat': '☕', 'Bird Watching': '🦜', 'Gardening': '🌱'
};

const SAFETY_TIPS = [
  "Meet in a well-lit, busy public place.",
  "Tell a family member or friend your plans.",
  "Bring your mobile phone, fully charged.",
  "If you feel uncomfortable, it's okay to leave.",
  "Trust your gut—safety first!"
];

const SUGGESTED_PLACES = [
  "Public Library (Main Lobby)", "Local Coffee Shop / Café", "Senior Community Center", "Town Park Entrance", "Active Community Club"
];

export const Dashboard: React.FC<DashboardProps> = ({ session, invites, remotePeers, onSendInvite, onRespond, onReset }) => {
  const [selectedBuddyIds, setSelectedBuddyIds] = useState<string[]>([]);
  const [acceptanceNote, setAcceptanceNote] = useState('');
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const acceptedBuddies = useMemo(() => {
    const buddies: (Session & { role: 'sender' | 'receiver', activity: Interest, inviteId: string, aiSpot?: string })[] = [];
    invites.forEach(inv => {
      if (inv.status === 'ACCEPTED') {
        const peerId = inv.fromSessionId === session.id ? inv.toSessionId : inv.fromSessionId;
        const peerData = remotePeers.find(p => p.id === peerId);
        if (peerData) {
          buddies.push({ 
            ...peerData, 
            role: inv.fromSessionId === session.id ? 'receiver' : 'sender',
            activity: inv.activity,
            inviteId: inv.id,
            aiSpot: inv.aiSuggestedSpot
          });
        }
      }
    });
    return buddies;
  }, [invites, session.id, remotePeers]);

  useEffect(() => {
    if (acceptedBuddies.length > 0) setShowSafetyModal(true);
  }, [acceptedBuddies.length]);

  const handleAcceptInvite = async (invite: Invite) => {
    setIsAccepting(true);
    try {
      const areaName = AREAS.find(a => a.id === session.areaId)?.name || "Local Area";
      const spot = await getSmartMeetingSpot(areaName, invite.activity);
      onRespond(invite.id, 'ACCEPTED', acceptanceNote, spot);
      setAcceptanceNote('');
    } catch (e) {
      onRespond(invite.id, 'ACCEPTED', acceptanceNote);
    } finally {
      setIsAccepting(false);
    }
  };

  const incomingInvites = useMemo(() => {
    return invites.filter(inv => inv.toSessionId === session.id && inv.status === 'PENDING');
  }, [invites, session.id]);

  const toggleBuddySelection = (id: string) => {
    setSelectedBuddyIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const areaName = AREAS.find(a => a.id === session.areaId)?.name || "Local Area";

  return (
    <div className="flex flex-col h-full p-6 space-y-8 pb-32">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Neighbors</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400 font-black text-xs uppercase tracking-widest">📍 {areaName}</p>
          </div>
        </div>
        <button onClick={onReset} className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Reset</button>
      </div>

      {/* MATCHED BUDDIES CARD */}
      {acceptedBuddies.length > 0 && (
        <div className="animate-scaleUp bg-indigo-600 rounded-[3rem] p-8 text-white shadow-2xl space-y-6">
          <div className="flex justify-between items-center">
             <h3 className="text-xl font-black uppercase tracking-widest text-white/60">Your Match</h3>
             <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black animate-pulse">CONNECTED</span>
          </div>
          <div className="space-y-3">
            {acceptedBuddies.map(buddy => (
              <div key={buddy.id} className="bg-white/10 p-5 rounded-3xl border border-white/10 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-black">{buddy.displayName[0]}</div>
                    <div>
                      <span className="font-black text-xl block leading-none">{buddy.displayName}</span>
                      <span className="text-[10px] font-bold uppercase text-white/50 tracking-widest">Matched for {buddy.activity}</span>
                    </div>
                  </div>
                  <span className="text-3xl">{ACTIVITY_ICONS[buddy.activity]}</span>
                </div>
                <button onClick={() => setShowSafetyModal(true)} className="w-full py-3 bg-indigo-500/50 hover:bg-indigo-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors">Safety Tips & Spots</button>
              </div>
            ))}
          </div>
          <button onClick={onReset} className="w-full py-5 bg-white text-indigo-700 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-transform uppercase">Finish Session</button>
        </div>
      )}

      {/* NEIGHBOR LIST */}
      <div className="space-y-4">
        {remotePeers.length === 0 ? (
          <div className="py-20 text-center opacity-40">
            <div className="text-6xl animate-bounce">🔭</div>
            <p className="font-black text-slate-400 uppercase tracking-widest text-xs mt-4">Scanning neighborhood...</p>
          </div>
        ) : (
          remotePeers.map(peer => {
            const isSelected = selectedBuddyIds.includes(peer.id);
            const isAccepted = acceptedBuddies.some(b => b.id === peer.id);
            const isActiveNow = (now - peer.lastSeenAt) < 30000;
            return (
              <button key={peer.id} onClick={() => !isAccepted && toggleBuddySelection(peer.id)} disabled={isAccepted}
                className={`w-full text-left p-6 rounded-[2.5rem] bg-white border-4 transition-all flex items-center gap-6 relative shadow-sm ${isSelected ? 'border-amber-400 scale-[1.02]' : 'border-slate-100'} ${isAccepted ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-3xl font-black relative ${isSelected ? 'bg-amber-400 text-amber-950' : 'bg-amber-50 text-amber-600'}`}>
                  {peer.displayName[0]}
                  {isActiveNow && <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />}
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-xl text-slate-900 leading-tight">{peer.displayName}</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {peer.interests.map(i => <span key={i} className="text-[9px] font-black uppercase text-slate-400 tracking-wider bg-slate-50 px-2 py-0.5 rounded-md">{i}</span>)}
                  </div>
                </div>
                {isAccepted && <span className="text-[10px] font-black uppercase text-green-600 tracking-widest">Matched</span>}
              </button>
            );
          })
        )}
      </div>

      {/* SEND INVITE BUTTON */}
      {selectedBuddyIds.length > 0 && (
        <div className="fixed bottom-10 left-6 right-6 z-[150] animate-slideIn">
          <button onClick={() => { selectedBuddyIds.forEach(id => onSendInvite(id, session.interests[0])); setSelectedBuddyIds([]); }}
            className="w-full bg-amber-500 text-amber-950 font-black py-6 rounded-[2.5rem] text-xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
            Invite to {session.interests[0]} {ACTIVITY_ICONS[session.interests[0]]}
          </button>
        </div>
      )}

      {/* SAFETY TIPS POPUP WITH AI SPOT */}
      {showSafetyModal && acceptedBuddies.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[300] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white rounded-[3.5rem] p-8 w-full max-w-sm shadow-2xl flex flex-col items-center border-t-8 border-indigo-600 overflow-y-auto max-h-[90vh]">
            <div className="text-6xl mb-4">🛡️</div>
            <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter uppercase">Safety First</h3>
            
            {acceptedBuddies[0].aiSpot && (
              <div className="w-full mb-6 p-5 bg-indigo-50 border-2 border-indigo-100 rounded-[2rem]">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">AI Suggested Spot</p>
                {(() => {
                  try {
                    const spot = JSON.parse(acceptedBuddies[0].aiSpot!);
                    return (
                      <div className="space-y-1">
                        <p className="text-xl font-black text-slate-900 leading-tight">{spot.name}</p>
                        <p className="text-xs font-bold text-slate-600">{spot.reason}</p>
                        <p className="text-[10px] font-black text-indigo-500 uppercase mt-2">📍 {spot.directions}</p>
                      </div>
                    );
                  } catch (e) { return null; }
                })()}
              </div>
            )}

            <div className="w-full space-y-4 mb-8">
              <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] ml-2">Safety Steps</h4>
              {SAFETY_TIPS.map((tip, idx) => (
                <div key={idx} className="flex gap-4 items-start bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                  <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black text-[10px] shrink-0">✓</div>
                  <p className="text-sm font-bold text-slate-700 leading-tight">{tip}</p>
                </div>
              ))}
            </div>

            <button onClick={() => setShowSafetyModal(false)} className="w-full py-5 bg-indigo-600 text-white font-black rounded-[2rem] text-xl shadow-lg active:scale-95 uppercase">I Understand</button>
          </div>
        </div>
      )}

      {/* INCOMING INVITE MODAL */}
      {incomingInvites.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[250] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white rounded-[3.5rem] p-10 w-full max-w-sm shadow-2xl text-center border-t-8 border-green-500">
             <div className="text-7xl mb-6">🤝</div>
             <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Buddy Request!</h3>
             <p className="text-slate-600 mb-8 text-xl leading-snug">
               <span className="font-black text-slate-900">{remotePeers.find(p => p.id === incomingInvites[0].fromSessionId)?.displayName || 'A neighbor'}</span> 
               <br/>wants to {incomingInvites[0].activity} with you.
             </p>
             <textarea rows={2} value={acceptanceNote} onChange={(e) => setAcceptanceNote(e.target.value)} placeholder="Write a quick hello! (optional)" 
               className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-6 py-4 font-bold text-slate-800 focus:border-green-500 outline-none resize-none mb-8" />
             <div className="flex flex-col gap-4">
               <button disabled={isAccepting} onClick={() => handleAcceptInvite(incomingInvites[0])} 
                 className={`w-full py-6 ${isAccepting ? 'bg-slate-400' : 'bg-green-500'} text-white font-black rounded-[2.5rem] text-2xl shadow-xl active:scale-95 border-b-4 border-green-700 uppercase tracking-tighter`}>
                 {isAccepting ? 'Finding Spot...' : 'Accept'}
               </button>
               <button onClick={() => { onRespond(incomingInvites[0].id, 'DECLINED'); setAcceptanceNote(''); }} className="w-full py-4 text-red-500 font-black rounded-2xl text-xs uppercase tracking-widest border-2 border-red-50 shadow-sm active:bg-red-50">Reject</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
