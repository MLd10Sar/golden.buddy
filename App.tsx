import React, { useState, useMemo } from 'react';
import { useGoldenBuddyStore } from './services/store';
import { WelcomeView } from './views/Welcome';
import { NamePicker } from './views/NamePicker';
import { LocationPicker } from './views/LocationPicker';
import { InterestPicker } from './views/InterestPicker';
import { Dashboard } from './views/Dashboard';
import { ProfileView } from './views/Profile';
import { AreaId, Interest } from './types';

const App: React.FC = () => {
  const { 
    state, 
    remotePeers, 
    syncStatus,
    lastSync,
    setView, 
    createSession, 
    sendInvite, 
    respondToInvite, 
    updateInviteNote,
    resetApp, 
    updateAccessibility,
    retrySync
  } = useGoldenBuddyStore();
  
  const [tempName, setTempName] = useState('');
  const [tempArea, setTempArea] = useState<AreaId | null>(null);
  const [tempInterests, setTempInterests] = useState<Interest[]>([]);

  const accessibilityClasses = useMemo(() => {
    if (!state.currentSession) return '';
    const { fontSize, contrastMode } = state.currentSession.accessibility;
    let classes = '';
    if (fontSize === 'large') classes += ' text-lg';
    else if (fontSize === 'extra-large') classes += ' text-xl';
    if (contrastMode === 'high') classes += ' contrast-[1.1] grayscale-[0.2]';
    return classes;
  }, [state.currentSession?.accessibility]);

  const renderView = () => {
    switch (state.currentView) {
      case 'WELCOME': return <WelcomeView onNext={() => setView('NAME')} />;
      case 'NAME': return <NamePicker name={tempName} onSetName={setTempName} onNext={() => setView('LOCATION')} onBack={() => setView('WELCOME')} />;
      case 'LOCATION': return <LocationPicker selectedArea={tempArea} onSelect={(area) => { setTempArea(area); setView('INTERESTS'); }} onBack={() => setView('NAME')} />;
      case 'INTERESTS': return <InterestPicker selectedInterests={tempInterests} onToggle={(interest) => { setTempInterests(prev => prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]); }} onNext={() => createSession(tempName, tempArea!, tempInterests)} onBack={() => setView('LOCATION')} />;
      case 'DASHBOARD': return <Dashboard session={state.currentSession!} invites={state.invites} remotePeers={remotePeers} onSendInvite={sendInvite} onRespond={respondToInvite} onUpdateNote={updateInviteNote} onReset={resetApp} />;
      case 'PROFILE': return <ProfileView session={state.currentSession!} onBack={() => setView('DASHBOARD')} onEditInterests={() => setView('INTERESTS')} onUpdateName={()=>{}} onReset={resetApp} onUpdateAccessibility={updateAccessibility} onUpdateInviteDuration={()=>{}} />;
      default: return <WelcomeView onNext={() => setView('NAME')} />;
    }
  };

  return (
    <div className={`min-h-screen max-w-md mx-auto bg-white shadow-2xl flex flex-col relative overflow-hidden transition-all duration-300 ${accessibilityClasses}`}>
      <header className="p-4 border-b bg-amber-400 flex justify-between items-center shrink-0 z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('DASHBOARD')}>
          <span className="text-2xl">🌟</span>
          <h1 className="font-black text-xl text-amber-950 uppercase">GoldenBuddy</h1>
        </div>
        {state.currentSession && (
          <button onClick={() => setView('PROFILE')} className="bg-white/40 text-amber-950 text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest">Profile</button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto relative bg-amber-50/20">
        {syncStatus === 'ERROR' && (
          <div className="bg-amber-100 p-3 border-b border-amber-200 flex items-center justify-between gap-4 animate-fadeIn sticky top-0 z-[60]">
            <p className="text-[10px] font-bold text-amber-800 uppercase">📡 Reconnecting to neighborhood...</p>
            <button onClick={retrySync} className="text-[9px] font-black bg-amber-400 text-amber-950 px-3 py-1 rounded-full uppercase shadow-sm active:scale-90">Retry</button>
          </div>
        )}
        {renderView()}
      </main>

      <footer className="bg-slate-900 text-slate-500 text-[8px] text-center py-2 font-black uppercase tracking-widest border-t border-slate-800 flex items-center justify-center gap-4 shrink-0">
        <span className={syncStatus === 'SYNCING' ? 'animate-pulse text-amber-400' : ''}>
          {syncStatus === 'SYNCING' ? '● SYNCING' : '● NEIGHBORHOOD ONLINE'}
        </span>
        {state.currentSession && <span>LAST: {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
      </footer>
    </div>
  );
};

export default App;
