
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Session, Invite, View, AreaId, Interest, AccessibilitySettings, InviteStatus } from '../types';
import { STORAGE_KEY, INVITE_DURATION_MS } from '../constants';

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

// Anonymous Relay API
const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'gb_v52_ultra_fast'; // Incremented token for fresh sync state

export function useGoldenBuddyStore() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<AppState>;
        return { ...initialState, ...parsed, currentView: 'WELCOME' } as AppState;
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

  const broadcastPresence = useCallback(async () => {
    if (!state.currentSession) return;
    try {
      const sessionWithTime = { ...state.currentSession, lastSeenAt: Date.now() };
      const sessionJson = JSON.stringify(sessionWithTime);
      
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/s_${state.currentSession.id}/${encodeURIComponent(sessionJson)}`, { method: 'POST' });
      
      const dirRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/d_${state.currentSession.areaId}`);
      const dirRaw = await dirRes.text();
      let directory = dirRaw && dirRaw !== "null" ? JSON.parse(dirRaw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"')) : [];
      if (!Array.isArray(directory)) directory = [];
      
      if (!directory.includes(state.currentSession.id)) {
        directory = [...directory, state.currentSession.id].slice(-30);
        await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/d_${state.currentSession.areaId}/${encodeURIComponent(JSON.stringify(directory))}`, { method: 'POST' });
      }
    } catch (e) {}
  }, [state.currentSession]);

  const syncRemoteData = useCallback(async () => {
    if (!state.currentSession || isSyncing.current) return;
    isSyncing.current = true;
    try {
      const dirRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/d_${state.currentSession.areaId}`);
      const dirText = await dirRes.text();
      const cleanedDir = dirText.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
      const ids = JSON.parse(cleanedDir && cleanedDir !== "null" ? cleanedDir : "[]");
      
      const peerPromises = ids.filter((id: string) => id !== state.currentSession?.id).map(async (id: string) => {
        const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/s_${id}`);
        const raw = await res.text();
        const cleanedRaw = raw.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
        return cleanedRaw && cleanedRaw !== "null" ? JSON.parse(cleanedRaw) : null;
      });
      
      const peers = (await Promise.all(peerPromises)).filter(p => p && (Date.now() - p.lastSeenAt < 45000)) as Session[];
      setRemotePeers(peers);

      const inviteInboxRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${state.currentSession.id}`);
      const inviteInboxText = await inviteInboxRes.text();
      const cleanedInbox = inviteInboxText.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
      const incoming = JSON.parse(cleanedInbox && cleanedInbox !== "null" ? cleanedInbox : "[]") as Invite[];
      
      if (incoming.length > 0) {
        setState(prev => {
          const newInvites = [...prev.invites];
          let changed = false;
          incoming.forEach(inc => {
            if (!newInvites.some(existing => existing.id === inc.id)) {
              newInvites.push(inc);
              changed = true;
            }
          });
          return changed ? { ...prev, invites: newInvites } : prev;
        });
      }

      const outgoingPending = state.invites.filter(i => i.fromSessionId === state.currentSession?.id && i.status === 'PENDING');
      for (const out of outgoingPending) {
        const statusRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/v_${out.id}`);
        const statusRaw = (await statusRes.text() || "").replace(/"/g, '').trim();
        if (statusRaw === 'ACCEPTED' || statusRaw === 'DECLINED') {
          setState(prev => ({
            ...prev,
            invites: prev.invites.map(i => i.id === out.id ? { ...i, status: statusRaw as InviteStatus, respondedAt: Date.now() } : i)
          }));
        }
      }

    } catch (e) {} finally { isSyncing.current = false; }
  }, [state.currentSession, state.invites]);

  useEffect(() => {
    if (!state.currentSession) return;
    broadcastPresence();
    const pInt = setInterval(broadcastPresence, 3000); // 3s presence heartbeat
    const sInt = setInterval(syncRemoteData, 3000); // 3s sync for responsiveness
    return () => { 
      clearInterval(pInt); 
      clearInterval(sInt); 
    };
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

  const sendInvite = async (toId: string, activity: Interest) => {
    if (!state.currentSession) return;
    const duration = state.currentSession.inviteDuration || INVITE_DURATION_MS;
    const newInvite: Invite = {
      id: Math.random().toString(36).substr(2, 6),
      fromSessionId: state.currentSession.id,
      toSessionId: toId,
      activity,
      status: 'PENDING',
      createdAt: Date.now(),
      expiresAt: Date.now() + duration,
    };
    
    setState(prev => ({ ...prev, invites: [...prev.invites, newInvite] }));

    try {
      const inboxRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${toId}`);
      const inboxText = await inboxRes.text();
      const cleanedInbox = inboxText.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
      let inbox = JSON.parse(cleanedInbox && cleanedInbox !== "null" ? cleanedInbox : "[]");
      inbox = [...inbox, newInvite].slice(-5);
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/i_${toId}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
    } catch (e) {}
  };

  const respondToInvite = async (inviteId: string, action: 'ACCEPTED' | 'DECLINED', note?: string) => {
  if (!state.currentSession) return;

  let finalStatus: InviteStatus = action;

  setState(prev => ({
    ...prev,
    invites: prev.invites.map(inv => {
      if (inv.id !== inviteId) return inv;

      // ensure acceptedBy exists
      const acceptedBy = inv.acceptedBy ? [...inv.acceptedBy] : [];

      if (action === 'ACCEPTED') {
        // add this user if not already
        if (!acceptedBy.includes(state.currentSession!.id)) {
          acceptedBy.push(state.currentSession!.id);
        }

        // BOTH users accepted → final ACCEPTED
        if (acceptedBy.length >= 2) {
          finalStatus = 'ACCEPTED';
        } else {
          finalStatus = 'PENDING'; // waiting other side
        }

        return {
          ...inv,
          acceptedBy,
          status: finalStatus,
          coordinationNote: note || inv.coordinationNote,
          respondedAt: Date.now()
        };
      }

      if (action === 'DECLINED') {
        finalStatus = 'DECLINED';
        return {
          ...inv,
          status: 'DECLINED',
          respondedAt: Date.now()
        };
      }

      return inv;
    })
  }));

  try {
    // Only send ACCEPTED to relay when both accepted
    if (finalStatus === 'ACCEPTED' || finalStatus === 'DECLINED') {
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/v_${inviteId}/${finalStatus}`, { method: 'POST' });
    }

    // clean inbox (existing logic)
    const inboxRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${state.currentSession.id}`);
    const inboxText = await inboxRes.text();
    const cleanedInbox = inboxText.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
    let inbox = JSON.parse(cleanedInbox && cleanedInbox !== "null" ? cleanedInbox : "[]") as Invite[];
    inbox = inbox.filter(i => i.id !== inviteId);
    await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/i_${state.currentSession.id}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });

  } catch (e) {}
};


  const updateInviteNote = (inviteId: string, note: string) => {
    setState(prev => ({
      ...prev,
      invites: prev.invites.map(inv => inv.id === inviteId ? { ...inv, coordinationNote: note } : inv)
    }));
  };

  const resetApp = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState);
    setRemotePeers([]);
    window.location.reload();
  };

  return { 
    state, 
    remotePeers, 
    setState, 
    setView: (view: View) => setState(prev => ({...prev, currentView: view})), 
    createSession, 
    sendInvite, 
    respondToInvite, 
    updateInviteNote, 
    resetApp, 
    updateAccessibility,
    updateInviteDuration
  };
}
