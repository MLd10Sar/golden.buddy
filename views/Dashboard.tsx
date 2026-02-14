
import React, { useState, useMemo, useEffect } from 'react';
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

export const Dashboard: React.FC<DashboardProps> = ({ session, invites, remotePeers, onSendInvite, onRespond, onUpdateNote, onReset }) => {
  const [selectedBuddyIds, setSelectedBuddyIds] = useState<string[]>([]);
  const [acceptanceNote, setAcceptanceNote] = useState('');
  const [outgoingGroupNote, setOutgoingGroupNote] = useState('');
  const [isSendingGroupInvite, setIsSendingGroupInvite] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Keep 'now' updated to correctly show 'Active Now' indicators
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Incoming invites strictly for this user
  const incomingInvites = useMemo(() => {
    return invites.filter(inv => inv.toSessionId === session.id && inv.status === 'PENDING');
  }, [invites, session.id]);

  // People who have accepted invites sent by this user OR invites this user accepted
  const acceptedBuddies = useMemo(() => {
    const buddies: (Session & { role: 'sender' | 'receiver', activity: Interest })[] = [];
    
    invites.forEach(inv => {
      if (inv.status === 'ACCEPTED') {
        const peerId = inv.fromSessionId === session.id ? inv.toSessionId : inv.fromSessionId;
        const peerData = remotePeers.find(p => p.id === peerId);
        if (peerData) {
          buddies.push({ 
            ...peerData, 
            role: inv.fromSessionId === session.id ? 'receiver' : 'sender',
            activity: inv.activity
          });
        }
      }
    });
    
    return buddies;
  }, [invites, session.id, remotePeers]);

  const toggleBuddySelection = (id: string) => {
    setSelectedBuddyIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSendGroupInvite = () => {
    if (selectedBuddyIds.length === 0) return;
    setIsSendingGroupInvite(true);
  };

  const confirmGroupInvite = () => {
    selectedBuddyIds.forEach(id => {
      // For groups, we use the first interest as a natural default
      onSendInvite(id, session.interests[0] || 'Walking');
    });
    
    setSelectedBuddyIds([]);
    setIsSendingGroupInvite(false);
  };

  const areaName = AREAS.find(a => a.id === session.areaId)?.name || "Local Area";

  return (
    <div className="flex flex-col h-full p-6 space-y-8 pb-32">
      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">NEIGHBORS</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400 font-black text-xs uppercase tracking-widest">
              📍 {areaName}
            </p>
            <span className="flex items-center gap-1.5 bg-green-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black text-green-600 uppercase tracking-tighter">Live Sync</span>
            </span>
          </div>
        </div>
        <button onClick={onReset} className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1">Reset</button>
      </div>

      {/* ACTIVE WALKING GROUP (Mission Control) */}
      {acceptedBuddies.length > 0 && (
        <div className="animate-scaleUp bg-indigo-600 rounded-[3rem] p-8 text-white shadow-2xl space-y-6">
          <div className="flex justify-between items-center">
             <h3 className="text-xl font-black uppercase tracking-widest text-white/60">Your Group</h3>
             <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black animate-pulse">LIVE</span>
          </div>

          <div className="flex -space-x-4 overflow-hidden mb-4">
            {acceptedBuddies.map(buddy => (
              <div key={buddy.id} className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl shadow-lg ring-4 ring-indigo-600">
                {buddy.displayName[0]}
              </div>
            ))}
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-3xl shadow-lg ring-4 ring-indigo-600 border border-white/20">
              👤
            </div>
          </div>

          <div className="space-y-3">
            {acceptedBuddies.map(buddy => (
              <div key={buddy.id} className="flex justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3">
                  <span className="text-xl" role="img" aria-label={buddy.activity}>
                    {ACTIVITY_ICONS[buddy.activity] || '✨'}
                  </span>
                  <span className="font-black text-lg">{buddy.displayName}</span>
                </div>
                <span className="text-[10px] font-black uppercase bg-white/20 px-2 py-1 rounded-lg">
                  {buddy.activity}
                </span>
              </div>
            ))}
          </div>

          <button onClick={onReset} className="w-full py-5 bg-white text-indigo-700 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-transform uppercase">
            Finish Walk
          </button>
        </div>
      )}

      {/* NEIGHBOR DISCOVERY LIST */}
      <div className="space-y-4">
        {remotePeers.length === 0 ? (
          <div className="py-20 text-center space-y-4 opacity-40">
            <div className="text-6xl animate-bounce">🔭</div>
            <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Waiting for neighbors in {areaName}...</p>
          </div>
        ) : (
          remotePeers.map(peer => {
            const isSelected = selectedBuddyIds.includes(peer.id);
            const isAccepted = acceptedBuddies.some(b => b.id === peer.id);
            // Seen within the last 15 seconds is considered "Active Now"
            const isActiveNow = (now - peer.lastSeenAt) < 15000;
            
            return (
              <button 
                key={peer.id} 
                onClick={() => !isAccepted && toggleBuddySelection(peer.id)}
                disabled={isAccepted}
                className={`w-full text-left p-6 rounded-[2.5rem] bg-white border-4 transition-all flex items-center gap-6 group relative ${
                  isSelected ? 'border-amber-400 shadow-xl scale-[1.02]' : 'border-slate-100 shadow-sm'
                } ${isAccepted ? 'opacity-50 grayscale' : ''}`}
              >
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-3xl shadow-inner transition-transform relative ${
                  isSelected ? 'bg-amber-400 text-amber-950' : 'bg-amber-50 text-amber-600'
                }`}>
                  {peer.displayName[0]}
                  {isActiveNow && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-xl text-slate-900 leading-tight">{peer.displayName}</h4>
                    {isActiveNow && (
                      <span className="text-[8px] font-black uppercase text-green-500 tracking-tighter bg-green-50 px-1.5 py-0.5 rounded">Active Now</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {peer.interests.map(i => (
                      <span key={i} className="text-[9px] font-black uppercase text-slate-400 tracking-wider bg-slate-50 px-2 py-0.5 rounded-md">{i}</span>
                    ))}
                  </div>
                </div>
                {isSelected && (
                  <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center text-amber-950 font-black shadow-lg animate-scaleUp">
                    ✓
                  </div>
                )}
                {isAccepted && (
                  <span className="text-[10px] font-black uppercase text-green-600 tracking-widest">In Group</span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* FLOATING GROUP INVITE BUTTON */}
      {selectedBuddyIds.length > 0 && (
        <div className="fixed bottom-10 left-6 right-6 z-[150] animate-slideIn">
          <button 
            onClick={handleSendGroupInvite}
            className="w-full bg-amber-500 text-amber-950 font-black py-6 rounded-[2.5rem] text-xl shadow-[0_20px_40px_-15px_rgba(245,158,11,0.5)] flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            Invite {selectedBuddyIds.length} Neighbor{selectedBuddyIds.length > 1 ? 's' : ''} 👟
          </button>
        </div>
      )}

      {/* GROUP INVITE MODAL */}
      {isSendingGroupInvite && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white rounded-[3.5rem] p-10 w-full max-w-sm shadow-2xl text-center border-t-8 border-amber-500">
             <div className="text-7xl mb-6">🚶‍♂️🚶‍♀️</div>
             <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Form a Group?</h3>
             <p className="text-slate-500 mb-8 font-bold text-sm leading-relaxed">Sending a real-time invite to {selectedBuddyIds.length} neighbors in {areaName}.</p>
             
             <textarea 
               rows={3} 
               value={outgoingGroupNote} 
               onChange={(e) => setOutgoingGroupNote(e.target.value)} 
               placeholder="Optional: Where should everyone meet? (e.g. Near the clock tower)"
               className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-6 py-4 font-bold text-slate-800 focus:border-amber-400 outline-none resize-none mb-8 text-sm" 
             />

             <div className="flex flex-col gap-3">
               <button onClick={confirmGroupInvite} className="w-full py-6 bg-amber-500 text-amber-950 font-black rounded-[2rem] text-2xl shadow-xl active:scale-95">Send Group Invite</button>
               <button onClick={() => setIsSendingGroupInvite(false)} className="w-full py-4 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cancel</button>
             </div>
          </div>
        </div>
      )}

      {/* INCOMING INVITE MODAL */}
      {incomingInvites.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white rounded-[3.5rem] p-10 w-full max-w-sm shadow-2xl text-center border-t-8 border-green-500">
             <div className="text-7xl mb-6">🤝</div>
             <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Join a Walk?</h3>
             <p className="text-slate-600 mb-8 text-xl leading-snug">
               <span className="font-black text-slate-900">{remotePeers.find(p => p.id === incomingInvites[0].fromSessionId)?.displayName || 'A neighbor'}</span> 
               <br/>wants to go for a <span className="text-green-600 font-black uppercase tracking-tight">{incomingInvites[0].activity}</span>.
             </p>
             
             <textarea 
               rows={2} 
               value={acceptanceNote} 
               onChange={(e) => setAcceptanceNote(e.target.value)} 
               placeholder="Say hello! (e.g. I'm on my way!)" 
               className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-6 py-4 font-black text-slate-800 focus:border-green-500 outline-none resize-none mb-8" 
             />

             <div className="flex flex-col gap-4">
               <button onClick={() => { onRespond(incomingInvites[0].id, 'ACCEPTED', acceptanceNote); setAcceptanceNote(''); }} className="w-full py-6 bg-green-500 text-white font-black rounded-[2.5rem] text-2xl shadow-xl active:scale-95 border-b-4 border-green-700">Accept & Join</button>
               <button onClick={() => { onRespond(incomingInvites[0].id, 'DECLINED'); setAcceptanceNote(''); }} className="w-full py-4 text-slate-400 font-bold rounded-2xl text-lg uppercase tracking-widest text-[10px]">Not right now</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
