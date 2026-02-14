
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

const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'gb_v_realtime_v110_spot_enhanced'; // Refreshed token for clean session logic

const encodeData = (obj: any) => {
  try {
    return btoa(encodeURIComponent(JSON.stringify(obj)));
  } catch (e) {
    return "";
  }
};

const decodeData = (base64: string) => {
  try {
    if (!base64 || base64 === "null") return null;
    const clean = base64.trim().replace(/^"(.*)"$/, '$1');
    return JSON.parse(decodeURIComponent(atob(clean)));
  } catch (e) {
    return null;
  }
};

export function useGoldenBuddyStore() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...initialState, ...parsed, currentView: 'WELCOME' };
      } catch (e) {
        return initialState;
      }
    }
    return initialState;
  });

  const [remotePeers, setRemotePeers] = useState<Session[]>([]);
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

      // 1. Heartbeat - Broadcast Presence
      const myProfile = encodeData({ ...state.currentSession, lastSeenAt: Date.now() });
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/u_${myId}/${myProfile}`, { method: 'POST' });

      // 2. Area Directory - Register in Neighborhood
      const dirRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/d_${myArea}`);
      const dirRaw = await dirRes.text();
      let directory = JSON.parse(dirRaw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      if (!directory.includes(myId)) {
        directory = [...directory, myId].slice(-20);
        await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/d_${myArea}/${encodeURIComponent(JSON.stringify(directory))}`, { method: 'POST' });
      }

      // 3. Peer Refresh - Get Active Neighbors
      const peerData = await Promise.all(directory.filter((id: string) => id !== myId).map(async (id: string) => {
        const r = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/u_${id}`);
        const t = await r.text();
        return decodeData(t);
      }));
      setRemotePeers(peerData.filter(p => p && (Date.now() - p.lastSeenAt < 40000)));

      // 4. Inbox Check - Receive New Invites
      const inboxRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${myId}`);
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

      // 5. Response Handshake - Check Responses to Sent Invites
      const pendingOut = state.invites.filter(i => i.fromSessionId === myId && i.status === 'PENDING');
      for (const inv of pendingOut) {
        const vRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/v_${inv.id}`);
        const vText = await vRes.text();
        const responseInvite = decodeData(vText);
        if (responseInvite && responseInvite.status !== 'PENDING') {
          setState(prev => ({
            ...prev,
            invites: prev.invites.map(i => i.id === inv.id ? responseInvite : i)
          }));
        }
      }
    } catch (e) {} finally {
      isSyncing.current = false;
    }
  }, [state.currentSession, state.invites]);

  useEffect(() => {
    if (!state.currentSession) return;
    const interval = setInterval(sync, 2500);
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
      const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${toId}`);
      let inbox = JSON.parse((await res.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      inbox = [...inbox, invite].slice(-5);
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/i_${toId}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
    } catch (e) {}
  };

  const respondToInvite = async (inviteId: string, action: 'ACCEPTED' | 'DECLINED') => {
    const invite = state.invites.find(i => i.id === inviteId);
    if (!invite || !state.currentSession) return;
    
    let spotInfo = "";
    if (action === 'ACCEPTED') {
      const fullAreaName = AREAS.find(a => a.id === state.currentSession?.areaId)?.name || 'local area';
      const spot = await getSmartMeetingSpot(fullAreaName, invite.activity);
      // Store complete structured data as JSON for the dashboard to parse
      spotInfo = JSON.stringify(spot);
    }

    const updated: Invite = { 
      ...invite, 
      status: action, 
      aiSuggestedSpot: spotInfo,
      respondedAt: Date.now() 
    };

    setState(prev => ({
      ...prev,
      invites: prev.invites.map(i => i.id === inviteId ? updated : i)
    }));

    try {
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/v_${inviteId}/${encodeData(updated)}`, { method: 'POST' });
      
      const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${state.currentSession.id}`);
      let inbox = JSON.parse((await res.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]") as Invite[];
      inbox = inbox.filter(i => i.id !== inviteId);
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/i_${state.currentSession.id}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
    } catch (e) {}
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
    state, remotePeers,
    setView: (v: View) => setState(prev => ({ ...prev, currentView: v })),
    createSession, sendInvite, respondToInvite,
    updateInviteNote,
    resetApp: () => { localStorage.clear(); window.location.reload(); },
    updateAccessibility,
    updateInviteDuration,
  };
}
