
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- TYPES ---
type AreaId = 'arlington_va' | 'alexandria_va' | 'richmond_va' | 'exploring';
type Interest = 'Walking' | 'Chess' | 'Coffee & Chat' | 'Bird Watching' | 'Gardening';
type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
type FontSize = 'standard' | 'large' | 'extra-large';
type ContrastMode = 'normal' | 'high';
type View = 'WELCOME' | 'NAME' | 'LOCATION' | 'INTERESTS' | 'DASHBOARD' | 'PROFILE';

interface AccessibilitySettings {
  fontSize: FontSize;
  contrastMode: ContrastMode;
  screenReaderOptimized: boolean;
}

interface Session {
  id: string;
  displayName: string;
  areaId: AreaId;
  interests: Interest[];
  createdAt: number;
  lastSeenAt: number;
  accessibility: AccessibilitySettings;
  inviteDuration: number;
}

interface Invite {
  id: string;
  fromSessionId: string;
  toSessionId: string;
  activity: Interest;
  status: InviteStatus;
  createdAt: number;
  expiresAt: number;
  respondedAt?: number;
  coordinationNote?: string;
}

interface AppState {
  currentSession: Session | null;
  invites: Invite[];
  currentView: View;
}

// --- CONSTANTS ---
const AREAS = [
  { id: 'arlington_va', name: 'Arlington County, VA' },
  { id: 'alexandria_va', name: 'City of Alexandria, VA' },
  { id: 'richmond_va', name: 'City of Richmond, VA' },
  { id: 'exploring', name: 'Just exploring' },
] as const;

const INTERESTS: Interest[] = ['Walking', 'Chess', 'Coffee & Chat', 'Bird Watching', 'Gardening'];
const INVITE_DURATION_MS = 60 * 60 * 1000;
const STORAGE_KEY = 'goldenbuddy_v2_state';
const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'gb_v7_natural_groups';

// --- COMPONENTS (VIEWS) ---
const WelcomeView = ({ onNext }) => (
  <div className="p-8 flex flex-col items-center text-center animate-fadeIn min-h-full">
    <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center text-5xl mb-12 shadow-inner border-4 border-white animate-bounce">👋</div>
    <h2 className="text-4xl font-black mb-6 text-slate-900 tracking-tighter">HELLO THERE!</h2>
    <p className="text-xl text-slate-600 mb-12 leading-relaxed">Let's find you a local activity buddy.</p>
    <button onClick={onNext} className="w-full bg-amber-500 text-amber-950 font-black py-6 rounded-[2.5rem] text-2xl shadow-xl active:scale-95 uppercase tracking-tighter">Get Started</button>
  </div>
);

// --- MAIN APP ---
const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { currentSession: null, invites: [], currentView: 'WELCOME' };
  });

  const [remotePeers, setRemotePeers] = useState<Session[]>([]);
  const isSyncing = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const broadcastPresence = useCallback(async () => {
    if (!state.currentSession) return;
    try {
      const sessionWithTime = { ...state.currentSession, lastSeenAt: Date.now() };
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/s_${state.currentSession.id}/${encodeURIComponent(JSON.stringify(sessionWithTime))}`, { method: 'POST' });
      
      const dirRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/d_${state.currentSession.areaId}`);
      const dirRaw = await dirRes.text();
      let directory = dirRaw && dirRaw !== "null" ? JSON.parse(dirRaw) : [];
      if (!directory.includes(state.currentSession.id)) {
        directory = [...directory, state.currentSession.id].slice(-50);
        await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/d_${state.currentSession.areaId}/${encodeURIComponent(JSON.stringify(directory))}`, { method: 'POST' });
      }
    } catch (e) {}
  }, [state.currentSession]);

  useEffect(() => {
    if (!state.currentSession) return;
    const interval = setInterval(broadcastPresence, 5000);
    return () => clearInterval(interval);
  }, [state.currentSession, broadcastPresence]);

  const handleCreateSession = (name: string, areaId: AreaId, interests: Interest[]) => {
    const newSession: Session = {
      id: Math.random().toString(36).substr(2, 6),
      displayName: name,
      areaId,
      interests,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      accessibility: { fontSize: 'standard', contrastMode: 'normal', screenReaderOptimized: false },
      inviteDuration: INVITE_DURATION_MS,
    };
    setState(prev => ({ ...prev, currentSession: newSession, currentView: 'DASHBOARD' }));
  };

  const renderView = () => {
    switch (state.currentView) {
      case 'WELCOME':
        return <WelcomeView onNext={() => setState(s => ({...s, currentView: 'NAME'}))} />;
      case 'NAME':
        return (
          <div className="p-8 flex flex-col items-center justify-center min-h-full space-y-8">
            <h2 className="text-3xl font-black">Your Name?</h2>
            <input 
              className="w-full p-6 text-2xl border-4 border-amber-300 rounded-3xl" 
              placeholder="e.g. Martha" 
              onBlur={(e) => handleCreateSession(e.target.value, 'arlington_va', ['Walking'])} 
            />
          </div>
        );
      case 'DASHBOARD':
        return (
          <div className="p-8">
            <h2 className="text-4xl font-black mb-4">NEIGHBORS</h2>
            <p className="text-slate-500 font-bold">Scanning for buddies nearby...</p>
            <div className="mt-8 py-10 text-center opacity-40">
              <div className="text-6xl animate-bounce">🔭</div>
              <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Waiting for neighbors...</p>
            </div>
          </div>
        );
      default:
        return <WelcomeView onNext={() => setState(s => ({...s, currentView: 'NAME'}))} />;
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-white shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-slate-200">
      <header className="p-4 border-b bg-amber-400 flex justify-between items-center z-50">
        <h1 className="font-black text-xl text-amber-950 uppercase">GoldenBuddy</h1>
      </header>
      <main className="flex-1 overflow-y-auto bg-amber-50/30">
        {renderView()}
      </main>
      <footer className="bg-slate-900 text-slate-500 text-[9px] text-center py-2 font-black uppercase">
        AI-Enhanced Safety & Privacy First
      </footer>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
