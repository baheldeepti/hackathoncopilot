
import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { AppView } from '../types';

interface SplashScreenProps {
  onSelectRole: (role: AppView, isDemo: boolean, userName: string, isSignUp: boolean) => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onSelectRole }) => {
  const [selectedRole, setSelectedRole] = useState<AppView | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRoleClick = (role: AppView) => {
    setSelectedRole(role);
    setIsSignUp(false); // Default to login
    setName('');
    setEmail('');
    setPassword('');
  };

  const handleBack = () => {
    setSelectedRole(null);
    setName('');
    setEmail('');
    setPassword('');
  };

  const handleAuthAction = (isDemo: boolean) => {
    if (!selectedRole) return;
    setLoading(true);
    
    // Simulate auth network request
    setTimeout(() => {
        const finalName = isDemo 
            ? (selectedRole === AppView.FOUNDER ? 'Demo Founder' : 'Demo Participant') 
            : (name || email.split('@')[0] || 'User');
        
        // If it's a demo, we treat it like a fresh signup with pre-filled data (handled in App.tsx)
        // If it's a real signup, isSignUp is true.
        // If it's a login, isSignUp is false.
        onSelectRole(selectedRole, isDemo, finalName, isDemo ? false : isSignUp);
        setLoading(false);
    }, 800);
  };

  const handleResetData = () => {
      if (window.confirm("This will wipe all local settings and reset the app. Are you sure?")) {
          localStorage.clear();
          window.location.reload();
      }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans text-slate-100">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black -z-10"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" style={{animationDelay: '1.5s'}}></div>

      {/* Main Container */}
      <div className="w-full max-w-5xl z-10 transition-all duration-500 ease-out">
        
        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-500 ${selectedRole ? 'opacity-0 -translate-y-10 hidden' : 'opacity-100'}`}>
           <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-indigo-400 mb-6 tracking-tighter drop-shadow-[0_0_30px_rgba(34,211,238,0.2)]">
            HACKATHON COPILOT
          </h1>
          <p className="text-slate-400 text-xl font-mono tracking-widest uppercase">
            Gemini 3 Pro <span className="text-cyan-500 mx-2">//</span> Neural Hackathon Orchestrator
          </p>
        </div>

        {!selectedRole ? (
          /* Role Selection Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
            {/* Founder Card */}
            <div 
              onClick={() => handleRoleClick(AppView.FOUNDER)}
              className="group relative bg-slate-900/60 backdrop-blur-md border border-slate-800 hover:border-cyan-500 rounded-2xl p-10 cursor-pointer transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col items-center text-center h-[400px] justify-center overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-24 h-24 rounded-full bg-slate-800 border border-slate-700 group-hover:border-cyan-400 flex items-center justify-center mb-8 shadow-lg z-10 transition-colors">
                <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-4 group-hover:text-cyan-300 transition-colors z-10">Organize Event</h2>
              <p className="text-slate-400 text-base z-10 max-w-xs leading-relaxed">
                Define the vision. Train the AI Avatar. Manage the knowledge base.
              </p>
              <div className="mt-8 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-900/10 text-cyan-300 text-xs font-mono uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all z-10">
                Founder Access
              </div>
            </div>

            {/* Participant Card */}
            <div 
              onClick={() => handleRoleClick(AppView.PARTICIPANT)}
              className="group relative bg-slate-900/60 backdrop-blur-md border border-slate-800 hover:border-indigo-500 rounded-2xl p-10 cursor-pointer transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-[0_0_50px_rgba(99,102,241,0.15)] flex flex-col items-center text-center h-[400px] justify-center overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-24 h-24 rounded-full bg-slate-800 border border-slate-700 group-hover:border-indigo-400 flex items-center justify-center mb-8 shadow-lg z-10 transition-colors">
                <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-4 group-hover:text-indigo-300 transition-colors z-10">Join & Build</h2>
              <p className="text-slate-400 text-base z-10 max-w-xs leading-relaxed">
                Get AI coaching. Analyze your pitch. Solve coding blockers.
              </p>
              <div className="mt-8 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-900/10 text-indigo-300 text-xs font-mono uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all z-10">
                Hacker Access
              </div>
            </div>
          </div>
        ) : (
          /* Auth Form */
          <div className="max-w-md mx-auto animate-fade-in-up">
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
               {/* Decorative header line */}
               <div className={`absolute top-0 left-0 w-full h-1 ${selectedRole === AppView.FOUNDER ? 'bg-cyan-500' : 'bg-indigo-500'}`}></div>
               
               <button onClick={handleBack} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
               </button>

               <div className="mb-8">
                   <h2 className="text-2xl font-bold text-white mb-1">
                       {selectedRole === AppView.FOUNDER ? 'Founder Portal' : 'Participant Terminal'}
                   </h2>
                   <p className="text-slate-400 text-sm">
                       {isSignUp ? "Create your identity to proceed." : "Authenticate to access the workspace."}
                   </p>
               </div>

               <div className="space-y-4 mb-8">
                   {isSignUp && (
                       <Input 
                            placeholder="Full Name" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-slate-950/50"
                       />
                   )}
                   <Input 
                        type="email" 
                        placeholder="Email Address" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-slate-950/50"
                   />
                   <Input 
                        type="password" 
                        placeholder="Password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-slate-950/50"
                   />
               </div>

               <div className="space-y-3">
                   <Button 
                        onClick={() => handleAuthAction(false)} 
                        isLoading={loading}
                        className={`w-full ${selectedRole === AppView.FOUNDER ? 'bg-cyan-500 hover:bg-cyan-400 border-cyan-400' : 'bg-indigo-500 hover:bg-indigo-400 border-indigo-400'}`}
                        disabled={!email || !password || (isSignUp && !name)}
                   >
                       {isSignUp ? 'Create Account' : 'Sign In'}
                   </Button>
                   
                   <div className="text-center">
                       <button 
                           onClick={() => setIsSignUp(!isSignUp)}
                           className="text-xs text-slate-400 hover:text-white underline mt-2"
                       >
                           {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                       </button>
                   </div>

                   <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-700"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-500 text-xs uppercase">Or for Testing</span>
                        <div className="flex-grow border-t border-slate-700"></div>
                   </div>

                   <Button 
                        variant="secondary"
                        onClick={() => handleAuthAction(true)} 
                        isLoading={loading}
                        className="w-full font-mono text-sm"
                   >
                       Launch Demo Account {selectedRole === AppView.FOUNDER ? '(Pre-filled)' : '(With Context)'}
                   </Button>
               </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="absolute bottom-6 text-center w-full z-10 opacity-50 pointer-events-none">
          <p className="text-[10px] text-slate-500 font-mono">POWERED BY GOOGLE CLOUD • GEMINI API • VEO</p>
      </div>

      <div className="fixed bottom-6 right-6 z-50 flex gap-2">
          {/* Reset Button */}
          <button 
            onClick={handleResetData}
            className="bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-xs font-bold shadow-lg transition-all"
          >
              ⚠ Reset App Data
          </button>
      </div>
    </div>
  );
};

export default SplashScreen;
