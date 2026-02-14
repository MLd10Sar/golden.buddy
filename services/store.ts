
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Session, Invite, View, AreaId, Interest, AccessibilitySettings, InviteStatus } from '../types';
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

// RELAY CONFIG: Using a fresh, unique token to avoid data collisions
const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'gb_v120_stable_sync'; 

const encodeData = (obj: any) => {
  try {
    const str = JSON.stringify(obj);
    return btoa(encodeURIComponent(str)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    return "";
  }
};

const decodeData = (base64: string) => {
  try {
    if (!base64 || base64 === "null") return null;
    const clean = base64.trim().replace(/^"(.*)"$/, '$1').replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(clean)));
  } catch (e) {
    return null;
  }
};

/**
 * Robust fetch with a timeout to prevent the app from hanging
 */
async function safeFetch(url: string, options: RequestInit = {}, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      mode: 'cors',
      cache: 'no-store'
    });
    clearTimeout(id);
    if (!response.ok) throw new Error(`Server Error: ${response.status}`);
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
      } catch (e) {
        return initialState;
      }
    }
    return initialState;
  });

  const [remotePeers, setRemotePeers] = useState<Session[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<number>(Date.now());
  const isSyncing = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const sync = useCallback(async () => {
    if (!state.currentSession || isSyncing.current) return;
    isSyncing.current = true;

    try {
      const myId = state.currentSession.id;
      const myArea = state.currentSession.areaId;

      // 1. Presence (Heartbeat) - Post my current profile
      const myProfile = encodeData({ ...state.currentSession, lastSeenAt: Date.now() });
      await safeFetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/u_${myId}/${myProfile}`, { method: 'POST' });

      // 2. Directory Management - Ensure I am in the area list
      const dirRes = await safeFetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/d_${myArea}`);
      const dirRaw = await dirRes.text();
      let directory = JSON.parse(dirRaw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      
      if (!directory.includes(myId)) {
        directory = [...directory, myId].slice(-10); // Keep directory very small for stability
        await safeFetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/d_${myArea}/${encodeURIComponent(JSON.stringify(directory))}`, { method: 'POST' });
      }

      // 3. Neighbor Refresh - Find others in my area
      const activePeers: Session[] = [];
      for (const id of directory) {
        if (id === myId) continue;
        try {
          const r = await safeFetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/u_${id}`);
          const t = await r.text();
          const p = decodeData(t);
          if (p && (Date.now() - p.lastSeenAt < 90000)) {
            activePeers.push(p);
          }
        } catch (e) { /* Skip failed peer fetch */ }
      }
      setRemotePeers(activePeers);

      // 4. Inbox Sync - Check for new invites
      const inboxRes = await safeFetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${myId}`);
      const inboxRaw = await inboxRes.text();
      const incoming = JSON.parse(inboxRaw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]") as Invite[];
      
      if (incoming.length > 0) {
        setState(prev => {
          let updated = false;
          const currentInvites = [...prev.invites];
          incoming.forEach(inc => {
            if (!currentInvites.some(ex => ex.id === inc.id)) {
              currentInvites.push(inc);
              updated = true;
            }
          });
          return updated ? { ...prev, invites: currentInvites } : prev;
        });
      }

      // 5. Response Handshake - Check if my sent invites were accepted
      const pendingOut = state.invites.filter(i => i.fromSessionId === myId && i.status === 'PENDING');
      for (const inv of pendingOut) {
        try {
          const vRes = await safeFetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/v_${inv.id}`);
          const vText = await vRes.text();
          const resp = decodeData(vText);
          if (resp && resp.status !== 'PENDING') {
            setState(prev => ({
              ...prev,
              invites: prev.invites.map(i => i.id === inv.id ? resp : i)
            }));
          }
        } catch (e) {}
      }

      setSyncError(null);
      setLastSync(Date.now());
    } catch (e: any) {
      console.error("Sync Error:", e);
      setSyncError("Connection low. Retrying...");
    } finally {
      isSyncing.current = false;
    }
  }, [state.currentSession, state.invites]);

  useEffect(() => {
    if (!state.currentSession) return;
    const interval = setInterval(sync, 10000); // Increased to 10s to stay under rate limits
    sync(); // Initial sync
    return () => clearInterval(interval);
  }, [state.currentSession, sync]);

  const createSession = (name: string, areaId: AreaId, interests: Interest[]) => {
    const s: Session = {
      id: Math.random().toString(36).substr(2, 6),
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
      inbox = [...inbox, invite].slice(-5);
      await safeFetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/i_${toId}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
    } catch (e) {
      setSyncError("Failed to send invite. Check connection.");
    }
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
        spotData = JSON.stringify({ 
          name: "Local Public Library", 
          reason: "Safe and public place for meeting.", 
          hours: "Check local hours", 
          directions: "Meet inside the main lobby." 
        });
      }
    }

    const updated: Invite = { 
      ...invite, 
      status: action, 
      aiSuggestedSpot: spotData,
      respondedAt: Date.now() 
    };

    setState(prev => ({
      ...prev,
      invites: prev.invites.map(i => i.id === inviteId ? updated : i)
    }));

    try {
      await safeFetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/v_${inviteId}/${encodeData(updated)}`, { method: 'POST' });
      const res = await safeFetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${state.currentSession.id}`);
      let inbox = JSON.parse((await res.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]") as Invite[];
      inbox = inbox.filter(i => i.id !== inviteId);
      await safeFetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/i_${state.currentSession.id}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
    } catch (e) {
      setSyncError("Failed to respond. Retrying...");
    }
  };

  const updateAccessibility = (settings: Partial<AccessibilitySettings>) => {
    setState(prev => {
      if (!prev.currentSession) return prev;
      return {
        ...prev,
        currentSession: {
          ...prev.currentSession,
          accessibility: { ...prev.currentSession.accessibility, ...settings }
        }
      };
    });
  };

  const updateInviteDuration = (durationMs: number) => {
    setState(prev => {
      if (!prev.currentSession) return prev;
      return {
        ...prev,
        currentSession: {
          ...prev.currentSession,
          inviteDuration: durationMs
        }
      };
    });
  };

  const updateInviteNote = (inviteId: string, note: string) => {
    setState(prev => ({
      ...prev,
      invites: prev.invites.map(i => i.id === inviteId ? { ...i, coordinationNote: note } : i)
    }));
  };

  return {
    state, remotePeers, syncError, lastSync,
    setView: (v: View) => setState(prev => ({ ...prev, currentView: v })),
    createSession, sendInvite, respondToInvite,
    updateInviteNote,
    resetApp: () => { localStorage.clear(); window.location.reload(); },
    updateAccessibility,
    updateInviteDuration,
    retrySync: sync
  };
}
