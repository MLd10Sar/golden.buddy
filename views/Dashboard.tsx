
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

const SAFETY_TIPS_DETAILED = [
  {
    title: "Meet in a well-lit, busy public place.",
    detail: "Busy public spaces like cafes, libraries, or community centers are safest for first meetings. Avoid private residences or secluded areas until you have built a strong foundation of trust.",
    icon: "🏙️"
  },
  {
    title: "Tell a family member or friend your plans.",
    detail: "Always share the name of your buddy, the meeting location, and your expected return time with someone you trust. Having someone 'looking out' for you adds peace of mind.",
    icon: "📱"
  },
  {
    title: "Bring your mobile phone, fully charged.",
    detail: "Keep your phone easily accessible throughout the activity. A fully charged battery ensures you can call for transport or contact family if plans change.",
    icon: "🔋"
  },
  {
    title: "If you feel uncomfortable, it's okay to leave.",
    detail: "You are never obligated to stay. If something feels 'off' or you simply aren't enjoying yourself, you can politely say 'I need to head home now' and depart.",
    icon: "🚶"
  },
  {
    title: "Trust your gut—safety first!",
    detail: "Your intuition is your best guide. If a person or situation makes you uneasy, trust that feeling. It is always better to prioritize your comfort and safety.",
    icon: "🛡️"
  }
];

