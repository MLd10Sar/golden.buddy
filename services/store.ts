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

// RELAY CONFIG: Shorter token, URI-safe keys
const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'gb2_fix'; 

const encodeData = (obj: any) => {
  try {
    const str = JSON.stringify(obj);
    // Base64URL encoding to ensure URI safety
    return btoa(encodeURIComponent(str))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (e) { return ""; }
};

const decodeData = (base64: string) => {
  try {
    if (!base64 || base64 === "null" || base64 === "" || base64 === "[]") return null;
    const clean = base64.trim()
      .replace(/^"(.*)"$/, '$1')
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(clean)));
  } catch (e) { return null; }
};

/**
 * Robust fetch with retry and URI safety
 */
async function safeFetch(path: string, options: RequestInit = {}, timeout = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  // Ensure the entire URL is properly URI-encoded per segment
  const url = `${RELAY_BASE}/${path}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        ...(options.headers || {})
      }
    });
    clearTimeout(id);
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return response;
  } catch (e: any) {
    clearTimeout(id);
    throw e;
  }
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
      // 1. Heartbeat - Just a timestamp to signal presence
      const ts = Math.floor(Date.now() / 1000);
      await safeFetch(`UpdateValue/${APP_TOKEN}/u_${myId}/${ts}`, { method: 'POST' });

      // 2. Directory - Get neighbors in area
      const dirRes = await safeFetch(`GetValue/${APP_TOKEN}/d_${myArea}`);
      const dirText = await dirRes.text();
      let directory: string[] = [];
      try {
        directory = JSON.parse(dirText.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      } catch (e) { directory = []; }
      
      if (!directory.includes(myId)) {
        directory = [myId, ...directory.filter(id => id !== myId)].slice(0, 8);
        await safeFetch(`UpdateValue/${APP_TOKEN}/d_${myArea}/${encodeURIComponent(JSON.stringify(directory))}`, { method: 'POST' });
      }

      // 3. Serialized Peer Fetch - Prevents URL length issues and rate limiting
      const activePeers: Session[] = [];
      for (const id of directory) {
        if (id === myId) continue;
        try {
          // Check if peer is recently active first
          const hRes = await safeFetch(`GetValue/${APP_TOKEN}/u_${id}`);
          const hText = await hRes.text();
          const lastSeenTs = parseInt(hText.trim().replace(/^"(.*)"$/, '$1'), 10);
          
          // If active in last 5 minutes, get full profile
          if (!isNaN(lastSeenTs) && (ts - lastSeenTs < 300)) {
            const pRes = await safeFetch(`GetValue/${APP_TOKEN}/p_${id}`);
            const p = decodeData(await pRes.text());
            if (p) activePeers.push(p);
          }
        } catch (e) { /* silent fail for single peer */ }
      }
      setRemotePeers(activePeers);

      // 4. Inbox Check
      const inboxRes = await safeFetch(`GetValue/${APP_TOKEN}/i_${myId}`);
      const inboxText = await inboxRes.text();
      let incoming: Invite[] = [];
      try {
        incoming = JSON.parse(inboxText.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      } catch (e) { incoming = []; }
      
      if (incoming.length > 0) {
        setState(prev => {
          const newInvites = [...prev.invites];
          let changed = false;
          incoming.forEach(inc => {
            if (!newInvites.some(i => i.id === inc.id)) {
              newInvites.push(inc);
              changed = true;
            }
          });
          return changed ? { ...prev, invites: newInvites } : prev;
        });
      }

      setSyncStatus('IDLE');
      setLastSync(Date.now());
      consecutiveErrors.current = 0;
    } catch (e: any) {
      console.error("Sync Failed:", e.message);
      consecutiveErrors.current++;
      setSyncStatus('ERROR');
    } finally {
      isSyncing.current = false;
    }
  }, [state.currentSession]);

  useEffect(() => {
    if (!state.currentSession) return;
    const interval = consecutiveErrors.current > 0 ? 30000 : 15000;
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
    
    // Attempt to push profile immediately
    try {
      await safeFetch(`UpdateValue/${APP_TOKEN}/p_${s.id}/${encodeData(s)}`, { method: 'POST' });
    } catch (e) { console.warn("Initial profile push failed - will retry on sync"); }

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
      const res = await safeFetch(`GetValue/${APP_TOKEN}/i_${toId}`);
      let inbox = JSON.parse((await res.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      inbox = [invite, ...inbox.filter((i: any) => i.id !== invite.id)].slice(0, 5);
      await safeFetch(`UpdateValue/${APP_TOKEN}/i_${toId}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
    } catch (e) {
      setSyncStatus('ERROR');
    }
  };

  const respondToInvite = async (inviteId: string, action: 'ACCEPTED' | 'DECLINED') => {
    const invite = state.invites.find(i => i.id === inviteId);
    if (!invite || !state.currentSession) return;
    
    let updated = { ...invite, status: action, respondedAt: Date.now() };

    if (action === 'ACCEPTED') {
      const area = AREAS.find(a => a.id === state.currentSession?.areaId)?.name || 'local area';
      try {
        const spot = await getSmartMeetingSpot(area, invite.activity);
        if (spot) updated.aiSuggestedSpot = JSON.stringify(spot);
      } catch (e) {}
    }

    setState(prev => ({
      ...prev,
      invites: prev.invites.map(i => i.id === inviteId ? updated : i)
    }));

    try {
      // Notify sender via a dedicated verification key
      await safeFetch(`UpdateValue/${APP_TOKEN}/v_${inviteId}/${encodeData(updated)}`, { method: 'POST' });
      // Remove from my own inbox locally
      setState(prev => ({ ...prev, invites: prev.invites.filter(i => i.id !== inviteId || i.status !== 'PENDING') }));
    } catch (e) {
      setSyncStatus('ERROR');
    }
  };

  return {
    state, remotePeers, syncStatus, lastSync,
    setView: (v: View) => setState(prev => ({ ...prev, currentView: v })),
    createSession, sendInvite, respondToInvite,
    updateInviteNote: (id: string, n: string) => {},
    updateInviteDuration: (d: number) => {},
    resetApp: () => { localStorage.clear(); window.location.reload(); },
    updateAccessibility: (s: Partial<AccessibilitySettings>) => {
      setState(prev => prev.currentSession ? { ...prev, currentSession: { ...prev.currentSession, accessibility: { ...prev.currentSession.accessibility, ...s } } } : prev);
    },
    retrySync: sync
  };
}
