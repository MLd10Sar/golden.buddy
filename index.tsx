
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

// --- CONFIGURATION ---
// We use a completely new token to ensure zero interference from previous tests.
const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'golden_buddy_sync_v25_ultra'; 
const AREAS = ['Arlington, VA', 'Alexandria, VA', 'Richmond, VA', 'Fairfax, VA', 'Washington, DC', 'New York, NY', 'Miami, FL'];
const INTERESTS = ['Walking', 'Chess', 'Coffee', 'Gardening', 'Bird Watching'];

type View = 'WELCOME' | 'NAME' | 'LOCATION' | 'DASHBOARD';

interface Neighbor {
  id: string;
  name: string;
  interests: string[];
  lastSeen: number;
}

// --- AI UTILITIES ---
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

const speak = async (text: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Speak warmly: ${text}` }] }],
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
  } catch (e) { console.warn("TTS Failed", e); }
};

const findSafeMeetingSpot = async (area: string, activity: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Find one specific, safe public meeting spot in ${area} for ${activity}. Provide the name and a short reason why it is senior-friendly.`,
      config: { tools: [{ googleSearch: {} }] }
    });
    return response.text;
  } catch (e) {
    return "Your local community center lobby - it's public, safe, and usually has seating.";
  }
};

// --- MAIN APPLICATION ---
const App = () => {
  const [view, setView] = useState<View>('WELCOME');
  const [name, setName] = useState('');
  const [area, setArea] = useState(AREAS[0]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'ok'>('idle');
  const [lastSync, setLastSync] = useState<number>(0);
  const [smartSpot, setSmartSpot] = useState('');
  const [errorCount, setErrorCount] = useState(0);
  
  const userId = useMemo(() => Math.random().toString(36).substring(2, 9), []);

  const syncNeighborhood = useCallback(async () => {
    if (view !== 'DASHBOARD') return;
    
    setSyncStatus('syncing');
    try {
      // Create a URL-safe key for the area
      const safeArea = area.replace(/[^a-zA-Z]/g, '').toLowerCase();
      const boardKey = `board_${safeArea}`;

      // 1. Fetch current board state
      const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/${boardKey}`);
      if (!res.ok) throw new Error("Fetch failed");
      
      const rawText = await res.text();
      let board: Neighbor[] = [];
      
      try {
        // Clean up text in case of weird API wrappers
        const cleaned = rawText.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
        const parsed = JSON.parse(cleaned && cleaned !== "null" ? cleaned : "[]");
        board = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.warn("Board parse warning:", e);
        board = [];
      }

      // 2. Filter board (only people seen in last 90 seconds)
      const now = Date.now();
      board = board.filter(n => (now - n.lastSeen) < 90000);

      // 3. Insert/Update me
      const me: Neighbor = { id: userId, name, interests: selectedInterests, lastSeen: now };
      const others = board.filter(n => n.id !== userId);
      const updatedBoard = [...others, me];

      // 4. Update Board (Using simple POST request)
      // Note: We use encodeURIComponent because the API expects the value in the path
      const updateUrl = `${RELAY_BASE}/UpdateValue/${APP_TOKEN}/${boardKey}/${encodeURIComponent(JSON.stringify(updatedBoard))}`;
      const updateRes = await fetch(updateUrl, { method: 'POST' });

      if (updateRes.ok) {
        setNeighbors(others);
        setSyncStatus('ok');
        setLastSync(now);
        setErrorCount(0);
      } else {
        throw new Error("Update failed");
      }
    } catch (err) {
      console.error("Critical Sync Error:", err);
      setSyncStatus('error');
      setErrorCount(prev => prev + 1);
    }
  }, [view, area, name, selectedInterests, userId]);

  // Sync Loop
  useEffect(() => {
    if (view === 'DASHBOARD') {
      syncNeighborhood();
      const interval = setInterval(syncNeighborhood, 7000); // 7 seconds is safer for public relays
      return () => clearInterval(interval);
    }
  }, [view, syncNeighborhood]);

  const handleGetSpot = async () => {
    setSmartSpot("Searching...");
    const spot = await findSafeMeetingSpot(area, selectedInterests[0] || "coffee");
    setSmartSpot(spot);
    speak(`I recommend: ${spot}`);
  };

  const renderWelcome = () => (
    <div className="p-10 flex flex-col items-center justify-center min-h-[90vh] text-center space-y-12 animate-fadeIn">
      <div className="text-9xl animate-bounce">👟</div>
      <div className="space-y-4">
        <h1 className="text-6xl font-black text-amber-900 tracking-tighter uppercase leading-none">GoldenBuddy</h1>
        <p className="text-xl text-amber-800/60 font-bold uppercase tracking-widest">Neighbor Connections</p>
      </div>
      <button onClick={() => setView('NAME')} className="w-full bg-amber-500 text-amber-950 font-black py-8 rounded-[3rem] text-3xl shadow-2xl active:scale-95 transition-all uppercase">Get Started</button>
    </div>
  );

  const renderName = () => (
    <div className="p-8 flex flex-col justify-center min-h-[80vh] space-y-10 animate-slideIn">
      <h2 className="text-5xl font-black text-slate-900">Your name?</h2>
      <input 
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full p-8 text-4xl border-b-8 border-amber-400 bg-transparent outline-none focus:border-amber-600 transition-colors"
        placeholder="Martha"
      />
      <button onClick={() => setView('LOCATION')} disabled={!name} className="w-full bg-amber-500 text-amber-950 font-black py-6 rounded-[2rem] text-2xl shadow-xl disabled:bg-slate-200 uppercase">Next</button>
    </div>
  );

  const renderLocation = () => (
    <div className="p-8 space-y-8 animate-slideIn">
      <h2 className="text-4xl font-black text-slate-900">Neighborhood</h2>
      <select 
        value={area}
        onChange={e => setArea(e.target.value)}
        className="w-full p-6 text-2xl border-4 border-amber-300 rounded-[2rem] bg-white shadow-lg"
      >
        {AREAS.map(a => <option key={a}>{a}</option>)}
      </select>
      <div className="space-y-3">
        <p className="font-black text-slate-400 uppercase text-xs tracking-widest ml-2">I like...</p>
        <div className="grid grid-cols-1 gap-2">
          {INTERESTS.map(i => (
            <button 
              key={i} 
              onClick={() => setSelectedInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
              className={`p-6 rounded-[2rem] text-2xl font-black border-4 transition-all ${selectedInterests.includes(i) ? 'border-amber-500 bg-amber-50' : 'border-slate-100 bg-white'}`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>
      <button onClick={() => setView('DASHBOARD')} disabled={selectedInterests.length === 0} className="w-full bg-amber-500 text-amber-950 font-black py-6 rounded-[3rem] text-2xl shadow-2xl disabled:bg-slate-200 uppercase">Start Discovery</button>
    </div>
  );

  const renderDashboard = () => (
    <div className="p-6 space-y-8 pb-40 animate-fadeIn relative">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-900 uppercase">Neighbors</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm font-black text-amber-600 uppercase tracking-widest">📍 {area}</p>
            <div className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'syncing' ? 'bg-amber-400 animate-ping' : syncStatus === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="text-[10px] font-black text-slate-300 uppercase tracking-widest border-b border-slate-100">Sign Out</button>
      </header>

      {syncStatus === 'error' && (
        <div className="bg-red-50 border-2 border-red-100 p-4 rounded-3xl text-red-600 text-center font-bold text-sm">
          Connection lost. Retrying... ({errorCount})
          <button onClick={syncNeighborhood} className="block w-full mt-2 bg-red-600 text-white py-2 rounded-xl text-xs uppercase font-black">Force Reconnect</button>
        </div>
      )}

      <div className="space-y-4">
        {neighbors.length === 0 ? (
          <div className="py-24 text-center border-4 border-dashed border-slate-100 rounded-[3rem] opacity-30 flex flex-col items-center">
            <div className="text-7xl animate-pulse">🔎</div>
            <p className="font-black text-slate-400 uppercase text-xs tracking-widest mt-4">Looking for buddies in {area}...</p>
            <p className="text-[10px] text-slate-300 mt-2 italic font-medium">To test: Open this app on another device and select the same neighborhood.</p>
          </div>
        ) : (
          neighbors.map(n => (
            <div key={n.id} className="bg-white p-6 rounded-[2.5rem] border-4 border-slate-100 shadow-xl flex items-center justify-between animate-scaleUp">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-amber-400 rounded-3xl flex items-center justify-center text-3xl font-black text-amber-950 shadow-inner">
                  {n.name[0]}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">{n.name}</h3>
                  <div className="flex gap-1 mt-1">
                    {n.interests.map(i => <span key={i} className="text-[9px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{i}</span>)}
                  </div>
                </div>
              </div>
              <button onClick={() => speak(`Why not ask ${n.name} for a ${n.interests[0]} session?`)} className="bg-amber-100 p-4 rounded-full text-2xl active:scale-90 transition-transform">🔊</button>
            </div>
          ))
        )}
      </div>

      <div className="bg-indigo-600 p-8 rounded-[3.5rem] text-white space-y-6 shadow-2xl relative overflow-hidden group">
        <div className="relative z-10">
          <h3 className="font-black text-xl uppercase tracking-widest text-indigo-200">AI Safety Guide</h3>
          <p className="text-lg font-medium opacity-90 leading-relaxed mt-2 italic">
            {smartSpot || "I'll find a public spot for you to meet safely using Google Search."}
          </p>
        </div>
        <button 
          onClick={handleGetSpot} 
          className="w-full py-6 bg-white text-indigo-700 font-black rounded-3xl uppercase text-xl shadow-lg relative z-10 active:scale-95 transition-transform"
        >
          {smartSpot ? "Find Another" : "Find Safe Place"}
        </button>
        <div className="absolute -right-10 -bottom-10 text-[12rem] opacity-5 pointer-events-none group-hover:rotate-12 transition-transform">📍</div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-white/95 backdrop-blur-md border-t border-slate-100 flex flex-col items-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
          Cloud Status: {syncStatus.toUpperCase()} • {lastSync ? new Date(lastSync).toLocaleTimeString() : 'WAITING'}
        </p>
      </footer>
    </div>
  );

  return (
    <div className="min-h-screen max-w-md mx-auto bg-amber-50/20 flex flex-col selection:bg-amber-200">
      <header className="p-5 bg-amber-400 flex justify-between items-center shadow-lg sticky top-0 z-[100]">
        <h1 className="font-black text-2xl text-amber-950 uppercase tracking-tighter">GoldenBuddy</h1>
        <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center font-black text-amber-950 border-2 border-amber-300">
          {name ? name[0] : '?'}
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
