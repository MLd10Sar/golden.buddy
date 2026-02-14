
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
    setView, 
    createSession, 
    sendInvite, 
    respondToInvite, 
    updateInviteNote, 
    resetApp, 
    updateAccessibility,
    updateInviteDuration
  } = useGoldenBuddyStore();
  
  const [tempName, setTempName] = useState('');
  const [tempArea, setTempArea] = useState<AreaId | null>(null);
  const [tempInterests, setTempInterests] = useState<Interest[]>([]);

  const handleFinishOnboarding = () => {
    if (tempArea) {
      createSession(tempName || 'Buddy', tempArea, tempInterests);
    }
  };

  // Accessibility styling logic
  const accessibilityClasses = useMemo(() => {
    if (!state.currentSession) return '';
    const { fontSize, contrastMode } = state.currentSession.accessibility;
    let classes = '';
    
    // Font Size
    if (fontSize === 'large') classes += ' text-lg';
    else if (fontSize === 'extra-large') classes += ' text-xl';
    else classes += ' text-base';

    // Contrast
    if (contrastMode === 'high') classes += ' grayscale-[0.2] contrast-[1.2] brightness-[0.9]';

    return classes;
  }, [state.currentSession?.accessibility]);

  const renderView = () => {
    switch (state.currentView) {
      case 'WELCOME':
        return <WelcomeView onNext={() => setView('NAME')} />;
      case 'NAME':
        return <NamePicker name={tempName} onSetName={setTempName} onNext={() => setView('LOCATION')} onBack={() => setView('WELCOME')} />;
      case 'LOCATION':
        return <LocationPicker selectedArea={tempArea} onSelect={(area) => { setTempArea(area); setView('INTERESTS'); }} onBack={() => setView('NAME')} />;
      case 'INTERESTS':
        return <InterestPicker selectedInterests={tempInterests} onToggle={(interest) => { setTempInterests(prev => prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]); }} onNext={handleFinishOnboarding} onBack={() => setView('LOCATION')} />;
      case 'DASHBOARD':
        return <Dashboard session={state.currentSession!} invites={state.invites} remotePeers={remotePeers} onSendInvite={sendInvite} onRespond={respondToInvite} onUpdateNote={updateInviteNote} onReset={resetApp} />;
      case 'PROFILE':
        return (
          <ProfileView 
            session={state.currentSession!} 
            onBack={() => setView('DASHBOARD')} 
            onEditInterests={() => setView('INTERESTS')} 
            onUpdateName={(n) => {}} 
            onReset={resetApp} 
            onUpdateAccessibility={updateAccessibility}
            onUpdateInviteDuration={updateInviteDuration}
          />
        );
      default:
        return <WelcomeView onNext={() => setView('NAME')} />;
    }
  };

  return (
    <div className={`min-h-screen max-w-md mx-auto bg-white shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-slate-200 transition-all duration-300 ${accessibilityClasses}`}>
      <header className="p-4 border-b bg-amber-400 flex justify-between items-center shrink-0 z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('DASHBOARD')}>
          <span className="text-2xl" role="img" aria-hidden="true">🌟</span>
          <h1 className="font-black text-xl tracking-tight text-amber-950 uppercase">GoldenBuddy</h1>
        </div>
        {state.currentSession && (
          <button 
            onClick={() => setView('PROFILE')} 
            aria-label="View Profile"
            className="bg-white/40 text-amber-950 text-xs font-black px-4 py-1.5 rounded-full hover:bg-white/60 transition-colors uppercase tracking-widest">
            Profile
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden relative bg-amber-50/30" role="main">
        {renderView()}
      </main>

      <footer className="bg-slate-900 text-slate-500 text-[9px] text-center py-2 font-black uppercase tracking-widest border-t border-slate-800 shrink-0">
        AI-Enhanced Safety & Privacy First
      </footer>
    </div>
  );
};

export default App;
