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
    <div className="fixed inset-0 bg-[#1e1b4b] flex items-center justify-center font-sans overflow-hidden">
      <div className="w-full h-[100dvh] max-w-md bg-white relative flex flex-col md:h-[90vh] md:rounded-[4rem] md:shadow-[0_0_100px_rgba(0,0,0,0.7)] overflow-hidden">
        
        {/* Modern Violet Header */}
        <header className="safe-top px-8 py-6 bg-indigo-900 text-white flex justify-between items-center z-[100] border-b border-indigo-800 shadow-xl">
          <div className="flex items-center gap-4" onClick={() => setView('DASHBOARD')}>
            <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-500/40">
              <span className="text-2xl">🤝</span>
            </div>
            <div className="flex flex-col">
              <h1 className="font-extrabold text-xl tracking-tighter uppercase leading-none">BuddyLive</h1>
              <span className="text-[10px] font-bold text-pink-300 uppercase tracking-widest mt-1">Connecting Neighbors</span>
            </div>
          </div>
          {state.currentSession && (
            <button 
              onClick={() => setView('PROFILE')} 
              className="w-12 h-12 bg-indigo-800 rounded-full flex items-center justify-center border border-indigo-700 active:scale-90 transition-transform">
              <span className="text-xl">⚙️</span>
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar relative bg-indigo-50/30">
          {renderView()}
        </main>

        <footer className="safe-bottom px-8 py-6 bg-white/80 backdrop-blur-xl border-t border-indigo-50 flex justify-center">
           <div className="flex items-center gap-3 px-6 py-2 bg-pink-50 rounded-full border border-pink-100">
             <div className="w-3 h-3 rounded-full bg-pink-500 animate-pulse" />
             <span className="text-[11px] font-black text-pink-900 uppercase tracking-widest">Active Safe Zone</span>
           </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