const SafetyTipCard: React.FC<{ title: string; detail: string; icon: string }> = ({ title, detail, icon }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <button 
      onClick={() => setIsExpanded(!isExpanded)}
      className={`w-full text-left transition-all duration-300 rounded-[1.5rem] border ${
        isExpanded 
          ? 'bg-white border-amber-300 shadow-md p-6' 
          : 'bg-slate-50 border-slate-100 p-4'
      }`}
    >
      <div className="flex gap-4 items-center">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 transition-colors ${
          isExpanded ? 'bg-amber-100 text-amber-600' : 'bg-white text-slate-400'
        }`}>
          {isExpanded ? icon : '✓'}
        </div>
        <div className="flex-1">
          <p className={`font-black leading-tight transition-all ${
            isExpanded ? 'text-slate-900 text-lg' : 'text-slate-600 text-[10px] uppercase tracking-wide'
          }`}>
            {title}
          </p>
          {isExpanded && (
            <p className="mt-3 text-sm font-medium text-slate-500 leading-relaxed animate-fadeIn">
              {detail}
            </p>
          )}
        </div>
        <div className={`text-[9px] font-black uppercase tracking-widest transition-transform duration-300 ${
          isExpanded ? 'rotate-180 text-amber-500' : 'text-slate-300'
        }`}>
          {isExpanded ? 'Hide' : 'View'}
        </div>
      </div>
    </button>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ session, invites, remotePeers, onSendInvite, onRespond, onUpdateNote, onReset }) => {
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [showSafetyTipsAfterAccept, setShowSafetyTipsAfterAccept] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

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
    const bid = activeMatch.fromSessionId === session.id ? activeMatch.toSessionId : activeMatch.fromSessionId;
    return remotePeers.find(p => p.id === bid);
  }, [activeMatch, remotePeers, session.id]);

  // Helper to parse the JSON stored in aiSuggestedSpot
  const meetingSpotData = useMemo(() => {
    if (!activeMatch?.aiSuggestedSpot) return null;
    try {
      return JSON.parse(activeMatch.aiSuggestedSpot);
    } catch (e) {
      // Fallback for legacy plain text entries
      return { name: activeMatch.aiSuggestedSpot, reason: "", directions: "", hours: "", mapsUrl: "" };
    }
  }, [activeMatch]);

  const handleAccept = async (inviteId: string) => {
    setIsProcessing(inviteId);
    try {
      await onRespond(inviteId, 'ACCEPTED');
      setShowSafetyTipsAfterAccept(true);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (inviteId: string) => {
    setIsProcessing(inviteId);
    try {
      await onRespond(inviteId, 'DECLINED');
    } finally {
      setIsProcessing(null);
    }
  };

  if (activeMatch) {
    return (
      <div className="p-6 space-y-6 animate-fadeIn bg-slate-50 min-h-full pb-20">
        {/* Connection Header Card */}
        <div className="bg-green-600 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden animate-scaleUp">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <span className="bg-white/30 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">Neighbor Connected</span>
              <div className="text-4xl animate-bounce">👋</div>
            </div>
            <h3 className="text-4xl font-black tracking-tighter leading-none mb-2">Meeting {buddy?.displayName || 'a Neighbor'}</h3>
            <p className="text-lg font-bold opacity-90 mb-8">{activeMatch.activity} Session</p>
            
            <div className="bg-white rounded-[2rem] p-6 shadow-xl space-y-5 text-slate-900">
              <div className="flex items-center gap-4">
                 <span className="text-4xl">{ACTIVITY_ICONS[activeMatch.activity]}</span>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Planned Activity</p>
                    <p className="text-xl font-black">{activeMatch.activity}</p>
                 </div>
              </div>
              
              <div className="pt-5 border-t border-slate-100">
                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-3">Safe Spot Recommendation</p>
                
                {!meetingSpotData ? (
                  <p className="text-sm font-bold text-slate-400 animate-pulse">Determining a safe public spot nearby...</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-2xl font-black text-slate-900 tracking-tight">{meetingSpotData.name}</h4>
                      <p className="text-sm font-medium text-slate-500 mt-1">{meetingSpotData.reason}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">🕒 Hours</p>
                        <p className="text-xs font-bold text-slate-700">{meetingSpotData.hours || "Consult local info"}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">📍 Arrival</p>
                        <p className="text-xs font-bold text-slate-700">{meetingSpotData.directions || "Meet at main entrance"}</p>
                      </div>
                    </div>

                    {meetingSpotData.mapsUrl && (
                      <a 
                        href={meetingSpotData.mapsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                      >
                        <span className="text-lg">🗺️</span> View on Google Maps
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="absolute -right-12 -bottom-12 text-[18rem] opacity-5 rotate-12">🌟</div>
        </div>

        {/* Safety Details Section */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🛡️</span>
              <h4 className="font-black text-slate-900 uppercase tracking-tighter text-xl">Safety Protocol</h4>
            </div>
            <div className="space-y-3">
              {SAFETY_TIPS_DETAILED.map((tip, i) => (
                <SafetyTipCard key={i} title={tip.title} detail={tip.detail} icon={tip.icon} />
              ))}
            </div>
          </div>

          <button onClick={onReset} className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-xl uppercase tracking-tighter active:scale-95 transition-all shadow-lg">End Meeting / Sign Out</button>
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
              <p className="text-amber-600 font-black text-[10px] uppercase tracking-[0.2em]">
                📍 {AREAS.find(a => a.id === session.areaId)?.name || 'Local'}
              </p>
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            </div>
          </div>
          <button onClick={onReset} className="text-[10px] font-black text-slate-300 hover:text-red-400 uppercase tracking-widest underline transition-colors">Reset</button>
        </div>

        {incoming.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Neighbor Invites</h3>
            {incoming.map(inv => {
              const invBuddy = remotePeers.find(p => p.id === inv.fromSessionId);
              return (
                <div key={inv.id} className="bg-amber-400 p-6 rounded-[2.5rem] shadow-xl border-b-4 border-amber-600 animate-slideIn relative overflow-hidden">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm font-black">
                      {invBuddy?.displayName[0] || 'N'}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-amber-950 text-xl leading-tight">
                        {invBuddy?.displayName || 'A Neighbor'}
                      </p>
                      <p className="text-xs font-bold text-amber-800 uppercase tracking-widest">Go for {inv.activity}?</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleAccept(inv.id)}
                      disabled={isProcessing === inv.id}
                      className="flex-1 bg-amber-950 text-white py-4 rounded-[1.5rem] font-black uppercase text-sm shadow-md active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isProcessing === inv.id ? 'Accepting...' : 'Accept'}
                    </button>
                    <button 
                      onClick={() => handleReject(inv.id)}
                      disabled={isProcessing === inv.id}
                      className="px-6 bg-white/40 text-amber-950 py-4 rounded-[1.5rem] font-black uppercase text-sm hover:bg-white/60 transition-all disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Active Nearby</h3>
          {remotePeers.length === 0 ? (
            <div className="py-20 text-center border-4 border-dashed border-slate-200 rounded-[3rem] bg-white/50 flex flex-col items-center">
              <div className="text-7xl mb-6 animate-pulse opacity-20 grayscale">📻</div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] max-w-[180px] leading-relaxed">Scanning for neighbors nearby...</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {remotePeers.map(peer => (
                <button 
                  key={peer.id}
                  onClick={() => setSelectedPeerId(selectedPeerId === peer.id ? null : peer.id)}
                  className={`w-full text-left p-6 rounded-[2.5rem] border-[3px] transition-all flex items-center gap-5 bg-white shadow-sm ${
                    selectedPeerId === peer.id ? 'border-amber-400 scale-[1.02] shadow-lg' : 'border-transparent'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-black shadow-inner ${
                    selectedPeerId === peer.id ? 'bg-amber-400 text-amber-950' : 'bg-slate-100 text-slate-300'
                  }`}>
                    {peer.displayName[0]}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-xl text-slate-900 leading-none">{peer.displayName}</h4>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {peer.interests.map(i => (
                        <span key={i} className="text-[9px] font-black uppercase text-slate-400 tracking-wider bg-slate-50 px-2 py-0.5 rounded-md">{i}</span>
                      ))}
                    </div>
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
            className="w-full bg-slate-900 text-white font-black py-7 rounded-[2.5rem] text-xl shadow-2xl flex items-center justify-center gap-3 uppercase active:scale-95 transition-all tracking-tighter"
          >
            Invite to {session.interests[0]} {ACTIVITY_ICONS[session.interests[0]]}
          </button>
        </div>
      )}

      {showSafetyTipsAfterAccept && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[300] flex items-center justify-center p-8 animate-fadeIn">
          <div className="bg-white rounded-[3.5rem] p-8 w-full max-w-sm shadow-2xl text-center border-t-8 border-amber-400 animate-scaleUp overflow-y-auto max-h-[90vh] no-scrollbar">
            <div className="text-6xl mb-6">🛡️</div>
            <h3 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Safety First</h3>
            <p className="text-slate-500 mb-8 font-bold text-lg leading-tight">
              Please review these interactive guidelines for a safe and happy meeting.
            </p>
            <div className="text-left space-y-3 mb-10">
              {SAFETY_TIPS_DETAILED.map((tip, i) => (
                <SafetyTipCard key={i} title={tip.title} detail={tip.detail} icon={tip.icon} />
              ))}
            </div>
            <button 
              onClick={() => setShowSafetyTipsAfterAccept(false)} 
              className="w-full py-6 bg-slate-900 text-white font-black rounded-[2.5rem] text-xl shadow-xl active:scale-95 transition-all uppercase tracking-tighter"
            >
              I Understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
