
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
    <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center font-sans">
      <div className="w-full h-[100dvh] max-w-md bg-white relative flex flex-col md:h-[92vh] md:rounded-[3.5rem] md:shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-700">
        
        {/* Mobile Header: Glass Effect */}
        <header className="safe-top px-6 py-4 bg-white/70 backdrop-blur-xl border-b border-slate-100 flex justify-between items-center z-50">
          <div className="flex items-center gap-3" onClick={() => setView('DASHBOARD')}>
            <div className="w-10 h-10 bg-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200 animate-pulse">
              <span className="text-xl">🌟</span>
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-lg tracking-tighter text-slate-900 leading-none uppercase">GoldenBuddy</h1>
              <span className="text-[9px] font-extrabold text-amber-500 uppercase tracking-widest mt-0.5">Live Connection</span>
            </div>
          </div>
          {state.currentSession && (
            <button 
              onClick={() => setView('PROFILE')} 
              className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center border border-slate-200 active:scale-90 transition-transform shadow-sm">
              <span className="text-lg">⚙️</span>
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar relative">
          {renderView()}
        </main>

        <footer className="safe-bottom px-6 py-4 bg-white/60 backdrop-blur-md flex flex-col items-center border-t border-slate-50">
           <div className="flex items-center gap-2 px-6 py-2 bg-emerald-50 rounded-full border border-emerald-100 shadow-sm">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Neighbor Mesh Active</span>
           </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
