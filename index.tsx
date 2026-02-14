
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

// --- TYPES & CONSTANTS ---
type Interest = 'Walking' | 'Chess' | 'Coffee' | 'Bird Watching' | 'Gardening';
type View = 'WELCOME' | 'NAME' | 'LOCATION' | 'DASHBOARD';

interface Neighbor {
  id: string;
  name: string;
  interests: Interest[];
  lastSeen: number;
}

const INTEREST_MAP: { id: Interest; icon: string }[] = [
  { id: 'Walking', icon: '👟' },
  { id: 'Chess', icon: '♟️' },
  { id: 'Coffee', icon: '☕' },
  { id: 'Bird Watching', icon: '🦜' },
  { id: 'Gardening', icon: '🌱' },
];

const AREAS = ['Arlington, VA', 'Alexandria, VA', 'Richmond, VA', 'Fairfax, VA'];
const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'gb_v10_final_discovery';

// --- AI SERVICES ---
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

const speakText = async (text: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say clearly and warmly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
    }
  } catch (e) { console.error("TTS Failed", e); }
};

const getSmartSpot = async (area: string, activity: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Find a real, highly-rated, safe public spot in ${area} for ${activity}. Give the name and 1 sentence why it is good for seniors.`,
      config: { tools: [{ googleSearch: {} }] }
    });
    return response.text;
  } catch (e) {
    return "The local public library - it's safe, central, and has comfortable seating.";
  }
};

// --- MAIN APPLICATION ---
const App = () => {
  const [view, setView] = useState<View>('WELCOME');
  const [name, setName] = useState('');
  const [area, setArea] = useState(AREAS[0]);
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  
  const [loadingSpot, setLoadingSpot] = useState(false);
  const [smartSpot, setSmartSpot] = useState('');

  // Use a persistent ID for this session
  const userId = useMemo(() => Math.random().toString(36).substr(2, 6), []);

  // --- ROOM-BASED DISCOVERY LOGIC ---
  useEffect(() => {
    if (view !== 'DASHBOARD') return;

    const syncBoard = async () => {
      try {
        const boardKey = `board_${area.replace(/[^a-zA-Z]/g, '')}`;
        
        // 1. Fetch the current neighborhood board
        const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/${boardKey}`);
        const raw = await res.text();
        let board: Neighbor[] = (raw && raw !== "null") ? JSON.parse(raw) : [];
        
        // 2. Remove stale users (> 30s) and update self
        const now = Date.now();
        board = board.filter(n => n.id !== userId && (now - n.lastSeen < 30000));
        board.push({ id: userId, name, interests: selectedInterests, lastSeen: now });

        // 3. Save the updated board
        await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/${boardKey}/${encodeURIComponent(JSON.stringify(board))}`, { method: 'POST' });
        
        // 4. Update UI (exclude self)
        setNeighbors(board.filter(n => n.id !== userId));
      } catch (e) { console.error("Discovery Sync Error", e); }
    };

    // Immediate sync then every 5s
    syncBoard();
    const interval = setInterval(syncBoard, 5000);
    return () => clearInterval(interval);
  }, [view, userId, name, area, selectedInterests]);

  const handleSuggestSpot = async () => {
    setLoadingSpot(true);
    const spot = await getSmartSpot(area, selectedInterests[0] || "a meeting");
    setSmartSpot(spot || "");
    setLoadingSpot(false);
    if (spot) speakText(`I found a great spot: ${spot}`);
  };

  const renderWelcome = () => (
    <div className="p-10 flex flex-col items-center text-center space-y-12 animate-fadeIn min-h-screen">
      <div className="text-9xl animate-bounce mt-16 drop-shadow-2xl">🤝</div>
      <div className="space-y-4">
        <h1 className="text-6xl font-black tracking-tighter uppercase text-amber-900">GoldenBuddy</h1>
        <p className="text-xl text-amber-800/60 font-medium">Safe neighborhood connections for activities you love.</p>
      </div>
      <button 
        onClick={() => setView('NAME')} 
        className="w-full bg-amber-500 text-amber-950 font-black py-8 rounded-[3rem] text-3xl shadow-2xl active:scale-95 transition-all uppercase"
      >
        Start Now
      </button>
    </div>
  );

  const renderName = () => (
    <div className="p-8 space-y-10 animate-slideIn flex flex-col justify-center min-h-[80vh]">
      <h2 className="text-5xl font-black tracking-tight text-slate-800">What's your name?</h2>
      <input 
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full p-8 text-4xl border-b-8 border-amber-400 bg-transparent outline-none focus:border-amber-600 transition-colors"
        placeholder="e.g. Martha"
      />
      <div className="pt-10 space-y-4">
        <button onClick={() => setView('LOCATION')} disabled={!name} className="w-full bg-amber-500 text-amber-950 font-black py-6 rounded-3xl text-2xl shadow-xl disabled:bg-slate-200 uppercase">Continue</button>
        <button onClick={() => setView('WELCOME')} className="w-full text-slate-400 font-bold uppercase tracking-widest text-sm">Go Back</button>
      </div>
    </div>
  );

  const renderLocation = () => (
    <div className="p-8 space-y-8 animate-slideIn">
      <h2 className="text-4xl font-black tracking-tight">Your Neighborhood</h2>
      <select 
        value={area}
        onChange={(e) => setArea(e.target.value)}
        className="w-full p-6 text-2xl border-4 border-amber-300 rounded-[2rem] bg-white shadow-lg"
      >
        {AREAS.map(a => <option key={a}>{a}</option>)}
      </select>
      
      <div className="grid grid-cols-1 gap-4">
        <p className="font-bold text-slate-400 uppercase text-xs tracking-widest ml-2">What do you enjoy?</p>
        {INTEREST_MAP.map(i => (
          <button 
            key={i.id} 
            onClick={() => setSelectedInterests(prev => prev.includes(i.id) ? prev.filter(x => x !== i.id) : [...prev, i.id])}
            className={`p-6 rounded-[2.5rem] text-2xl font-black flex items-center gap-4 border-4 transition-all shadow-md ${selectedInterests.includes(i.id) ? 'border-amber-500 bg-amber-50' : 'border-slate-100 bg-white'}`}
          >
            <span className="text-3xl">{i.icon}</span> {i.id}
          </button>
        ))}
      </div>
      
      <button 
        onClick={() => setView('DASHBOARD')} 
        disabled={selectedInterests.length === 0} 
        className="w-full bg-amber-500 text-amber-950 font-black py-6 rounded-[3rem] text-2xl shadow-2xl disabled:bg-slate-200 uppercase mt-8"
      >
        Find Neighbors
      </button>
    </div>
  );

  const renderDashboard = () => (
    <div className="p-6 space-y-10 pb-40 animate-fadeIn">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tight uppercase text-slate-900 leading-none">Neighbors</h2>
          <p className="text-sm font-black text-amber-600 uppercase tracking-widest mt-2">📍 {area}</p>
        </div>
        <div className="flex gap-2 items-center bg-green-50 px-3 py-1 rounded-full border border-green-100">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-[10px] font-black uppercase text-green-700 tracking-tighter">Live Board</span>
        </div>
      </div>

      <div className="space-y-5">
        {neighbors.length === 0 ? (
          <div className="py-24 text-center space-y-4 bg-white/40 rounded-[3rem] border-4 border-dashed border-slate-200">
            <div className="text-7xl animate-pulse opacity-20">🔎</div>
            <p className="font-black text-slate-400 uppercase tracking-[0.2em] text-xs">Waiting for buddies in {area}...</p>
          </div>
        ) : (
          neighbors.map(n => (
            <div key={n.id} className="bg-white p-7 rounded-[3rem] border-4 border-slate-100 shadow-xl flex items-center justify-between group animate-scaleUp">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-amber-400 rounded-3xl flex items-center justify-center text-3xl font-black text-amber-950 shadow-inner">
                  {n.name[0]}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">{n.name}</h3>
                  <div className="flex gap-1 mt-1">
                    {n.interests.map(i => (
                      <span key={i} className="text-[9px] font-black text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">{i}</span>
                    ))}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => speakText(`How about inviting ${n.name} for a session of ${n.interests[0] || 'your favorite activity'}?`)}
                className="bg-amber-100 p-4 rounded-full hover:scale-110 active:scale-90 transition-all shadow-md"
              >
                🔊
              </button>
            </div>
          ))
        )}
      </div>

      <div className="bg-indigo-600 p-8 rounded-[3.5rem] text-white space-y-6 shadow-2xl relative overflow-hidden border-t-8 border-white/10">
        <div className="flex justify-between items-center relative z-10">
          <h3 className="font-black text-xl uppercase tracking-widest text-indigo-200">AI Safety Finder</h3>
          <span className="text-xs font-black bg-indigo-500/50 px-3 py-1 rounded-full border border-indigo-400">Search-Enabled</span>
        </div>
        <p className="text-lg font-medium opacity-90 leading-relaxed relative z-10 italic">
          {smartSpot || "I'll find a safe, popular public place for you to meet using Google Search."}
        </p>
        <button 
          onClick={handleSuggestSpot} 
          disabled={loadingSpot}
          className="w-full py-6 bg-white text-indigo-700 font-black rounded-3xl uppercase tracking-tighter disabled:opacity-50 text-xl shadow-lg relative z-10 active:scale-95 transition-transform"
        >
          {loadingSpot ? "Searching..." : "Suggest Safe Spot"}
        </button>
        <div className="absolute -right-10 -bottom-10 text-[12rem] opacity-5 pointer-events-none">📍</div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-xl border-t border-slate-100 flex flex-col gap-2">
        <button 
          onClick={() => window.location.reload()} 
          className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-[0.4em] hover:text-red-500 transition-colors"
        >
          End Session & Clear Data
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen max-w-md mx-auto bg-amber-50/30 flex flex-col selection:bg-amber-200">
      <header className="p-5 bg-amber-400 flex justify-between items-center shadow-lg z-[100] sticky top-0">
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
