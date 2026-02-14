
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

// --- CONFIGURATION ---
const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'gb_v30_final_resilient'; // New token for a fresh start
const AREAS = ['Arlington, VA', 'Alexandria, VA', 'Richmond, VA', 'Fairfax, VA', 'Washington, DC', 'New York, NY', 'Miami, FL'];
const INTERESTS = ['Walking', 'Chess', 'Coffee', 'Gardening', 'Bird Watching'];

type View = 'WELCOME' | 'NAME' | 'LOCATION' | 'DASHBOARD';

interface Neighbor {
  id: string;
  name: string;
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
      contents: [{ parts: [{ text: `Speak warmly and slowly: ${text}` }] }],
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
  } catch (e) { console.warn("TTS Error", e); }
};

// --- MAIN APP ---
const App = () => {
  const [view, setView] = useState<View>('WELCOME');
  const [name, setName] = useState('');
  const [area, setArea] = useState(AREAS[0]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'ok' | 'syncing' | 'error'>('idle');
  const [smartSpot, setSmartSpot] = useState('');
  const [icebreaker, setIcebreaker] = useState<Record<string, string>>({});

  const userId = useMemo(() => Math.random().toString(36).substring(2, 9), []);
  const syncLock = useRef(false);

  // --- RESILIENT SYNC ENGINE ---
  const performSync = useCallback(async () => {
    if (view !== 'DASHBOARD' || syncLock.current) return;
    syncLock.current = true;
    setSyncStatus('syncing');

    try {
      const safeArea = area.replace(/[^a-zA-Z]/g, '').toLowerCase();
      const dirKey = `dir_${safeArea}`;
      const myKey = `u_${userId}`;

      // 1. Update MY profile flare
      const myProfile = { id: userId, name, interests: selectedInterests, lastSeen: Date.now() };
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/${myKey}/${encodeURIComponent(JSON.stringify(myProfile))}`, { method: 'POST' });

      // 2. Add myself to the Directory (List of IDs)
      const dirRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/${dirKey}`);
      const dirRaw = await dirRes.text();
      let directory: string[] = [];
      try {
        const cleaned = dirRaw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
        directory = JSON.parse(cleaned && cleaned !== "null" ? cleaned : "[]");
      } catch (e) { directory = []; }

      if (!directory.includes(userId)) {
        directory = [...directory, userId].slice(-15); // Keep last 15
        await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/${dirKey}/${encodeURIComponent(JSON.stringify(directory))}`, { method: 'POST' });
      }

      // 3. Fetch all neighbor flares
      const neighborProfiles = await Promise.all(
        directory.filter(id => id !== userId).map(async (id) => {
          try {
            const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/u_${id}`);
            const text = await res.text();
            const cleaned = text.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
            return JSON.parse(cleaned && cleaned !== "null" ? cleaned : "null");
          } catch (e) { return null; }
        })
      );

      // 4. Filter for active (last 60s)
      const active = neighborProfiles.filter(p => p && (Date.now() - p.lastSeen < 60000)) as Neighbor[];
      setNeighbors(active);
      setSyncStatus('ok');
    } catch (err) {
      console.error("Sync Error:", err);
      setSyncStatus('error');
    } finally {
      syncLock.current = false;
    }
  }, [view, area, name, selectedInterests, userId]);

  useEffect(() => {
    if (view === 'DASHBOARD') {
      performSync();
      const interval = setInterval(performSync, 6000);
      return () => clearInterval(interval);
    }
  }, [view, performSync]);

  // --- AI FEATURES ---
  const generateIcebreaker = async (neighbor: Neighbor) => {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a friendly senior neighbor. Suggest 1 warm, 1-sentence icebreaker question for ${name} to ask ${neighbor.name}. Both like ${neighbor.interests[0]}.`,
      });
      setIcebreaker(prev => ({ ...prev, [neighbor.id]: response.text }));
      speak(response.text);
    } catch (e) {
      setIcebreaker(prev => ({ ...prev, [neighbor.id]: `Hi ${neighbor.name}! How long have you enjoyed ${neighbor.interests[0]}?` }));
    }
  };

  const findSafeSpot = async () => {
    setSmartSpot("Searching Google for a safe spot...");
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Find 1 real-world, safe public meeting spot in ${area} for ${selectedInterests[0]}. Provide name and a short reason.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      setSmartSpot(response.text);
      speak(`I found a place: ${response.text}`);
    } catch (e) {
      setSmartSpot("The nearest public library is a great, safe place to meet.");
    }
  };

  // --- VIEWS ---
  if (view === 'WELCOME') return (
    <div className="p-10 flex flex-col items-center justify-center min-h-screen text-center space-y-12 animate-fadeIn bg-amber-50">
      <div className="text-9xl animate-bounce">🤝</div>
      <div className="space-y-4">
        <h1 className="text-6xl font-black text-amber-900 tracking-tighter uppercase leading-none">GoldenBuddy</h1>
        <p className="text-xl text-amber-800/60 font-bold uppercase tracking-widest">Neighbor Connections</p>
      </div>
      <button onClick={() => setView('NAME')} className="w-full bg-amber-500 text-amber-950 font-black py-8 rounded-[3rem] text-3xl shadow-2xl active:scale-95 transition-all uppercase">Get Started</button>
    </div>
  );

  if (view === 'NAME') return (
    <div className="p-8 flex flex-col justify-center min-h-screen space-y-10 animate-slideIn bg-white">
      <h2 className="text-5xl font-black text-slate-900 leading-tight">What is your name?</h2>
      <input autoFocus value={name} onChange={e => setName(e.target.value)} className="w-full p-8 text-4xl border-b-8 border-amber-400 bg-transparent outline-none focus:border-amber-600 transition-colors" placeholder="Martha" />
      <button onClick={() => setView('LOCATION')} disabled={!name} className="w-full bg-amber-500 text-amber-950 font-black py-6 rounded-[2rem] text-2xl shadow-xl disabled:bg-slate-200 uppercase">Continue</button>
    </div>
  );

  if (view === 'LOCATION') return (
    <div className="p-8 space-y-8 animate-slideIn bg-white min-h-screen">
      <h2 className="text-4xl font-black text-slate-900">Neighborhood</h2>
      <select value={area} onChange={e => setArea(e.target.value)} className="w-full p-6 text-2xl border-4 border-amber-300 rounded-[2rem] bg-white shadow-lg appearance-none">
        {AREAS.map(a => <option key={a}>{a}</option>)}
      </select>
      <div className="space-y-3">
        <p className="font-black text-slate-400 uppercase text-xs tracking-widest ml-2">I enjoy...</p>
        <div className="grid grid-cols-1 gap-2">
          {INTERESTS.map(i => (
            <button key={i} onClick={() => setSelectedInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])} className={`p-6 rounded-[2rem] text-2xl font-black border-4 transition-all ${selectedInterests.includes(i) ? 'border-amber-500 bg-amber-50' : 'border-slate-100 bg-white'}`}>{i}</button>
          ))}
        </div>
      </div>
      <button onClick={() => setView('DASHBOARD')} disabled={selectedInterests.length === 0} className="w-full bg-amber-500 text-amber-950 font-black py-6 rounded-[3rem] text-2xl shadow-2xl disabled:bg-slate-200 uppercase">Find Buddies</button>
    </div>
  );

  return (
    <div className="min-h-screen max-w-md mx-auto bg-slate-50 flex flex-col">
      <header className="p-5 bg-amber-400 flex justify-between items-center shadow-lg sticky top-0 z-[100]">
        <h1 className="font-black text-2xl text-amber-950 uppercase tracking-tighter">GoldenBuddy</h1>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${syncStatus === 'ok' ? 'bg-green-600' : syncStatus === 'error' ? 'bg-red-600' : 'bg-white animate-pulse'}`} />
          <span className="text-[10px] font-black uppercase text-amber-900 tracking-widest">{syncStatus}</span>
        </div>
      </header>

      <main className="p-6 space-y-8 pb-40 flex-1 overflow-y-auto">
        <div className="flex justify-between items-end">
          <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Neighbors</h2>
          <p className="text-xs font-black text-amber-600 uppercase tracking-widest">📍 {area}</p>
        </div>

        {neighbors.length === 0 ? (
          <div className="py-24 text-center border-4 border-dashed border-slate-200 rounded-[3rem] opacity-40">
            <div className="text-7xl animate-pulse">🔎</div>
            <p className="font-black text-slate-400 uppercase text-xs tracking-widest mt-4 leading-relaxed px-10">Searching for other buddies in {area}...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {neighbors.map(n => (
              <div key={n.id} className="bg-white p-6 rounded-[2.5rem] border-4 border-slate-100 shadow-xl space-y-4 animate-scaleUp">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-amber-400 rounded-3xl flex items-center justify-center text-3xl font-black text-amber-950 shadow-inner">
                      {n.name[0]}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">{n.name}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{n.interests.join(" • ")}</p>
                    </div>
                  </div>
                  <button onClick={() => generateIcebreaker(n)} className="bg-amber-100 p-4 rounded-full text-2xl active:scale-90 transition-transform">💬</button>
                </div>
                {icebreaker[n.id] && (
                  <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-200 animate-fadeIn">
                    <p className="text-sm font-bold text-amber-900 italic leading-relaxed">“{icebreaker[n.id]}”</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-indigo-600 p-8 rounded-[3.5rem] text-white space-y-6 shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-black text-xl uppercase tracking-widest text-indigo-200">AI Safety Assistant</h3>
            <p className="text-lg font-medium opacity-90 leading-relaxed mt-2 italic">{smartSpot || "I'll suggest a real-world safe place to meet in your neighborhood."}</p>
          </div>
          <button onClick={findSafeSpot} className="w-full py-6 bg-white text-indigo-700 font-black rounded-3xl uppercase text-xl shadow-lg relative z-10 active:scale-95 transition-transform">Suggest Safe Spot</button>
          <div className="absolute -right-10 -bottom-10 text-[12rem] opacity-5 pointer-events-none">📍</div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-white/95 backdrop-blur-md border-t border-slate-100">
        <button onClick={() => window.location.reload()} className="w-full py-4 text-slate-300 font-black uppercase text-[10px] tracking-[0.4em] hover:text-red-400 transition-colors">Log Out & Clear</button>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
