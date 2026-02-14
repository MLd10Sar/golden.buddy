
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

// --- CONFIG & CONSTANTS ---
const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'gb_v11_stable_sync'; // New token for fresh start
const AREAS = ['Arlington, VA', 'Alexandria, VA', 'Richmond, VA', 'Fairfax, VA', 'Washington, DC'];
const INTERESTS = ['Walking', 'Chess', 'Coffee', 'Bird Watching', 'Gardening'];

type View = 'WELCOME' | 'NAME' | 'LOCATION' | 'DASHBOARD';
interface UserProfile {
  id: string;
  name: string;
  area: string;
  interests: string[];
  lastSeen: number;
}

// --- AI SERVICES ---
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

const speak = async (text: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length).map((_, i) => binary.charCodeAt(i));
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      buffer.getChannelData(0).set(Array.from(dataInt16).map(v => v / 32768.0));
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
    }
  } catch (e) { console.error("TTS Error", e); }
};

const findSafeSpot = async (area: string, interest: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Find a real-world, safe public meeting spot in ${area} for ${interest}. Provide the Name and a 1-sentence senior-friendly reason.`,
      config: { tools: [{ googleSearch: {} }] }
    });
    return response.text;
  } catch (e) { return "The local public library - it is safe, well-lit, and central."; }
};

// --- MAIN APP ---
const App = () => {
  const [view, setView] = useState<View>('WELCOME');
  const [user, setUser] = useState<UserProfile>({
    id: useMemo(() => Math.random().toString(36).substr(2, 6), []),
    name: '',
    area: AREAS[0],
    interests: [],
    lastSeen: Date.now()
  });
  const [neighbors, setNeighbors] = useState<UserProfile[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [smartSpot, setSmartSpot] = useState('');

  // Heartbeat & Discovery
  useEffect(() => {
    if (view !== 'DASHBOARD') return;

    const runSync = async () => {
      setIsSyncing(true);
      try {
        const areaKey = `dir_${user.area.replace(/[^a-zA-Z]/g, '')}`;
        
        // 1. Update MY individual heartbeat
        const myProfile = { ...user, lastSeen: Date.now() };
        await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/u_${user.id}/${encodeURIComponent(JSON.stringify(myProfile))}`, { method: 'POST' });

        // 2. Add myself to the neighborhood directory if not there
        const dirRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/${areaKey}`);
        const dirText = await dirRes.text();
        let directory: string[] = dirText && dirText !== "null" ? JSON.parse(dirText) : [];
        if (!directory.includes(user.id)) {
          directory = [...directory, user.id].slice(-20); // Keep last 20 active
          await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/${areaKey}/${encodeURIComponent(JSON.stringify(directory))}`, { method: 'POST' });
        }

        // 3. Fetch all profiles in the directory
        const profiles = await Promise.all(directory.map(async (id) => {
          if (id === user.id) return null;
          const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/u_${id}`);
          const text = await res.text();
          return text && text !== "null" ? JSON.parse(text) : null;
        }));

        // 4. Filter for active (last 30s)
        const activeNeighbors = profiles.filter(p => p && (Date.now() - p.lastSeen < 30000)) as UserProfile[];
        setNeighbors(activeNeighbors);
      } catch (e) { console.error("Sync Error", e); }
      setIsSyncing(false);
    };

    runSync();
    const interval = setInterval(runSync, 5000);
    return () => clearInterval(interval);
  }, [view, user]);

  const handleFinishSetup = () => {
    if (user.name && user.interests.length > 0) setView('DASHBOARD');
  };

  const getSpot = async () => {
    setSmartSpot("Searching for a safe spot...");
    const spot = await findSafeSpot(user.area, user.interests[0] || "meeting");
    setSmartSpot(spot);
    speak(`I found a spot for you: ${spot}`);
  };

  const renderWelcome = () => (
    <div className="p-10 flex flex-col items-center text-center space-y-12 animate-fadeIn min-h-screen justify-center">
      <div className="text-9xl animate-bounce">👟</div>
      <div className="space-y-4">
        <h1 className="text-6xl font-black tracking-tighter uppercase text-amber-900">GoldenBuddy</h1>
        <p className="text-xl text-amber-800/60 font-bold uppercase tracking-widest">Safe Neighbor Connections</p>
      </div>
      <button onClick={() => setView('NAME')} className="w-full bg-amber-500 text-amber-950 font-black py-8 rounded-[3rem] text-3xl shadow-2xl active:scale-95 transition-all uppercase">Get Started</button>
    </div>
  );

  const renderName = () => (
    <div className="p-8 space-y-10 animate-slideIn flex flex-col justify-center min-h-[80vh]">
      <h2 className="text-5xl font-black tracking-tight text-slate-800">What is your name?</h2>
      <input autoFocus value={user.name} onChange={e => setUser({...user, name: e.target.value})} className="w-full p-8 text-4xl border-b-8 border-amber-400 bg-transparent outline-none focus:border-amber-600 transition-colors" placeholder="e.g. Martha" />
      <button onClick={() => setView('LOCATION')} disabled={!user.name} className="w-full bg-amber-500 text-amber-950 font-black py-6 rounded-3xl text-2xl shadow-xl disabled:bg-slate-200 uppercase">Continue</button>
    </div>
  );

  const renderLocation = () => (
    <div className="p-8 space-y-8 animate-slideIn">
      <h2 className="text-4xl font-black tracking-tight">Your Details</h2>
      <div className="space-y-2">
        <p className="font-bold text-slate-400 uppercase text-xs tracking-widest ml-2">Neighborhood</p>
        <select value={user.area} onChange={e => setUser({...user, area: e.target.value})} className="w-full p-6 text-2xl border-4 border-amber-300 rounded-[2rem] bg-white shadow-lg">
          {AREAS.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>
      
      <div className="space-y-3">
        <p className="font-bold text-slate-400 uppercase text-xs tracking-widest ml-2">Interests</p>
        <div className="grid grid-cols-1 gap-2">
          {INTERESTS.map(i => (
            <button key={i} onClick={() => setUser({...user, interests: user.interests.includes(i) ? user.interests.filter(x => x !== i) : [...user.interests, i]})} className={`p-6 rounded-[2rem] text-2xl font-black border-4 transition-all ${user.interests.includes(i) ? 'border-amber-500 bg-amber-50' : 'border-slate-100 bg-white'}`}>
              {i}
            </button>
          ))}
        </div>
      </div>
      <button onClick={handleFinishSetup} disabled={user.interests.length === 0} className="w-full bg-amber-500 text-amber-950 font-black py-6 rounded-[3rem] text-2xl shadow-2xl disabled:bg-slate-200 uppercase">Find Neighbors</button>
    </div>
  );

  const renderDashboard = () => (
    <div className="p-6 space-y-10 pb-40 animate-fadeIn">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-900 uppercase">Neighbors</h2>
          <p className="text-sm font-black text-amber-600 uppercase tracking-widest mt-1">📍 {user.area}</p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full border border-green-100">
          <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-500 animate-ping' : 'bg-green-500'}`}></span>
          <span className="text-[10px] font-black uppercase text-green-700 tracking-tighter">Searching...</span>
        </div>
      </header>

      <div className="space-y-4">
        {neighbors.length === 0 ? (
          <div className="py-24 text-center border-4 border-dashed border-slate-200 rounded-[3rem] opacity-40">
            <div className="text-7xl animate-pulse">🔎</div>
            <p className="font-black text-slate-400 uppercase text-xs tracking-widest mt-4">Waiting for others in {user.area}...</p>
          </div>
        ) : (
          neighbors.map(n => (
            <div key={n.id} className="bg-white p-6 rounded-[2.5rem] border-4 border-slate-100 shadow-xl flex items-center justify-between group">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-amber-400 rounded-3xl flex items-center justify-center text-3xl font-black text-amber-950">
                  {n.name[0]}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">{n.name}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{n.interests.join(" • ")}</p>
                </div>
              </div>
              <button onClick={() => speak(`How about inviting ${n.name} for ${n.interests[0]}?`)} className="bg-amber-50 p-4 rounded-full text-2xl active:scale-90 transition-all shadow-md">🔊</button>
            </div>
          ))
        )}
      </div>

      <div className="bg-indigo-600 p-8 rounded-[3.5rem] text-white space-y-6 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="font-black text-xl uppercase tracking-widest text-indigo-200">AI Safety Assistant</h3>
          <p className="text-lg font-medium opacity-90 leading-relaxed mt-2 italic">{smartSpot || "I can suggest a safe public place to meet nearby using Google Search."}</p>
        </div>
        <button onClick={getSpot} className="w-full py-6 bg-white text-indigo-700 font-black rounded-3xl uppercase text-xl shadow-lg relative z-10 active:scale-95 transition-transform">
          Suggest Safe Spot
        </button>
        <div className="absolute -right-10 -bottom-10 text-[12rem] opacity-5 pointer-events-none">📍</div>
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-md border-t border-slate-100">
        <button onClick={() => window.location.reload()} className="w-full py-4 text-slate-300 font-black uppercase text-[10px] tracking-[0.4em] hover:text-red-400 transition-colors">Clear Data & Restart</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen max-w-md mx-auto bg-amber-50/20 flex flex-col selection:bg-amber-200">
      <header className="p-5 bg-amber-400 flex justify-between items-center shadow-lg sticky top-0 z-[100]">
        <h1 className="font-black text-2xl text-amber-950 uppercase tracking-tighter">GoldenBuddy</h1>
        <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center font-black text-amber-950 border-2 border-amber-300">
          {user.name ? user.name[0] : '?'}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        {view === 'WELCOME' && renderWelcome()}
        {view === 'NAME' && renderName()}
        {view === 'LOCATION' && renderLocation()}
        {view === 'DASHBOARD' && renderDashboard()}
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
