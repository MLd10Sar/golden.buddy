
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Session, Invite, View, AreaId, Interest, AccessibilitySettings } from '../types';
import { STORAGE_KEY, INVITE_DURATION_MS, AREAS } from '../constants';
import { getSmartMeetingSpot } from './geminiService';

const initialState: AppState = {
  currentSession: null,
  invites: [],
  currentView: 'WELCOME',
};

const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  fontSize: 'standard',
  contrastMode: 'normal',
  screenReaderOptimized: false,
};

// RELAY CONFIG
const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'gb_v7_final'; 

const encodeData = (obj: any) => {
  try {
    const str = JSON.stringify(obj);
    return btoa(encodeURIComponent(str)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (e) { return ""; }
};

const decodeData = (base64: string) => {
  try {
    if (!base64 || base64 === "null" || base64 === "" || base64 === "[]") return null;
    const clean = base64.trim().replace(/^"(.*)"$/, '$1').replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(clean)));
  } catch (e) { return null; }
};

/**
 * Sequential request queue to avoid NetworkError/Parallel limits
 */
const requestQueue: (() => Promise<any>)[] = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  isProcessingQueue = true;
  while (requestQueue.length > 0) {
    const task = requestQueue.shift();
    if (task) {
      try {
        await task();
      } catch (e) {
        console.warn("Queue task failed:", e);
      }
      // Small breather between requests
      await new Promise(r => setTimeout(r, 100));
    }
  }
  isProcessingQueue = false;
}

function queueRequest<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const result = await task();
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
    processQueue();
  });
}

/**
 * Extremely robust API call
 */
