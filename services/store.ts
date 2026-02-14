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

// RELAY CONFIG: Using a shorter, isolated token
const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'gb_v125_prod'; 

/**
 * Minifies session data for the discovery "heartbeat" to keep URLs short.
 */
const minifyDiscovery = (session: Session) => {
  return {
    id: session.id,
    n: session.displayName,
    a: session.areaId,
    i: session.interests,
    ls: Date.now()
  };
};

const encodeData = (obj: any) => {
  try {
    const str = JSON.stringify(obj);
    return btoa(encodeURIComponent(str)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) { return ""; }
};

const decodeData = (base64: string) => {
  try {
    if (!base64 || base64 === "null" || base64 === "") return null;
    const clean = base64.trim().replace(/^"(.*)"$/, '$1').replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(clean)));
  } catch (e) { return null; }
};

async function safeFetch(url: string, options: RequestInit = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...options.headers }
    });
    clearTimeout(id);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } catch (e) {
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
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<number>(Date.now());
  const [syncCount, setSyncCount] = useState(0);
  const isSyncing = useRef(false);
  const consecutiveErrors = useRef(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const sync = useCallback(async () => {
    if (!state.currentSession || isSyncing.current) return;
    isSyncing.current = true;

    try {
      const myId = state.currentSession.id;
      const myArea = state.currentSession.areaId;

      // 1. Heartbeat - Push minimal discovery packet
      const myPacket = encodeData(minifyDiscovery(state.currentSession));
      await safeFetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/u_${myId}/${myPacket}`, { method: 'POST' });

      // 2. Directory Management - Find neighbors
      const dirRes = await safeFetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/d_${myArea}`);
      const dirRaw = await dirRes.text();
      let directory = JSON.parse(dirRaw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      
      if (!directory.includes(myId)) {
        directory = [...directory, myId].slice(-8); // Very small directory limit
        await safeFetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/d_${myArea}/${encodeURIComponent(JSON.stringify(directory))}`, { method: 'POST' });
      }

      // 3. Refresh Active Peers
      const activePeers: Session[] = [];
      for (const id of directory) {
        if (id === myId) continue;
        try {
          const r = await safeFetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/u_${id}`);
          const pData = decodeData(await r.text());
          if (pData && (Date.now() - pData.ls < 120000)) {
            activePeers.push({
              id: pData.id,
              displayName: pData.n,
              areaId: pData.a,
              interests: pData.i,
              createdAt: 0, lastSeenAt: pData.ls,
              accessibility: DEFAULT_ACCESSIBILITY,
              inviteDuration: INVITE_DURATION_MS
            });
          }
        } catch (e) { /* ignore single peer failure */ }
      }
      setRemotePeers(activePeers);

      // 4. Inbox Check
      const inboxRes = await safeFetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${myId}`);
      const incoming = JSON.parse((await inboxRes.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]") as Invite[];
      if (incoming.length > 0) {
        setState(prev => {
          const newInvites = [...prev.invites];
          let updated = false;
          incoming.forEach(inc => {
            if (!newInvites.find(ex => ex.id === inc.id)) {
              newInvites.push(inc);
              updated = true;
            }
          });
          return updated ? { ...prev, invites: newInvites } : prev;
        });
      }

      // 5. Verification Check (Handshake Response)
      const pendingOut = state.invites.filter(i => i.fromSessionId === myId && i.status === 'PENDING');
      for (const inv of pendingOut) {
        try {
          const vRes = await safeFetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/v_${inv.id}`);
          const resp = decodeData(await vRes.text());
          if (resp && resp.status !== 'PENDING') {
            setState(prev => ({ ...prev, invites: prev.invites.map(i => i.id === inv.id ? resp : i) }));
          }
        } catch (e) {}
      }

      setSyncError(null);
      setLastSync(Date.now());
      setSyncCount(c => c + 1);
      consecutiveErrors.current = 0;
    } catch (e: any) {
      console.warn("Sync Issue:", e.message);
      consecutiveErrors.current++;
      if (consecutiveErrors.current > 2) {
        setSyncError("Connecting... Neighbors might be quiet.");
      }
    } finally {
      isSyncing.current = false;
    }
  }, [state.currentSession, state.invites]);

  useEffect(() => {
    if (!state.currentSession) return;
    const intervalTime = Math.min(10000 + (consecutiveErrors.current * 5000), 60000);
    const timer = setInterval(sync, intervalTime);
    sync();
    return () => clearInterval(timer);
  }, [state.currentSession, sync]);

  const createSession = (name: string, areaId: AreaId, interests: Interest[]) => {
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
      const res = await safeFetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${toId}`);
      let inbox = JSON.parse((await res.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      inbox = [...inbox, invite].slice(-3);
      await safeFetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/i_${toId}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
    } catch (e) {}
  };

  const respondToInvite = async (inviteId: string, action: 'ACCEPTED' | 'DECLINED') => {
    const invite = state.invites.find(i => i.id === inviteId);
    if (!invite || !state.currentSession) return;
    
    let spotData = "";
    if (action === 'ACCEPTED') {
      const area = AREAS.find(a => a.id === state.currentSession?.areaId)?.name || 'local area';
      try {
        const spot = await getSmartMeetingSpot(area, invite.activity);
        spotData = JSON.stringify(spot);
      } catch (e) {
        spotData = JSON.stringify({ name: "Local Public Library", reason: "Safe, public, and central.", hours: "Daylight Hours", directions: "Meet near the front reception." });
      }
    }

    const updated: Invite = { ...invite, status: action, aiSuggestedSpot: spotData, respondedAt: Date.now() };
    setState(prev => ({ ...prev, invites: prev.invites.map(i => i.id === inviteId ? updated : i) }));

    try {
      await safeFetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/v_${inviteId}/${encodeData(updated)}`, { method: 'POST' });
      const res = await safeFetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${state.currentSession.id}`);
      let inbox = JSON.parse((await res.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]") as Invite[];
      await safeFetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/i_${state.currentSession.id}/${encodeURIComponent(JSON.stringify(inbox.filter(i => i.id !== inviteId)))}`, { method: 'POST' });
    } catch (e) {}
  };

  // Fixed: Added missing updateInviteNote function
  const updateInviteNote = (inviteId: string, note: string) => {
    setState(prev => ({
      ...prev,
      invites: prev.invites.map(i => i.id === inviteId ? { ...i, coordinationNote: note } : i)
    }));
  };

  // Fixed: Added missing updateInviteDuration function
  const updateInviteDuration = (durationMs: number) => {
    setState(prev => {
      if (!prev.currentSession) return prev;
      return { ...prev, currentSession: { ...prev.currentSession, inviteDuration: durationMs } };
    });
  };

  const updateAccessibility = (settings: Partial<AccessibilitySettings>) => {
    setState(prev => {
      if (!prev.currentSession) return prev;
      return { ...prev, currentSession: { ...prev.currentSession, accessibility: { ...prev.currentSession.accessibility, ...settings } } };
    });
  };

  return {
    state, remotePeers, syncError, lastSync,
    setView: (v: View) => setState(prev => ({ ...prev, currentView: v })),
    createSession, sendInvite, respondToInvite,
    updateInviteNote,
    updateInviteDuration,
    resetApp: () => { localStorage.clear(); window.location.reload(); },
    updateAccessibility,
    retrySync: sync
  };
}
