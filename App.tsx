
import React, { useState } from 'react';
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
    state, remotePeers, setView, createSession, 
    sendInvite, respondToInvite, resetApp 
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
      case 'DASHBOARD': return <Dashboard session={state.currentSession!} invites={state.invites} remotePeers={remotePeers} onSendInvite={sendInvite} onRespond={respondToInvite} onReset={resetApp} />;
      case 'PROFILE': return <ProfileView session={state.currentSession!} onBack={() => setView('DASHBOARD')} onEditInterests={() => {}} onUpdateName={() => {}} onReset={resetApp} onUpdateAccessibility={() => {}} onUpdateInviteDuration={() => {}} />;
      default: return <WelcomeView onNext={() => setView('NAME')} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-[#020617] flex items-center justify-center font-sans overflow-hidden">
      <div className="w-full h-[100dvh] max-w-md bg-white relative flex flex-col md:h-[92vh] md:rounded-[3rem] md:shadow-[0_0_120px_rgba(0,0,0,0.8)] overflow-hidden">
        
        {/* Neon Emerald Header */}
        <header className="safe-top px-8 py-6 bg-slate-900 text-white flex justify-between items-center z-[100] border-b border-emerald-500/30">
          <div className="flex items-center gap-4" onClick={() => setView('DASHBOARD')}>
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg neon-glow">
              <span className="text-2xl">🌱</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="font-black text-xl tracking-tighter uppercase leading-none text-emerald-400">GoldenMesh</h1>
                <span className="bg-slate-800 text-[8px] font-black px-1.5 py-0.5 rounded text-slate-500 uppercase tracking-widest border border-slate-700">V6.0</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Live Safety Relay</span>
            </div>
          </div>
          {state.currentSession && (
            <button 
              onClick={() => setView('PROFILE')} 
              className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 active:scale-90 transition-transform shadow-inner">
              <span className="text-xl">⚙️</span>
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar relative bg-slate-50">
          {renderView()}
        </main>

        <footer className="safe-bottom px-8 py-4 bg-white/90 backdrop-blur-xl border-t border-slate-100 flex justify-center">
           <div className="flex items-center gap-2 px-6 py-2 bg-emerald-50 rounded-full border border-emerald-100 neon-glow">
             <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Neighbor Mesh Active</span>
           </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
