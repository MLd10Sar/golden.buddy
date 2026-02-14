
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

// --- Types & Constants ---
type Interest = 'Walking' | 'Chess' | 'Coffee' | 'Bird Watching' | 'Gardening';
type View = 'WELCOME' | 'NAME' | 'LOCATION' | 'DASHBOARD';

const INTERESTS: { id: Interest; icon: string }[] = [
  { id: 'Walking', icon: '👟' },
  { id: 'Chess', icon: '♟️' },
  { id: 'Coffee', icon: '☕' },
  { id: 'Bird Watching', icon: '🦜' },
  { id: 'Gardening', icon: '🌱' },
];

const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'gb_v8_ai_enhanced';

// --- AI Service ---
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

const speakText = async (text: string) => {
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
  } catch (e) {
    console.error("TTS Error", e);
  }
};

const getSmartSpot = async (area: string, activity: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Find a safe, well-known public meeting spot in ${area} for ${activity}. Return only the name and a 1-sentence reason why it is good for seniors.`,
      config: { tools: [{ googleSearch: {} }] }
    });
    return response.text;
  } catch (e) {
    return "The local community library - it's safe and has plenty of seating.";
  }
};

// --- App Component ---
const App = () => {
  const [view, setView] = useState<View>('WELCOME');
  const [name, setName] = useState('');
  const [area, setArea] = useState('Arlington, VA');
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [neighbors, setNeighbors] = useState<any[]>([]);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isLargeText, setIsLargeText] = useState(false);
  const [loadingSpot, setLoadingSpot] = useState(false);
  const [smartSpot, setSmartSpot] = useState('');

  const userId = useMemo(() => Math.random().toString(36).substr(2, 6), []);

  // Sync presence
  useEffect(() => {
    if (view !== 'DASHBOARD') return;
    const interval = setInterval(async () => {
      const presence = { id: userId, name, area, interests: selectedInterests, lastSeen: Date.now() };
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/u_${userId}/${encodeURIComponent(JSON.stringify(presence))}`, { method: 'POST' });
      
      const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/u_list`);
      const raw = await res.text();
      let list = raw && raw !== "null" ? JSON.parse(raw) : [];
      if (!list.includes(userId)) {
        list = [...list, userId].slice(-20);
        await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/u_list/${encodeURIComponent(JSON.stringify(list))}`, { method: 'POST' });
      }

      const neighborData = await Promise.all(list.filter(id => id !== userId).map(async id => {
        const r = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/u_${id}`);
        const t = await r.text();
        return t && t !== "null" ? JSON.parse(t) : null;
      }));
      setNeighbors(neighborData.filter(n => n && Date.now() - n.lastSeen < 30000));
    }, 5000);
    return () => clearInterval(interval);
  }, [view, userId, name, area, selectedInterests]);

  const handleSuggestSpot = async () => {
    setLoadingSpot(true);
    const spot = await getSmartSpot(area, selectedInterests[0] || "a walk");
    setSmartSpot(spot || "");
    setLoadingSpot(false);
    if (spot) speakText(`I found a great spot: ${spot}`);
  };

  const renderWelcome = () => (
    <div className="p-8 flex flex-col items-center text-center space-y-8 animate-fadeIn">
      <div className="text-8xl animate-bounce mt-12">👋</div>
      <h1 className="text-5xl font-black tracking-tighter uppercase">GoldenBuddy</h1>
      <p className="text-xl text-slate-500 font-medium">Find a local neighbor to enjoy activities with, safely and simply.</p>
      <button onClick={() => setView('NAME')} className="w-full bg-amber-500 text-amber-950 font-black py-6 rounded-[2.5rem] text-2xl shadow-xl active:scale-95 transition-transform uppercase">Get Started</button>
    </div>
  );

  const renderName = () => (
    <div className="p-8 space-y-8 animate-slideIn">
      <h2 className="text-4xl font-black tracking-tight">What's your name?</h2>
      <input 
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full p-6 text-3xl border-4 border-amber-300 rounded-3xl outline-none focus:border-amber-500"
        placeholder="e.g. Martha"
      />
      <button onClick={() => setView('LOCATION')} disabled={!name} className="w-full bg-amber-500 text-amber-950 font-black py-6 rounded-[2.5rem] text-2xl shadow-xl disabled:bg-slate-200 uppercase">Continue</button>
    </div>
  );

  const renderLocation = () => (
    <div className="p-8 space-y-8 animate-slideIn">
      <h2 className="text-4xl font-black tracking-tight">Your Neighborhood?</h2>
      <select 
        value={area}
        onChange={(e) => setArea(e.target.value)}
        className="w-full p-6 text-2xl border-4 border-amber-300 rounded-3xl outline-none bg-white"
      >
        <option>Arlington, VA</option>
        <option>Alexandria, VA</option>
        <option>Richmond, VA</option>
        <option>Fairfax, VA</option>
      </select>
      <div className="grid grid-cols-1 gap-4">
        <p className="font-bold text-slate-400 uppercase text-xs tracking-widest">Select Interests</p>
        {INTERESTS.map(i => (
          <button 
            key={i.id} 
            onClick={() => setSelectedInterests(prev => prev.includes(i.id) ? prev.filter(x => x !== i.id) : [...prev, i.id])}
            className={`p-6 rounded-2xl text-xl font-black flex items-center gap-4 border-4 transition-all ${selectedInterests.includes(i.id) ? 'border-amber-500 bg-amber-50' : 'border-slate-100 bg-white'}`}
          >
            <span>{i.icon}</span> {i.id}
          </button>
        ))}
      </div>
      <button onClick={() => setView('DASHBOARD')} disabled={selectedInterests.length === 0} className="w-full bg-amber-500 text-amber-950 font-black py-6 rounded-[2.5rem] text-2xl shadow-xl disabled:bg-slate-200 uppercase">Find Neighbors</button>
    </div>
  );

  const renderDashboard = () => (
    <div className="p-6 space-y-8 pb-32">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tight">NEIGHBORS</h2>
          <p className="text-xs font-black text-amber-600 uppercase tracking-widest">📍 {area}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsHighContrast(!isHighContrast)} className="p-2 bg-slate-100 rounded-xl text-xs font-black">CONTRAST</button>
          <button onClick={() => setIsLargeText(!isLargeText)} className="p-2 bg-slate-100 rounded-xl text-xs font-black">TEXT+</button>
        </div>
      </div>

      <div className="space-y-4">
        {neighbors.length === 0 ? (
          <div className="py-20 text-center opacity-30">
            <div className="text-6xl animate-pulse">🔭</div>
            <p className="font-black text-xs uppercase mt-4">Scanning for buddies...</p>
          </div>
        ) : (
          neighbors.map(n => (
            <div key={n.id} className="bg-white p-6 rounded-[2.5rem] border-4 border-slate-100 shadow-sm flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center text-3xl font-black text-amber-600">
                  {n.name[0]}
                </div>
                <div>
                  <h3 className="text-xl font-black">{n.name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Likes: {n.interests.join(", ")}</p>
                </div>
              </div>
              <button onClick={() => speakText(`You should meet ${n.name} for a walk!`)} className="bg-amber-100 p-3 rounded-full hover:bg-amber-200 transition-colors">🔊</button>
            </div>
          ))
        )}
      </div>

      <div className="bg-indigo-600 p-8 rounded-[3rem] text-white space-y-4 shadow-2xl">
        <h3 className="font-black text-xl uppercase tracking-widest text-indigo-200">AI Safety Assistant</h3>
        <p className="text-sm font-medium opacity-90 leading-relaxed">
          {smartSpot || "I can help you find a safe public meeting spot nearby using Google Search."}
        </p>
        <button 
          onClick={handleSuggestSpot} 
          disabled={loadingSpot}
          className="w-full py-4 bg-white text-indigo-600 font-black rounded-2xl uppercase tracking-tighter disabled:opacity-50"
        >
          {loadingSpot ? "Searching..." : "Suggest Safe Meeting Spot"}
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t">
        <button onClick={() => window.location.reload()} className="w-full py-3 text-slate-400 font-black uppercase text-[10px] tracking-[0.3em]">End Session & Clear Data</button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen max-w-md mx-auto bg-amber-50/50 flex flex-col transition-all ${isHighContrast ? 'high-contrast' : ''} ${isLargeText ? 'text-lg' : ''}`}>
      <header className="p-4 bg-amber-400 flex justify-between items-center shadow-md">
        <h1 className="font-black text-xl text-amber-950 uppercase tracking-tight">GoldenBuddy</h1>
        <div className="flex items-center gap-2">
           <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
           <span className="text-[10px] font-black uppercase tracking-widest">Live</span>
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
