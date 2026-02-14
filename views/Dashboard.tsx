import React, { useState, useMemo } from 'react';
import { Session, Invite, Interest } from '../types';
import { AREAS } from '../constants';
import { speakText } from '../services/geminiService';

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
  'Walking': '👟', 'Chess': '♟️', 'Coffee & Chat': '☕', 'Bird Watching': '🦜', 'Gardening': '🌱'
};

const SAFETY_TIPS = [
  { title: "Public Only", detail: "Meet in busy, well-lit cafes or libraries. Never at private homes.", icon: "🏙️" },
  { title: "Battery Check", detail: "Charge your phone fully before leaving.", icon: "🔋" },
  { title: "Tell a Relative", detail: "Share the location with family for peace of mind.", icon: "📱" }
];

export const Dashboard: React.FC<DashboardProps> = ({ session, invites, remotePeers, onSendInvite, onRespond, onUpdateNote, onReset }) => {
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const incoming = useMemo(() => invites.filter(i => i.toSessionId === session.id && i.status === 'PENDING'), [invites, session.id]);
  const activeMatch = useMemo(() => invites.find(i => i.status === 'ACCEPTED' && (i.fromSessionId === session.id || i.toSessionId === session.id)), [invites, session.id]);

  const buddy = useMemo(() => {
    if (!activeMatch) return null;
    const bid = activeMatch.fromSessionId === session.id ? activeMatch.toSessionId : activeMatch.fromSessionId;
    return remotePeers.find(p => p.id === bid);
  }, [activeMatch, remotePeers, session.id]);

  const spot = useMemo(() => {
    if (!activeMatch?.aiSuggestedSpot) return null;
    try { return JSON.parse(activeMatch.aiSuggestedSpot); } catch (e) { return null; }
  }, [activeMatch]);

  const handleSpeak = async () => {
    if (!spot || isSpeaking) return;
    setIsSpeaking(true);
    const text = `Meeting ${buddy?.displayName || 'neighbor'} at ${spot.name}. Location tip: ${spot.directions}. Safety reminder: ${spot.weatherTip}. See you there!`;
    await speakText(text);
    setTimeout(() => setIsSpeaking(false), 5000);
  };

  if (activeMatch) {
    return (
      <div className="p-6 space-y-6 bg-slate-50 min-h-full pb-32 animate-fadeIn">
        <div className="bg-amber-500 rounded-[2.5rem] p-8 text-amber-950 shadow-2xl relative overflow-hidden border-b-8 border-amber-600">
          <div className="relative z-10">
            <h3 className="text-4xl font-black tracking-tighter mb-1 leading-none">Matched!</h3>
            <p className="font-bold opacity-80 mb-6">Meeting with {buddy?.displayName || 'Neighbor'}</p>
            
            <div className="bg-white rounded-[2rem] p-6 shadow-xl text-slate-900 space-y-5">
              <div className="flex items-center gap-4">
                <span className="text-4xl">{ACTIVITY_ICONS[activeMatch.activity]}</span>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity</p>
                  <p className="text-xl font-black">{activeMatch.activity}</p>
                </div>
                <button onClick={handleSpeak} disabled={isSpeaking} className={`ml-auto w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-md transition-all ${isSpeaking ? 'bg-amber-100 animate-pulse' : 'bg-amber-400 active:scale-90'}`}>
                  {isSpeaking ? '⏳' : '🔊'}
                </button>
              </div>

              <div className="pt-5 border-t border-slate-100">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3">Safe Public Meeting Spot</p>
                {spot ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-2xl font-black tracking-tight leading-tight">{spot.name}</h4>
                      <p className="text-xs font-medium text-slate-500 mt-1">{spot.reason}</p>
                    </div>
                    
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
                      <span className="text-xl">🌤️</span>
                      <div>
                        <p className="text-[9px] font-black text-amber-800 uppercase tracking-widest">Weather Advisory</p>
                        <p className="text-xs font-bold text-amber-900 leading-snug">{spot.weatherTip}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">🕒 Hours</p>
                        <p className="text-[10px] font-bold">{spot.hours}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">📍 Arrival</p>
                        <p className="text-[10px] font-bold">{spot.directions}</p>
                      </div>
                    </div>
                    <a href={spot.mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase shadow-lg">🗺️ Open Map</a>
                  </div>
                ) : <p className="text-xs font-bold text-slate-400 animate-pulse">Finding a safe spot...</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
          <h4 className="font-black text-slate-900 uppercase text-xs mb-6 tracking-widest">Safety Reminders</h4>
          <div className="space-y-3">
            {SAFETY_TIPS.map((tip, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-2xl">{tip.icon}</span>
                <div className="flex-1">
                  <p className="font-black text-[10px] text-slate-900 uppercase tracking-tight">{tip.title}</p>
                  <p className="text-[10px] text-slate-500 font-medium leading-tight">{tip.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={onReset} className="mt-8 w-full py-5 bg-slate-100 text-slate-400 font-black rounded-[2rem] text-xs uppercase tracking-widest">Sign Out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 space-y-8 flex-1 overflow-y-auto no-scrollbar pb-40">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Buddy Map</h2>
            <p className="text-amber-600 font-black text-[10px] uppercase tracking-widest mt-2">📍 {AREAS.find(a => a.id === session.areaId)?.name}</p>
          </div>
          <button onClick={onReset} className="text-[9px] font-black text-slate-300 uppercase underline">Reset</button>
        </div>

        {incoming.length > 0 && (
          <div className="space-y-4 animate-slideIn">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Neighbor Invites</h3>
            {incoming.map(inv => {
              const peer = remotePeers.find(p => p.id === inv.fromSessionId);
              return (
                <div key={inv.id} className="bg-white p-6 rounded-[2.5rem] shadow-xl border-4 border-amber-400">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-3xl font-black">{peer?.displayName[0] || '?'}</div>
                    <div className="flex-1">
                      <p className="font-black text-slate-900 text-xl leading-tight">{peer?.displayName || 'Neighbor'}</p>
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Wants to {inv.activity}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setIsProcessing(inv.id); onRespond(inv.id, 'ACCEPTED'); }} disabled={!!isProcessing} className="flex-1 bg-amber-400 text-amber-950 py-4 rounded-2xl font-black uppercase text-xs shadow-md">Accept</button>
                    <button onClick={() => { setIsProcessing(inv.id); onRespond(inv.id, 'DECLINED'); }} disabled={!!isProcessing} className="px-6 bg-slate-100 text-slate-400 py-4 rounded-2xl font-black uppercase text-xs">No</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex justify-between items-center ml-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nearby Neighbors</h3>
            <span className="text-[9px] font-black text-green-500 flex items-center gap-1 uppercase">● Active</span>
          </div>
          {remotePeers.length === 0 ? (
            <div className="py-20 text-center border-4 border-dashed border-slate-200 rounded-[3rem] bg-white flex flex-col items-center gap-4">
              <span className="text-5xl opacity-20">👋</span>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-8 leading-relaxed">It's quiet right now. Neighbors will appear here when they open the app!</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {remotePeers.map(peer => (
                <button key={peer.id} onClick={() => setSelectedPeerId(selectedPeerId === peer.id ? null : peer.id)}
                  className={`w-full text-left p-6 rounded-[2.5rem] border-4 transition-all flex items-center gap-5 bg-white ${selectedPeerId === peer.id ? 'border-amber-400 scale-[1.02] shadow-xl' : 'border-transparent shadow-sm'}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black ${selectedPeerId === peer.id ? 'bg-amber-400 text-amber-950' : 'bg-slate-100 text-slate-300'}`}>{peer.displayName[0]}</div>
                  <div className="flex-1">
                    <h4 className="font-black text-xl text-slate-900 leading-none">{peer.displayName}</h4>
                    <p className="text-[9px] font-black uppercase text-slate-400 mt-2 tracking-wider">{peer.interests.join(" • ")}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedPeerId && (
        <div className="fixed bottom-10 left-8 right-8 z-[100] animate-slideIn">
          <button onClick={() => { onSendInvite(selectedPeerId, session.interests[0]); setSelectedPeerId(null); }}
            className="w-full bg-slate-900 text-white font-black py-7 rounded-[2.5rem] text-xl shadow-2xl uppercase tracking-tighter flex items-center justify-center gap-3">
            Invite to {session.interests[0]} {ACTIVITY_ICONS[session.interests[0]]}
          </button>
        </div>
      )}
    </div>
  );
};
