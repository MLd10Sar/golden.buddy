
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

// RELAY CONFIG
const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'gb_v5_final_fix'; // Fresh token to force clear all sessions

const encodeData = (obj: any) => {
  try {
    return btoa(encodeURIComponent(JSON.stringify(obj)));
  } catch (e) { return ""; }
};

const decodeData = (base64: string) => {
  try {
    if (!base64 || base64 === "null" || base64.length < 5) return null;
    // Clean potential quotes from API response
    const clean = base64.trim().replace(/^"(.*)"$/, '$1');
    return JSON.parse(decodeURIComponent(atob(clean)));
  } catch (e) { return null; }
};

export function useGoldenBuddyStore() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...initialState, ...parsed, currentView: 'WELCOME' };
      } catch (e) { return initialState; }
    }
    return initialState;
  });

  const [remotePeers, setRemotePeers] = useState<Session[]>([]);
  const syncRef = useRef(false);

  // Persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const sync = useCallback(async () => {
    if (!state.currentSession || syncRef.current) return;
    syncRef.current = true;
    try {
      // 1. Broadcast presence
      const myData = encodeData({ ...state.currentSession, lastSeenAt: Date.now() });
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/u_${state.currentSession.id}/${myData}`, { method: 'POST' });
      
      // 2. Update Directory (Who is in my area?)
      const dirRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/d_${state.currentSession.areaId}`);
      const dirText = await dirRes.text();
      let dir = JSON.parse(dirText.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      if (!dir.includes(state.currentSession.id)) {
        dir = [...dir, state.currentSession.id].slice(-20);
        await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/d_${state.currentSession.areaId}/${encodeURIComponent(JSON.stringify(dir))}`, { method: 'POST' });
      }

      // 3. Fetch Peers
      const peerPromises = dir.filter((id: string) => id !== state.currentSession?.id).map(async (id: string) => {
        const r = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/u_${id}`);
        return decodeData(await r.text());
      });
      const peers = (await Promise.all(peerPromises)).filter(p => p && (Date.now() - p.lastSeenAt < 40000)) as Session[];
      setRemotePeers(peers);

      // 4. CHECK INBOX (Incoming Invites)
      const inboxRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${state.currentSession.id}`);
      const inboxRaw = await inboxRes.text();
      const incoming = JSON.parse(inboxRaw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]") as Invite[];
      if (incoming.length > 0) {
        setState(prev => {
          const updated = [...prev.invites];
          let added = false;
          incoming.forEach(inc => {
            if (!updated.some(ex => ex.id === inc.id)) {
              updated.push(inc);
              added = true;
            }
          });
          return added ? { ...prev, invites: updated } : prev;
        });
      }

      // 5. CHECK OUTGOING (Did they accept?)
      const pendingOut = state.invites.filter(i => i.fromSessionId === state.currentSession?.id && i.status === 'PENDING');
      for (const inv of pendingOut) {
        const vRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/v_${inv.id}`);
        const vData = decodeData(await vRes.text());
        if (vData && vData.status !== 'PENDING') {
          setState(prev => ({
            ...prev,
            invites: prev.invites.map(i => i.id === inv.id ? vData : i)
          }));
        }
      }
    } catch (e) {
      console.error("Sync Error:", e);
    } finally {
      syncRef.current = false;
    }
  }, [state.currentSession, state.invites]);

  useEffect(() => {
    if (!state.currentSession) return;
    const timer = setInterval(sync, 2500); // Fast sync for real-time feel
    return () => clearInterval(timer);
  }, [state.currentSession, sync]);

  const createSession = (name: string, areaId: AreaId, interests: Interest[]) => {
    const session: Session = {
      id: Math.random().toString(36).substr(2, 6),
      displayName: name,
      areaId,
      interests,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      accessibility: DEFAULT_ACCESSIBILITY,
      inviteDuration: INVITE_DURATION_MS,
    };
    setState(prev => ({ ...prev, currentSession: session, currentView: 'DASHBOARD' }));
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
    
    // 1. Update local state
    setState(prev => ({ ...prev, invites: [...prev.invites, invite] }));
    
    // 2. Push to recipient inbox
    try {
      const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${toId}`);
      let inbox = JSON.parse((await res.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      inbox = [...inbox, invite].slice(-5);
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/i_${toId}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
    } catch (e) {}
  };

  const respondToInvite = async (inviteId: string, action: 'ACCEPTED' | 'DECLINED') => {
    const invite = state.invites.find(i => i.id === inviteId);
    if (!invite || !state.currentSession) return;
    
    let aiSpot = "";
    if (action === 'ACCEPTED') {
      const area = state.currentSession.areaId.replace('_', ' ');
      const spot = await getSmartMeetingSpot(area, invite.activity);
      aiSpot = `Suggestion: ${spot.name}. Safety: ${spot.reason}`;
    }

    const updated = { ...invite, status: action, aiSuggestedSpot: aiSpot, respondedAt: Date.now() };
    
    // 1. Update Local
    setState(prev => ({
      ...prev,
      invites: prev.invites.map(i => i.id === inviteId ? updated : i)
    }));

    // 2. Notify Sender via "Vote" key
    try {
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/v_${inviteId}/${encodeData(updated)}`, { method: 'POST' });
      
      // 3. Clear my inbox
      const inboxRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${state.currentSession.id}`);
      let inbox = JSON.parse((await inboxRes.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]") as Invite[];
      inbox = inbox.filter(i => i.id !== inviteId);
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/i_${state.currentSession.id}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
    } catch (e) {}
  };

  return {
    state, remotePeers,
    setView: (v: View) => setState(prev => ({ ...prev, currentView: v })),
    createSession, sendInvite, respondToInvite,
    resetApp: () => { localStorage.clear(); window.location.reload(); }
  };
}
