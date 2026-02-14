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
const APP_TOKEN = 'gb_v_ultra_stable_888'; // BRAND NEW TOKEN FOR FRESH START

const encode = (obj: any) => {
  try { return btoa(encodeURIComponent(JSON.stringify(obj))); } 
  catch (e) { return ""; }
};

const decode = (base64: string) => {
  try {
    if (!base64 || base64 === "null" || base64.length < 5) return null;
    const clean = base64.trim().replace(/^"(.*)"$/, '$1');
    return JSON.parse(decodeURIComponent(atob(clean)));
  } catch (e) { return null; }
};

export function useGoldenBuddyStore() {
  const [state, setState] = useState<AppState>(() => {
    // Force reset old storage keys if they exist
    localStorage.removeItem('goldenbuddy_v2_state');
    const saved = localStorage.getItem('gb_v_ultra_final_key');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...initialState, ...parsed, currentView: 'WELCOME' };
      } catch (e) { return initialState; }
    }
    return initialState;
  });

  const [remotePeers, setRemotePeers] = useState<Session[]>([]);
  const syncBusy = useRef(false);

  useEffect(() => {
    localStorage.setItem('gb_v_ultra_final_key', JSON.stringify(state));
  }, [state]);

  const sync = useCallback(async () => {
    if (!state.currentSession || syncBusy.current) return;
    syncBusy.current = true;
    try {
      // 1. I am here
      const me = encode({ ...state.currentSession, lastSeenAt: Date.now() });
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/u_${state.currentSession.id}/${me}`, { method: 'POST' });
      
      // 2. Refresh directory
      const dirRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/dir_${state.currentSession.areaId}`);
      let dir = JSON.parse((await dirRes.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      if (!dir.includes(state.currentSession.id)) {
        dir = [...dir, state.currentSession.id].slice(-15);
        await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/dir_${state.currentSession.areaId}/${encodeURIComponent(JSON.stringify(dir))}`, { method: 'POST' });
      }

      // 3. Peers status
      const peerData = await Promise.all(dir.filter((id: string) => id !== state.currentSession?.id).map(async (id: string) => {
        const r = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/u_${id}`);
        return decode(await r.text());
      }));
      setRemotePeers(peerData.filter(p => p && (Date.now() - p.lastSeenAt < 35000)));

      // 4. HANDSHAKE: INCOMING
      const inboxRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/in_${state.currentSession.id}`);
      const incoming = JSON.parse((await inboxRes.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]") as Invite[];
      if (incoming.length > 0) {
        setState(prev => {
          const updated = [...prev.invites];
          let changed = false;
          incoming.forEach(inc => {
            if (!updated.some(ex => ex.id === inc.id)) { updated.push(inc); changed = true; }
          });
          return changed ? { ...prev, invites: updated } : prev;
        });
      }

      // 5. HANDSHAKE: OUTGOING WATCHER
      const pendingOut = state.invites.filter(i => i.fromSessionId === state.currentSession?.id && i.status === 'PENDING');
      for (const inv of pendingOut) {
        const vRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/v_${inv.id}`);
        const vData = decode(await vRes.text());
        if (vData && vData.status !== 'PENDING') {
          setState(prev => ({
            ...prev,
            invites: prev.invites.map(i => i.id === inv.id ? vData : i)
          }));
        }
      }
    } catch (e) {} finally { syncBusy.current = false; }
  }, [state.currentSession, state.invites]);

  useEffect(() => {
    if (!state.currentSession) return;
    const interval = setInterval(sync, 2500); // Poll every 2.5s for responsiveness
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
      const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/in_${toId}`);
      let inbox = JSON.parse((await res.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      inbox = [...inbox, invite].slice(-3);
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/in_${toId}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
    } catch (e) {}
  };

  const respondToInvite = async (inviteId: string, action: 'ACCEPTED' | 'DECLINED') => {
    const invite = state.invites.find(i => i.id === inviteId);
    if (!invite || !state.currentSession) return;
    
    let spotInfo = "";
    if (action === 'ACCEPTED') {
      const spot = await getSmartMeetingSpot(state.currentSession.areaId.replace('_', ' '), invite.activity);
      spotInfo = `Safe Spot: ${spot.name}. Reason: ${spot.reason}`;
    }

    const updated = { ...invite, status: action, aiSuggestedSpot: spotInfo, respondedAt: Date.now() };
    setState(prev => ({ ...prev, invites: prev.invites.map(i => i.id === inviteId ? updated : i) }));

    try {
      // 1. Inform the sender
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/v_${inviteId}/${encode(updated)}`, { method: 'POST' });
      // 2. Clear my inbox
      const inboxRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/in_${state.currentSession.id}`);
      let inbox = JSON.parse((await inboxRes.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]") as Invite[];
      inbox = inbox.filter(i => i.id !== inviteId);
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/in_${state.currentSession.id}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
    } catch (e) {}
  };

  return {
    state, remotePeers,
    setView: (v: View) => setState(prev => ({ ...prev, currentView: v })),
    createSession, sendInvite, respondToInvite,
    resetApp: () => { localStorage.clear(); window.location.reload(); }
  };
}