async function api(path: string, method: 'GET' | 'POST' = 'GET', value?: string) {
  return queueRequest(async () => {
    const action = method === 'POST' ? 'UpdateValue' : 'GetValue';
    // Use encodeURIComponent ONLY for the value part to handle special chars in Base64
    const url = `${RELAY_BASE}/${action}/${APP_TOKEN}/${path}${value ? '/' + encodeURIComponent(value) : ''}`;
    
    try {
      const res = await fetch(url, { 
        method: method,
        mode: 'cors',
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      return res;
    } catch (e) {
      throw e;
    }
  });
}

export function useGoldenBuddyStore() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...initialState, ...parsed, currentView: parsed.currentSession ? 'DASHBOARD' : 'WELCOME' };
      } catch (e) { return initialState; }
    }
    return initialState;
  });

  const [remotePeers, setRemotePeers] = useState<Session[]>([]);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'ERROR'>('IDLE');
  const [lastSync, setLastSync] = useState<number>(Date.now());
  const isSyncing = useRef(false);
  const consecutiveErrors = useRef(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const sync = useCallback(async () => {
    if (!state.currentSession || isSyncing.current) return;
    isSyncing.current = true;
    setSyncStatus('SYNCING');

    const myId = state.currentSession.id;
    const myArea = state.currentSession.areaId;

    try {
      // 1. Heartbeat - Essential
      await api(`u${myId}`, 'POST', `${Math.floor(Date.now()/1000)}`);

      // 2. Directory - Essential
      const dirRes = await api(`d${myArea}`, 'GET');
      const dirText = await dirRes.text();
      let directory: string[] = [];
      try {
        directory = JSON.parse(dirText.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      } catch (e) { directory = []; }
      
      if (!directory.includes(myId)) {
        directory = [myId, ...directory.filter(id => id !== myId)].slice(0, 5);
        await api(`d${myArea}`, 'POST', JSON.stringify(directory));
      }

      // 3. Profiles - Process one by one to avoid bursts
      const activePeers: Session[] = [];
      for (const id of directory) {
        if (id === myId) continue;
        try {
          // Check timestamp
          const hRes = await api(`u${id}`, 'GET');
          const hText = (await hRes.text()).trim().replace(/^"(.*)"$/, '$1');
          const ts = parseInt(hText, 10);
          
          if (!isNaN(ts) && (Math.floor(Date.now()/1000) - ts < 600)) {
            const pRes = await api(`p${id}`, 'GET');
            const p = decodeData(await pRes.text());
            if (p) activePeers.push(p);
          }
        } catch (e) { /* ignore single peer failure */ }
      }
      setRemotePeers(activePeers);

      // 4. Inbox
      const inboxRes = await api(`i${myId}`, 'GET');
      const inboxText = await inboxRes.text();
      const inviteIds: string[] = JSON.parse(inboxText.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      
      if (inviteIds.length > 0) {
        const validInvites: Invite[] = [];
        for (const id of inviteIds) {
          try {
            const res = await api(`inv${id}`, 'GET');
            const data = decodeData(await res.text());
            if (data) validInvites.push(data);
          } catch (e) {}
        }
        
        setState(prev => {
          const knownIds = prev.invites.map(i => i.id);
          const newOnes = validInvites.filter(v => !knownIds.includes(v.id));
          return newOnes.length > 0 ? { ...prev, invites: [...prev.invites, ...newOnes] } : prev;
        });
      }

      setSyncStatus('IDLE');
      setLastSync(Date.now());
      consecutiveErrors.current = 0;
    } catch (e: any) {
      console.warn("Sync error:", e);
      consecutiveErrors.current++;
      // Only show error if multiple heartbeats fail
      if (consecutiveErrors.current > 3) setSyncStatus('ERROR');
    } finally {
      isSyncing.current = false;
    }
  }, [state.currentSession]);

  useEffect(() => {
    if (!state.currentSession) return;
    const interval = 12000;
    const timer = setInterval(sync, interval);
    sync();
    return () => clearInterval(timer);
  }, [state.currentSession, sync]);

  const createSession = async (name: string, areaId: AreaId, interests: Interest[]) => {
    const s: Session = {
      id: Math.random().toString(36).substr(2, 5),
      displayName: name,
      areaId,
      interests,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      accessibility: DEFAULT_ACCESSIBILITY,
      inviteDuration: INVITE_DURATION_MS,
    };
    try {
      await api(`p${s.id}`, 'POST', encodeData(s));
    } catch (e) {}
    setState(prev => ({ ...prev, currentSession: s, currentView: 'DASHBOARD' }));
  };

  const sendInvite = async (toId: string, activity: Interest) => {
    if (!state.currentSession) return;
    const invite: Invite = {
      id: Math.random().toString(36).substr(2, 6),
      fromSessionId: state.currentSession.id,
      toSessionId: toId,
      activity,
      status: 'PENDING',
      createdAt: Date.now(),
      expiresAt: Date.now() + INVITE_DURATION_MS,
    };
    
    setState(prev => ({ ...prev, invites: [...prev.invites, invite] }));

    try {
      await api(`inv${invite.id}`, 'POST', encodeData(invite));
      const res = await api(`i${toId}`, 'GET');
      let index = JSON.parse((await res.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      index = [invite.id, ...index].slice(0, 5);
      await api(`i${toId}`, 'POST', JSON.stringify(index));
    } catch (e) {}
  };

  // Fixed missing implementation of respondToInvite
  const respondToInvite = async (inviteId: string, action: 'ACCEPTED' | 'DECLINED') => {
    const invite = state.invites.find(i => i.id === inviteId);
    if (!invite || !state.currentSession) return;
    
    let updated = { ...invite, status: action, respondedAt: Date.now() };

    if (action === 'ACCEPTED') {
      const area = AREAS.find(a => a.id === state.currentSession?.areaId);
      const activity = invite.activity;
      // Get smart meeting spot using Gemini search grounding
      const spot = await getSmartMeetingSpot(area?.name || "the local area", activity);
      updated.aiSuggestedSpot = JSON.stringify(spot);
    }

    setState(prev => ({
      ...prev,
      invites: prev.invites.map(i => i.id === inviteId ? updated : i)
    }));

    try {
      await api(`inv${inviteId}`, 'POST', encodeData(updated));
    } catch (e) {}
  };

  // Added missing setView function
  const setView = (view: View) => setState(prev => ({ ...prev, currentView: view }));

  // Added missing updateAccessibility function
  const updateAccessibility = (settings: Partial<AccessibilitySettings>) => {
    if (!state.currentSession) return;
    const updated = {
      ...state.currentSession,
      accessibility: { ...state.currentSession.accessibility, ...settings }
    };
    setState(prev => ({ ...prev, currentSession: updated }));
    api(`p${updated.id}`, 'POST', encodeData(updated)).catch(() => {});
  };

  // Added missing resetApp function
  const resetApp = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState);
  };

  // Added missing retrySync function
  const retrySync = () => {
    consecutiveErrors.current = 0;
    setSyncStatus('IDLE');
    sync();
  };

  // Added missing updateInviteDuration function
  const updateInviteDuration = (durationMs: number) => {
    if (!state.currentSession) return;
    const updated = { ...state.currentSession, inviteDuration: durationMs };
    setState(prev => ({ ...prev, currentSession: updated }));
    api(`p${updated.id}`, 'POST', encodeData(updated)).catch(() => {});
  };

  // Crucial: return the object expected by App.tsx
  return {
    state,
    remotePeers,
    syncStatus,
    lastSync,
    setView,
    createSession,
    sendInvite,
    respondToInvite,
    resetApp,
    updateAccessibility,
    retrySync,
    updateInviteDuration
  };
}
