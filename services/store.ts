
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
const APP_TOKEN = 'gb_v7_natural_groups';

export function useGoldenBuddyStore() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<AppState>;
        // Reset view to Welcome on fresh load for safety
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
      
      // Update individual presence
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/s_${state.currentSession.id}/${encodeURIComponent(sessionJson)}`, { method: 'POST' });
      
      // Update area directory
      const dirRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/d_${state.currentSession.areaId}`);
      const dirRaw = await dirRes.text();
      let directory = dirRaw && dirRaw !== "null" ? JSON.parse(dirRaw) : [];
      if (!Array.isArray(directory)) directory = [];
      
      if (!directory.includes(state.currentSession.id)) {
        directory = [...directory, state.currentSession.id].slice(-50);
        await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/d_${state.currentSession.areaId}/${encodeURIComponent(JSON.stringify(directory))}`, { method: 'POST' });
      }
    } catch (e) {}
  }, [state.currentSession]);

  const syncRemoteData = useCallback(async () => {
    if (!state.currentSession || isSyncing.current) return;
    isSyncing.current = true;
    try {
      // 1. Get Neighbors in the same area
      const dirRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/d_${state.currentSession.areaId}`);
      const dirText = await dirRes.text();
      const ids = JSON.parse(dirText && dirText !== "null" ? dirText : "[]");
      
      const peerPromises = ids.filter((id: string) => id !== state.currentSession?.id).map(async (id: string) => {
        const res = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/s_${id}`);
        const raw = await res.text();
        return raw && raw !== "null" ? JSON.parse(raw) : null;
      });
      
      // Actively filter for peers seen in the last 60 seconds
      const peers = (await Promise.all(peerPromises)).filter(p => p && (Date.now() - p.lastSeenAt < 60000)) as Session[];
      setRemotePeers(peers);

      // 2. Check for Incoming Invites to THIS user
      const inviteInboxRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${state.currentSession.id}`);
      const inviteInboxText = await inviteInboxRes.text();
      const incoming = JSON.parse(inviteInboxText && inviteInboxText !== "null" ? inviteInboxText : "[]") as Invite[];
      
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

      // 3. Update Status of Outgoing Invites
      const outgoingPending = state.invites.filter(i => i.fromSessionId === state.currentSession?.id && i.status === 'PENDING');
      for (const out of outgoingPending) {
        const statusRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/v_${out.id}`);
        const statusRaw = (await statusRes.text() || "").replace(/"/g, '');
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
    
    // Initial heartbeat
    broadcastPresence();
    
    // Enhanced heartbeat frequency: Broadcast every 5 seconds for real-time responsiveness
    const pInt = setInterval(broadcastPresence, 5000); 
    
    // Sync neighbors every 5 seconds
    const sInt = setInterval(syncRemoteData, 5000); 
    
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
    
    // Update local state
    setState(prev => ({ ...prev, invites: [...prev.invites, newInvite] }));

    // Push to neighbor's inbox
    try {
      const inboxRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${toId}`);
      const inboxText = await inboxRes.text();
      let inbox = JSON.parse(inboxText && inboxText !== "null" ? inboxText : "[]");
      inbox = [...inbox, newInvite].slice(-5); // Keep last 5 invites
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/i_${toId}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
    } catch (e) {}
  };

  const respondToInvite = async (inviteId: string, action: 'ACCEPTED' | 'DECLINED', note?: string) => {
    setState(prev => ({
      ...prev,
      invites: prev.invites.map(inv => inv.id === inviteId ? { ...inv, status: action, coordinationNote: note || inv.coordinationNote, respondedAt: Date.now() } : inv)
    }));

    try {
      // Update the status flag for the sender to see
      await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/v_${inviteId}/${action}`, { method: 'POST' });
      
      // Cleanup the inbox
      if (state.currentSession) {
        const inboxRes = await fetch(`${RELAY_BASE}/GetValue/${APP_TOKEN}/i_${state.currentSession.id}`);
        const inboxText = await inboxRes.text();
        let inbox = JSON.parse(inboxText && inboxText !== "null" ? inboxText : "[]") as Invite[];
        inbox = inbox.filter(i => i.id !== inviteId);
        await fetch(`${RELAY_BASE}/UpdateValue/${APP_TOKEN}/i_${state.currentSession.id}/${encodeURIComponent(JSON.stringify(inbox))}`, { method: 'POST' });
      }
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
