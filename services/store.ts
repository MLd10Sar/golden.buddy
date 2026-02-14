
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
const APP_TOKEN = 'gb_v77_pro_stable';

const safeEncode = (obj: any) => {
  try {
    return btoa(encodeURIComponent(JSON.stringify(obj)));
  } catch (e) { return ""; }
};

const safeDecode = (base64: string) => {
  try {
    if (!base64 || base64 === "null") return null;
    return JSON.parse(decodeURIComponent(atob(base64)));
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
      const sessionData = safeEncode({ ...state.currentSession, lastSeenAt: Date.now() });
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/s_${state.currentSession.id}/${sessionData}`, { method: 'POST' });
      
      const dirRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/d_${state.currentSession.areaId}`);
      const dirRaw = await dirRes.text();
      let directory = JSON.parse(dirRaw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      if (!directory.includes(state.currentSession.id)) {
        directory = [...directory, state.currentSession.id].slice(-25);
        await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/d_${state.currentSession.areaId}/${encodeURIComponent(JSON.stringify(directory))}`, { method: 'POST' });
      }
    } catch (e) {}
  }, [state.currentSession]);

  const syncRemoteData = useCallback(async () => {
    if (!state.currentSession || isSyncing.current) return;
    isSyncing.current = true;
    try {
      // 1. Fetch Neighbor IDs
      const dirRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/d_${state.currentSession.areaId}`);
      const dirRaw = await dirRes.text();
      const ids = JSON.parse(dirRaw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      
      // 2. Resolve Neighbor Data
      const peerPromises = ids.filter((id: string) => id !== state.currentSession?.id).map(async (id: string) => {
        const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/s_${id}`);
        const raw = await res.text();
        return safeDecode(raw.trim().replace(/^"(.*)"$/, '$1'));
      });
      const peers = (await Promise.all(peerPromises)).filter(p => p && (Date.now() - p.lastSeenAt < 45000)) as Session[];
      setRemotePeers(peers);

      // 3. Sync Outgoing Invites (Did they accept?)
      const outgoingPending = state.invites.filter(i => i.fromSessionId === state.currentSession?.id && i.status === 'PENDING');
      for (const out of outgoingPending) {
        const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/v_${out.id}`);
        const text = await res.text();
        const responseData = safeDecode(text.trim().replace(/^"(.*)"$/, '$1'));
        if (responseData && responseData.status !== 'PENDING') {
           setState(prev => ({
             ...prev,
             invites: prev.invites.map(i => i.id === out.id ? { ...i, ...responseData } : i)
           }));
        }
      }

      // 4. Sync Incoming Invites (Inbox)
      const inboxRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${state.currentSession.id}`);
      const inboxRaw = await inboxRes.text();
      const incoming = JSON.parse(inboxRaw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]") as Invite[];
      if (incoming.length > 0) {
        setState(prev => {
          const updatedInvites = [...prev.invites];
          incoming.forEach(inc => {
            if (!updatedInvites.some(existing => existing.id === inc.id)) updatedInvites.push(inc);
          });
          return { ...prev, invites: updatedInvites };
        });
      }
    } catch (e) {} finally { isSyncing.current = false; }
  }, [state.currentSession, state.invites]);

  useEffect(() => {
    if (!state.currentSession) return;
    const interval = setInterval(() => { broadcastPresence(); syncRemoteData(); }, 5000);
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
      if (spot) spotText = `AI Recommendation: ${spot.name}. ${spot.reason}`;
    }

    const updated = { ...invite, status: action, coordinationNote: note, aiSuggestedSpot: spotText, respondedAt: Date.now() };
    setState(prev => ({ ...prev, invites: prev.invites.map(inv => inv.id === inviteId ? updated : inv) }));
    
    try {
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/v_${inviteId}/${safeEncode(updated)}`, { method: 'POST' });
      // Clear from local inbox immediately after responding
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
