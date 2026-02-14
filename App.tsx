
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
    resetApp, 
    updateAccessibility,
    updateInviteDuration
  } = useGoldenBuddyStore();
  
  const [tempName, setTempName] = useState('');
  const [tempArea, setTempArea] = useState<AreaId | null>(null);
  const [tempInterests, setTempInterests] = useState<Interest[]>([]);

  const handleFinishOnboarding = () => {
    if (tempArea) createSession(tempName || 'Neighbor', tempArea, tempInterests);
  };

  const renderView = () => {
    switch (state.currentView) {
      case 'WELCOME': return <WelcomeView onNext={() => setView('NAME')} />;
      case 'NAME': return <NamePicker name={tempName} onSetName={setTempName} onNext={() => setView('LOCATION')} onBack={() => setView('WELCOME')} />;
      case 'LOCATION': return <LocationPicker selectedArea={tempArea} onSelect={(area) => { setTempArea(area); setView('INTERESTS'); }} onBack={() => setView('NAME')} />;
      case 'INTERESTS': return <InterestPicker selectedInterests={tempInterests} onToggle={(interest) => setTempInterests(prev => prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest])} onNext={handleFinishOnboarding} onBack={() => setView('LOCATION')} />;
      case 'DASHBOARD': return <Dashboard session={state.currentSession!} invites={state.invites} remotePeers={remotePeers} onSendInvite={sendInvite} onRespond={respondToInvite} onUpdateNote={() => {}} onReset={resetApp} />;
      case 'PROFILE': return <ProfileView session={state.currentSession!} onBack={() => setView('DASHBOARD')} onEditInterests={() => setView('INTERESTS')} onUpdateName={() => {}} onReset={resetApp} onUpdateAccessibility={updateAccessibility} onUpdateInviteDuration={updateInviteDuration} />;
      default: return <WelcomeView onNext={() => setView('NAME')} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center font-sans">
      <div className="w-full h-[100dvh] max-w-md bg-slate-50 relative flex flex-col md:h-[90vh] md:rounded-[3rem] md:shadow-2xl overflow-hidden transition-all duration-500 ease-in-out">
        {/* Mobile-Native Glass Header */}
        <header className="safe-top px-6 py-4 bg-white/70 backdrop-blur-lg border-b border-slate-100 flex justify-between items-center z-50">
          <div className="flex items-center gap-2" onClick={() => setView('DASHBOARD')}>
            <div className="w-9 h-9 bg-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200">
              <span className="text-xl">🌟</span>
            </div>
            <h1 className="font-extrabold text-lg tracking-tight text-slate-900 uppercase">GoldenBuddy</h1>
          </div>
          {state.currentSession && (
            <button 
              onClick={() => setView('PROFILE')} 
              className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 active:scale-90 transition-transform">
              ⚙️
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar relative animate-spring">
          {renderView()}
        </main>

        <footer className="safe-bottom p-4 flex flex-col items-center bg-white/50 backdrop-blur-md">
           <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full border border-green-100">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
             <span className="text-[10px] font-extrabold text-green-700 uppercase tracking-widest">Neighborhood Live</span>
           </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
