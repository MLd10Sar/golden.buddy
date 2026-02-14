
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

const SAFETY_TIPS = [
  { title: "Public Places Only", detail: "Meet in busy, well-lit areas like cafes or libraries. Never at home.", icon: "🏙️" },
  { title: "Tell a Friend", detail: "Share your buddy's name and meeting location with a family member.", icon: "📱" },
  { title: "Battery Check", detail: "Ensure your phone is fully charged before heading out.", icon: "🔋" },
  { title: "Trust Your Gut", detail: "If you feel uneasy, it's perfectly okay to leave or cancel.", icon: "🛡️" }
];

const SafetyCard: React.FC<{ tip: typeof SAFETY_TIPS[0] }> = ({ tip }) => {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen(!open)} className={`w-full text-left p-4 rounded-2xl border transition-all ${open ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-100'}`}>
      <div className="flex items-center gap-3">
        <span className="text-xl">{tip.icon}</span>
        <div className="flex-1">
          <p className={`font-black uppercase tracking-tight ${open ? 'text-amber-900' : 'text-slate-600 text-[10px]'}`}>{tip.title}</p>
          {open && <p className="mt-2 text-sm font-medium text-slate-500 leading-snug">{tip.detail}</p>}
        </div>
        <span className="text-[9px] font-black text-slate-300 uppercase">{open ? 'Hide' : 'Info'}</span>
      </div>
    </button>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ session, invites, remotePeers, onSendInvite, onRespond, onUpdateNote, onReset }) => {
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Incoming pending invites
  const incoming = useMemo(() => 
    invites.filter(i => i.toSessionId === session.id && i.status === 'PENDING'), 
  [invites, session.id]);

  // Active matched session
  const activeMatch = useMemo(() => 
    invites.find(i => i.status === 'ACCEPTED' && (i.fromSessionId === session.id || i.toSessionId === session.id)),
  [invites, session.id]);

  const buddy = useMemo(() => {
    if (!activeMatch) return null;
    const bid = activeMatch.fromSessionId === session.id ? activeMatch.toSessionId : activeMatch.fromSessionId;
    return remotePeers.find(p => p.id === bid);
  }, [activeMatch, remotePeers, session.id]);

  const spot = useMemo(() => {
    if (!activeMatch?.aiSuggestedSpot) return null;
    try { return JSON.parse(activeMatch.aiSuggestedSpot); } 
    catch (e) { return null; }
  }, [activeMatch]);

  const handleAccept = async (id: string) => {
    setIsProcessing(id);
    await onRespond(id, 'ACCEPTED');
    setShowSafetyModal(true);
    setIsProcessing(null);
  };

  const handleReject = async (id: string) => {
    setIsProcessing(id);
    await onRespond(id, 'DECLINED');
    setIsProcessing(null);
  };

  if (activeMatch) {
    return (
      <div className="p-6 space-y-6 bg-slate-50 min-h-full pb-20 animate-fadeIn">
        <div className="bg-green-600 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-4xl font-black tracking-tighter mb-1">Meeting {buddy?.displayName || 'a Neighbor'}</h3>
            <p className="font-bold opacity-80 mb-6">{activeMatch.activity} Session</p>
            
            <div className="bg-white rounded-[2rem] p-6 shadow-xl text-slate-900 space-y-5">
              <div className="flex items-center gap-4">
                <span className="text-4xl">{ACTIVITY_ICONS[activeMatch.activity]}</span>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity</p>
                  <p className="text-xl font-black">{activeMatch.activity}</p>
                </div>
              </div>

              <div className="pt-5 border-t border-slate-100">
                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">Safe Public Spot</p>
                {spot ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-2xl font-black tracking-tight">{spot.name}</h4>
                      <p className="text-xs font-medium text-slate-500 mt-1 leading-snug">{spot.reason}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">🕒 Hours</p>
                        <p className="text-xs font-bold">{spot.hours || "Check locally"}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">📍 Arrival</p>
                        <p className="text-xs font-bold">{spot.directions || "Main Lobby"}</p>
                      </div>
                    </div>
                    {spot.mapsUrl && (
                      <a href={spot.mapsUrl} target="_blank" className="flex items-center justify-center gap-2 w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg">
                        <span>🗺️</span> Open Google Maps
                      </a>
                    )}
                  </div>
                ) : <p className="text-xs font-bold text-slate-400 animate-pulse">Finding a safe spot...</p>}
              </div>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 text-[15rem] opacity-5">🌟</div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
          <h4 className="font-black text-slate-900 uppercase tracking-tighter text-xl mb-6">Safety Protocol</h4>
          <div className="space-y-3 mb-8">
            {SAFETY_TIPS.map((tip, i) => <SafetyCard key={i} tip={tip} />)}
          </div>
          <button onClick={onReset} className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-xl uppercase tracking-tighter shadow-lg active:scale-95 transition-all">Sign Out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 space-y-8 flex-1 overflow-y-auto no-scrollbar pb-40">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Explore</h2>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-amber-600 font-black text-[10px] uppercase tracking-widest">
                📍 {AREAS.find(a => a.id === session.areaId)?.name || 'Local'}
              </p>
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            </div>
          </div>
          <button onClick={onReset} className="text-[10px] font-black text-slate-300 uppercase underline">Reset</button>
        </div>

        {incoming.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Neighbor Invites</h3>
            {incoming.map(inv => {
              const invBuddy = remotePeers.find(p => p.id === inv.fromSessionId);
              return (
                <div key={inv.id} className="bg-amber-400 p-6 rounded-[2.5rem] shadow-xl border-b-4 border-amber-600 animate-slideIn">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-3xl font-black shadow-sm">
                      {invBuddy?.displayName[0] || 'N'}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-amber-950 text-xl leading-tight">{invBuddy?.displayName || 'A Neighbor'}</p>
                      <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Wants to play {inv.activity}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleAccept(inv.id)} 
                      disabled={!!isProcessing}
                      className="flex-1 bg-amber-950 text-white py-4 rounded-[1.5rem] font-black uppercase text-xs shadow-md disabled:opacity-50"
                    >
                      {isProcessing === inv.id ? 'Accepting...' : 'Accept'}
                    </button>
                    <button 
                      onClick={() => handleReject(inv.id)} 
                      disabled={!!isProcessing}
                      className="px-6 bg-white/40 text-amber-950 py-4 rounded-[1.5rem] font-black uppercase text-xs disabled:opacity-50"
                    >
                      No
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Active Neighbors</h3>
          {remotePeers.length === 0 ? (
            <div className="py-20 text-center border-4 border-dashed border-slate-200 rounded-[3rem] bg-white/50">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] px-8">Scanning for buddies nearby...</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {remotePeers.map(peer => (
                <button 
                  key={peer.id}
                  onClick={() => setSelectedPeerId(selectedPeerId === peer.id ? null : peer.id)}
                  className={`w-full text-left p-6 rounded-[2.5rem] border-4 transition-all flex items-center gap-5 bg-white ${
                    selectedPeerId === peer.id ? 'border-amber-400 scale-[1.02] shadow-xl' : 'border-transparent shadow-sm'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black ${
                    selectedPeerId === peer.id ? 'bg-amber-400 text-amber-950' : 'bg-slate-100 text-slate-300'
                  }`}>
                    {peer.displayName[0]}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-xl text-slate-900 leading-none">{peer.displayName}</h4>
                    <p className="text-[9px] font-black uppercase text-slate-400 mt-2">{peer.interests.join(" • ")}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedPeerId && (
        <div className="fixed bottom-10 left-8 right-8 z-[100] animate-slideIn">
          <button 
            onClick={() => { onSendInvite(selectedPeerId, session.interests[0]); setSelectedPeerId(null); }}
            className="w-full bg-slate-900 text-white font-black py-7 rounded-[2.5rem] text-xl shadow-2xl uppercase tracking-tighter"
          >
            Invite to {session.interests[0]} {ACTIVITY_ICONS[session.interests[0]]}
          </button>
        </div>
      )}

      {showSafetyModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[300] flex items-center justify-center p-8 animate-fadeIn">
          <div className="bg-white rounded-[3.5rem] p-8 w-full max-w-sm shadow-2xl text-center animate-scaleUp">
            <div className="text-6xl mb-6">🛡️</div>
            <h3 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Safety First</h3>
            <p className="text-slate-500 mb-8 font-bold text-sm leading-tight">Review these tips for a happy and safe meeting with your neighbor.</p>
            <div className="text-left space-y-3 mb-10">
              {SAFETY_TIPS.map((tip, i) => <SafetyCard key={i} tip={tip} />)}
            </div>
            <button onClick={() => setShowSafetyModal(false)} className="w-full py-6 bg-slate-900 text-white font-black rounded-[2.5rem] text-xl uppercase tracking-tighter">I Understand</button>
          </div>
        </div>
      )}
    </div>
  );
};
