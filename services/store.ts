
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Session, Invite, View, AreaId, Interest, AccessibilitySettings } from '../types';
import { STORAGE_KEY, INVITE_DURATION_MS } from '../constants';
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

const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'gb_live_v100_ultra'; // New token to clear old state

const safeEncode = (obj: any) => {
  try {
    return btoa(encodeURIComponent(JSON.stringify(obj)));
  } catch (e) { return ""; }
};

const safeDecode = (base64: string) => {
  try {
    if (!base64 || base64 === "null") return null;
    return JSON.parse(decodeURIComponent(atob(base64.replace(/^"(.*)"$/, '$1'))));
  } catch (e) { return null; }
};

export function useGoldenBuddyStore() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<AppState>;
        return { ...initialState, ...parsed, currentView: 'WELCOME' } as AppState;
      } catch (e) { return initialState; }
    }
    return initialState;
  });

  const [remotePeers, setRemotePeers] = useState<Session[]>([]);
  const isSyncing = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const broadcastPresence = useCallback(async () => {
    if (!state.currentSession) return;
    try {
      const data = safeEncode({ ...state.currentSession, lastSeenAt: Date.now() });
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/s_${state.currentSession.id}/${data}`, { method: 'POST' });
      
      // Update the area directory every few pulses
      const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/d_${state.currentSession.areaId}`);
      const raw = await res.text();
      let dir = JSON.parse(raw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      if (!dir.includes(state.currentSession.id)) {
        dir = [...dir, state.currentSession.id].slice(-20);
        await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/d_${state.currentSession.areaId}/${encodeURIComponent(JSON.stringify(dir))}`, { method: 'POST' });
      }
    } catch (e) {}
  }, [state.currentSession]);

  const syncRemoteData = useCallback(async () => {
    if (!state.currentSession || isSyncing.current) return;
    isSyncing.current = true;
    try {
      // 1. Neighbors
      const dirRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/d_${state.currentSession.areaId}`);
      const dirRaw = await dirRes.text();
      const ids = JSON.parse(dirRaw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      
      const peerPromises = ids.filter((id: string) => id !== state.currentSession?.id).map(async (id: string) => {
        const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/s_${id}`);
        const raw = await res.text();
        return safeDecode(raw.trim());
      });
      const peers = (await Promise.all(peerPromises)).filter(p => p && (Date.now() - p.lastSeenAt < 30000)) as Session[];
      setRemotePeers(peers);

      // 2. Outgoing Invites Status (Is my friend responding?)
      const outgoingPending = state.invites.filter(i => i.fromSessionId === state.currentSession?.id && i.status === 'PENDING');
      for (const out of outgoingPending) {
        const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/v_${out.id}`);
        const raw = await res.text();
        const responseData = safeDecode(raw.trim());
        if (responseData && responseData.status !== 'PENDING') {
           setState(prev => ({
             ...prev,
             invites: prev.invites.map(i => i.id === out.id ? { ...i, ...responseData, respondedAt: Date.now() } : i)
           }));
        }
      }

      // 3. Incoming Invites (My Inbox)
      const inboxRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${state.currentSession.id}`);
      const inboxRaw = await inboxRes.text();
      const incoming = JSON.parse(inboxRaw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]") as Invite[];
      if (incoming.length > 0) {
        setState(prev => {
          const updated = [...prev.invites];
          let changed = false;
          incoming.forEach(inc => {
            if (!updated.some(ex => ex.id === inc.id)) {
              updated.push(inc);
              changed = true;
            }
          });
          return changed ? { ...prev, invites: updated } : prev;
        });
      }
    } catch (e) {} finally { isSyncing.current = false; }
  }, [state.currentSession, state.invites]);

  useEffect(() => {
    if (!state.currentSession) return;
    // HIGH FREQUENCY POLLING FOR REAL-TIME FEEL
    const interval = setInterval(() => { broadcastPresence(); syncRemoteData(); }, 3000);
    return () => clearInterval(interval);
  }, [state.currentSession, broadcastPresence, syncRemoteData]);

  const createSession = (name: string, areaId: AreaId, interests: Interest[]) => {
    const newSession: Session = {
      id: Math.random().toString(36).substr(2, 6),
      displayName: name,
      areaId,
      interests,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      accessibility: DEFAULT_ACCESSIBILITY,
      inviteDuration: INVITE_DURATION_MS,
    };
    setState(prev => ({ ...prev, currentSession: newSession, currentView: 'DASHBOARD' }));
  };

  const sendInvite = async (toId: string, activity: Interest) => {
    if (!state.currentSession) return;
    const newInvite: Invite = {
      id: Math.random().toString(36).substr(2, 6),
      fromSessionId: state.currentSession.id,
      toSessionId: toId,
      activity,
      status: 'PENDING',
      createdAt: Date.now(),
      expiresAt: Date.now() + (state.currentSession.inviteDuration || INVITE_DURATION_MS),
    };
    setState(prev => ({ ...prev, invites: [...prev.invites, newInvite] }));
    try {
      const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${toId}`);
      const raw = await res.text();
      let inbox = JSON.parse(raw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      inbox = [...inbox, newInvite].slice(-5);
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/i_${toId}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
    } catch (e) {}
  };

  const respondToInvite = async (inviteId: string, action: 'ACCEPTED' | 'DECLINED', note?: string) => {
    const invite = state.invites.find(i => i.id === inviteId);
    if (!invite) return;
    
    let spotText = "";
    if (action === 'ACCEPTED' && state.currentSession) {
      const areaName = state.currentSession.areaId.replace('_', ' ');
      const spot = await getSmartMeetingSpot(areaName, invite.activity);
      if (spot) spotText = `Meet at: ${spot.name}. Location safe? ${spot.reason}`;
    }

    const updated = { ...invite, status: action, coordinationNote: note, aiSuggestedSpot: spotText, respondedAt: Date.now() };
    setState(prev => ({ ...prev, invites: prev.invites.map(inv => inv.id === inviteId ? updated : inv) }));
    
    try {
      // Notify sender
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/v_${inviteId}/${safeEncode(updated)}`, { method: 'POST' });
      // Clear receiver inbox
      const inboxRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${state.currentSession?.id}`);
      const inboxRaw = await inboxRes.text();
      let inbox = JSON.parse(inboxRaw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]") as Invite[];
      inbox = inbox.filter(i => i.id !== inviteId);
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/i_${state.currentSession?.id}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
    } catch (e) {}
  };

  const resetApp = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState);
    setRemotePeers([]);
    window.location.reload();
  };

  return { 
    state, remotePeers, 
    setView: (view: View) => setState(prev => ({...prev, currentView: view})), 
    createSession, sendInvite, respondToInvite, resetApp,
    updateAccessibility: (s: Partial<AccessibilitySettings>) => setState(p => p.currentSession ? ({...p, currentSession: {...p.currentSession, accessibility: {...p.currentSession.accessibility, ...s}}}) : p),
    updateInviteDuration: (d: number) => setState(p => p.currentSession ? ({...p, currentSession: {...p.currentSession, inviteDuration: d}}) : p)
  };
}
