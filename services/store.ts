
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

// RELAY CONFIG: Shortest possible token
const RELAY_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';
const APP_TOKEN = 'gb_v5_norm'; 

const encodeData = (obj: any) => {
  try {
    const str = JSON.stringify(obj);
    return btoa(encodeURIComponent(str)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (e) { return ""; }
};

const decodeData = (base64: string) => {
  try {
    if (!base64 || base64 === "null" || base64 === "" || base64 === "[]") return null;
    const clean = base64.trim().replace(/^"(.*)"$/, '$1').replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(clean)));
  } catch (e) { return null; }
};

async function api(path: string, method: 'GET' | 'POST' = 'GET', body?: string) {
  const url = `${RELAY_BASE}/${method === 'POST' ? 'UpdateValue' : 'GetValue'}/${APP_TOKEN}/${path}${body ? '/' + body : ''}`;
  const res = await fetch(url, { method: 'POST', mode: 'cors', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return res;
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
  const errorCount = useRef(0);

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
      // 1. Presence & Directory
      await api(`u${myId}/${Math.floor(Date.now()/1000)}`, 'POST');
      const dirRes = await api(`d${myArea}`);
      const dirText = await dirRes.text();
      let directory: string[] = JSON.parse(dirText.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      
      if (!directory.includes(myId)) {
        directory = [myId, ...directory].slice(0, 5);
        await api(`d${myArea}/${encodeURIComponent(JSON.stringify(directory))}`, 'POST');
      }

      // 2. Fetch Profiles in parallel (Original simple way)
      const peerData = await Promise.all(directory.map(async (id) => {
        if (id === myId) return null;
        try {
          const pRes = await api(`p${id}`);
          return decodeData(await pRes.text());
        } catch (e) { return null; }
      }));
      setRemotePeers(peerData.filter(Boolean) as Session[]);

      // 3. Normalized Inbox Sync (Only fetching IDs first to keep URL tiny)
      const inboxRes = await api(`i${myId}`);
      const inboxText = await inboxRes.text();
      const inviteIds: string[] = JSON.parse(inboxText.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      
      if (inviteIds.length > 0) {
        const fullInvites = await Promise.all(inviteIds.map(async (id) => {
          try {
            const res = await api(`inv${id}`);
            return decodeData(await res.text());
          } catch (e) { return null; }
        }));
        
        const validInvites = fullInvites.filter(Boolean) as Invite[];
        setState(prev => {
          const existingIds = prev.invites.map(i => i.id);
          const newOnes = validInvites.filter(v => !existingIds.includes(v.id));
          return newOnes.length > 0 ? { ...prev, invites: [...prev.invites, ...newOnes] } : prev;
        });
      }

      setSyncStatus('IDLE');
      setLastSync(Date.now());
      errorCount.current = 0;
    } catch (e: any) {
      errorCount.current++;
      if (errorCount.current > 2) setSyncStatus('ERROR');
    } finally {
      isSyncing.current = false;
    }
  }, [state.currentSession]);

  useEffect(() => {
    if (!state.currentSession) return;
    const timer = setInterval(sync, 15000);
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
    try {
      await api(`p${s.id}/${encodeData(s)}`, 'POST');
    } catch (e) {}
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
      // 1. Save Invite Details separately (keeps URL short)
      await api(`inv${invite.id}/${encodeData(invite)}`, 'POST');
      // 2. Add ID to recipient's index
      const res = await api(`i${toId}`);
      let index = JSON.parse((await res.text()).trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') || "[]");
      index = [invite.id, ...index].slice(0, 5);
      await api(`i${toId}/${encodeURIComponent(JSON.stringify(index))}`, 'POST');
    } catch (e) {}
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
      // Always store in the dedicated invite key
      await api(`inv${inviteId}/${encodeData(updated)}`, 'POST');
      if (action === 'DECLINED') {
        setState(prev => ({ ...prev, invites: prev.invites.filter(i => i.id !== inviteId) }));
      }
    } catch (e) {}
  };

  return {
    state, remotePeers, syncStatus, lastSync,
    setView: (v: View) => setState(prev => ({ ...prev, currentView: v })),
    createSession, sendInvite, respondToInvite,
    resetApp: () => { localStorage.clear(); window.location.reload(); },
    updateAccessibility: (s: Partial<AccessibilitySettings>) => {
      setState(prev => prev.currentSession ? { ...prev, currentSession: { ...prev.currentSession, accessibility: { ...prev.currentSession.accessibility, ...s } } } : prev);
    },
    retrySync: sync
  };
}
