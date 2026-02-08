
import React, { useState } from 'react';
import { Button } from './ui/Button';
import ChatInterface from './ChatInterface';
import PitchCritique from './PitchCritique';
import DebugConsole from './DebugConsole';
import { HackathonConfig } from '../types';

interface ParticipantDashboardProps {
  config: HackathonConfig;
  onLogout: () => void;
}

type DashboardPhase = 'SELECT_EVENT' | 'TRIAGE' | 'WORKSPACE';
type ToolMode = 'CHAT' | 'DEBUG' | 'PITCH';

const ParticipantDashboard: React.FC<ParticipantDashboardProps> = ({ config: initialConfig, onLogout }) => {
  const [phase, setPhase] = useState<DashboardPhase>('SELECT_EVENT');
  const [activeConfig, setActiveConfig] = useState<HackathonConfig>(initialConfig);
  const [activeTool, setActiveTool] = useState<ToolMode>('CHAT');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // DeepMind Config Mock for the "2026" Aspiration
  const deepMindConfig: HackathonConfig = {
      ...initialConfig,
      name: "Google DeepMind Challenge 2026",
      vision: `MISSION: AGI FOR SCIENTIFIC DISCOVERY.

OBJECTIVE:
Develop autonomous agents capable of contributing to major scientific breakthroughs (Climate Modeling, Protein Folding, Fusion Control).

CONSTRAINTS:
1. Model: Gemini Ultra 2.0 (Alpha Access).
2. Safety: RLHF alignment protocols must be strictly enforced.
3. Stack: TensorFlow / JAX ecosystem.`,
      files: [], // Would typically load different files
      youtubeLinks: [] 
  };

  const handleEventSelect = (isDeepMind: boolean) => {
      setActiveConfig(isDeepMind ? deepMindConfig : initialConfig);
      setPhase('TRIAGE');
  };

  const handleToolSelect = (tool: ToolMode) => {
      setActiveTool(tool);
      setPhase('WORKSPACE');
  };

  const renderEventSelection = () => (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-6 animate-fade-in">
          <div className="text-center mb-12">
              <div className="inline-block px-3 py-1 mb-4 rounded-full border border-cyan-500/30 bg-cyan-900/10 text-cyan-400 text-xs font-mono tracking-[0.2em] uppercase animate-pulse">
                  Neural Link Established
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">Select Operation</h1>
              <p className="text-slate-400 max-w-lg mx-auto">
                  Choose your active hackathon environment to load context, rules, and AI personas.
              </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
              {/* Option 1: Current Event */}
              <div 
                  onClick={() => handleEventSelect(false)}
                  className="group relative h-80 bg-slate-900/50 border border-slate-700 hover:border-cyan-500 rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] overflow-hidden"
              >
                  <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                      <svg className="w-12 h-12 text-cyan-500/20 group-hover:text-cyan-500 transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                  </div>
                  <div className="mt-auto h-full flex flex-col justify-end">
                      <div className="text-xs font-mono text-cyan-400 mb-2">STATUS: ACTIVE</div>
                      <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-300">Google Solution Challenge 2025</h3>
                      <p className="text-slate-400 text-sm">
                          Build solutions for the UN Sustainable Development Goals using Google technology.
                      </p>
                  </div>
                  <div className="absolute inset-0 border-2 border-cyan-500/0 group-hover:border-cyan-500/50 rounded-2xl transition-all duration-500"></div>
              </div>

              {/* Option 2: Future Event */}
              <div 
                  onClick={() => handleEventSelect(true)}
                  className="group relative h-80 bg-slate-950 border border-slate-800 hover:border-purple-500 rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] overflow-hidden"
              >
                  <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                      <svg className="w-12 h-12 text-purple-500/20 group-hover:text-purple-500 transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4z"/></svg>
                  </div>
                  <div className="mt-auto h-full flex flex-col justify-end">
                      <div className="text-xs font-mono text-purple-400 mb-2">STATUS: SIMULATION / PRE-ALPHA</div>
                      <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-purple-300">DeepMind Challenge 2026</h3>
                      <p className="text-slate-400 text-sm">
                          Next-gen AGI development for scientific breakthroughs using Gemini Ultra 2.0.
                      </p>
                  </div>
                  <div className="absolute inset-0 border-2 border-purple-500/0 group-hover:border-purple-500/50 rounded-2xl transition-all duration-500"></div>
              </div>
          </div>
          
          <div className="mt-12 flex gap-4">
               <Button variant="ghost" onClick={onLogout}>Exit System</Button>
          </div>
      </div>
  );

  const renderTriage = () => (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 animate-fade-in-up">
          <div className="w-full max-w-5xl">
              <div className="flex justify-between items-center mb-8">
                <button 
                    onClick={() => setPhase('SELECT_EVENT')} 
                    className="text-xs font-mono text-slate-500 hover:text-white flex items-center gap-2 transition-colors"
                >
                    ← BACK TO MISSION SELECT
                </button>
              </div>
              
              <div className="mb-12">
                  <h1 className="text-3xl font-bold text-white mb-2">
                      <span className="text-slate-500 mr-3">Welcome to</span> 
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">{activeConfig.name}</span>
                  </h1>
                  <p className="text-xl text-slate-400">Identify your immediate bottleneck.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Card 1: Chat */}
                  <div 
                      onClick={() => handleToolSelect('CHAT')}
                      className="group bg-slate-900 border border-slate-800 hover:border-cyan-400 p-8 rounded-xl cursor-pointer transition-all hover:bg-slate-800 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)] flex flex-col gap-4"
                  >
                      <div className="w-12 h-12 rounded-lg bg-cyan-900/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                      </div>
                      <div>
                          <h3 className="text-xl font-bold text-white group-hover:text-cyan-300">Architect & Build</h3>
                          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                              I need a technical co-founder to brainstorm features, write code, or explain complex concepts.
                          </p>
                      </div>
                  </div>

                  {/* Card 2: Debug */}
                  <div 
                      onClick={() => handleToolSelect('DEBUG')}
                      className="group bg-slate-900 border border-slate-800 hover:border-yellow-500 p-8 rounded-xl cursor-pointer transition-all hover:bg-slate-800 hover:shadow-[0_0_20px_rgba(234,179,8,0.1)] flex flex-col gap-4"
                  >
                      <div className="w-12 h-12 rounded-lg bg-yellow-900/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400 group-hover:scale-110 transition-transform">
                           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                      </div>
                      <div>
                          <h3 className="text-xl font-bold text-white group-hover:text-yellow-300">Multimodal Debug</h3>
                          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                              I am stuck. Scan my screen recording or analyze error logs to find the root cause.
                          </p>
                      </div>
                  </div>

                  {/* Card 3: Pitch */}
                  <div 
                      onClick={() => handleToolSelect('PITCH')}
                      className="group bg-slate-900 border border-slate-800 hover:border-pink-500 p-8 rounded-xl cursor-pointer transition-all hover:bg-slate-800 hover:shadow-[0_0_20px_rgba(236,72,153,0.1)] flex flex-col gap-4"
                  >
                      <div className="w-12 h-12 rounded-lg bg-pink-900/20 border border-pink-500/30 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                      </div>
                      <div>
                          <h3 className="text-xl font-bold text-white group-hover:text-pink-300">Pitch Simulator</h3>
                          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                              Critique my demo video against judging criteria before I submit.
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );

  const renderWorkspace = () => (
    <div className="min-h-screen bg-slate-950 text-white flex overflow-hidden relative animate-fade-in">
      {/* Sidebar (Collapsed by default on mobile) */}
      <div className={`flex-shrink-0 bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-72' : 'w-16'}`}>
          <div className="p-4 flex items-center justify-between border-b border-slate-800 h-16">
              {sidebarOpen && <h2 className="font-bold text-slate-100 truncate text-sm tracking-wide">MISSION BRIEF</h2>}
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-400 hover:text-white rounded hover:bg-slate-800">
                  <svg className={`w-5 h-5 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path></svg>
              </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
              {sidebarOpen ? (
                  <>
                    <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase text-slate-500 font-bold">Current Objective</label>
                        <div className="text-xs text-slate-300 italic pl-3 border-l-2 border-cyan-500 leading-relaxed whitespace-pre-wrap">
                            {activeConfig.vision}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase text-slate-500 font-bold">Knowledge Context</label>
                        <div className="space-y-2">
                             {activeConfig.files.map((f, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs bg-slate-800 p-2 rounded text-slate-300 border border-slate-700">
                                    <svg className="w-3 h-3 text-cyan-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    <span className="truncate">{f.name}</span>
                                </div>
                            ))}
                            {activeConfig.youtubeLinks.map((l, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs bg-slate-800 p-2 rounded text-slate-300 border border-slate-700">
                                    <svg className="w-3 h-3 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                                    <span className="truncate">External Reference {i+1}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                  </>
              ) : (
                  <div className="flex flex-col gap-4 items-center mt-4">
                      <div className="w-8 h-8 rounded-full bg-cyan-900/50 flex items-center justify-center text-cyan-400 font-bold text-xs" title="Vision Loaded">V</div>
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs" title="Files">{activeConfig.files.length}</div>
                  </div>
              )}
          </div>
          
          <div className="p-4 border-t border-slate-800">
             <Button variant="ghost" onClick={onLogout} className={`w-full ${!sidebarOpen && 'px-0'}`}>
                 {sidebarOpen ? 'Exit' : 'X'}
             </Button>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-slate-950">
         {/* Navigation Header */}
         <header className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shrink-0 z-10">
             <div className="flex items-center gap-6">
                 <button onClick={() => setPhase('TRIAGE')} className="text-slate-500 hover:text-white transition-colors">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                 </button>
                 <div>
                     <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                        {activeConfig.name}
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                     </h1>
                 </div>
             </div>

             <div className="flex items-center gap-4">
                 {/* Tools Tab Bar */}
                 <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                     <button 
                        onClick={() => setActiveTool('CHAT')}
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTool === 'CHAT' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                     >
                         BUILD
                     </button>
                     <button 
                        onClick={() => setActiveTool('DEBUG')}
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTool === 'DEBUG' ? 'bg-yellow-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                     >
                         DEBUG
                     </button>
                     <button 
                        onClick={() => setActiveTool('PITCH')}
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTool === 'PITCH' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                     >
                         PITCH
                     </button>
                 </div>
             </div>
         </header>

         {/* Workspace Body */}
         <div className="flex-1 overflow-hidden relative bg-slate-950">
             <div className="absolute inset-0 p-6 flex flex-col">
                 
                 {activeTool === 'CHAT' && (
                     <div className="h-full flex flex-col animate-fade-in">
                        <div className="mb-2 flex items-center justify-between">
                            <h2 className="text-cyan-400 font-mono text-sm uppercase tracking-wider">Architectural Co-Pilot</h2>
                            <span className="text-[10px] text-slate-600">GEMINI-3-PRO CONNECTED</span>
                        </div>
                        <div className="flex-1 min-h-0 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                             <ChatInterface config={activeConfig} />
                        </div>
                     </div>
                 )}

                 {activeTool === 'DEBUG' && (
                     <div className="h-full flex flex-col animate-fade-in">
                        <div className="mb-2 flex items-center justify-between">
                            <h2 className="text-yellow-400 font-mono text-sm uppercase tracking-wider">Visual Diagnostics</h2>
                            <span className="text-[10px] text-slate-600">MULTIMODAL ANALYSIS READY</span>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                             <DebugConsole />
                        </div>
                     </div>
                 )}

                 {activeTool === 'PITCH' && (
                     <div className="h-full flex flex-col animate-fade-in">
                        <div className="mb-2 flex items-center justify-between">
                            <h2 className="text-pink-400 font-mono text-sm uppercase tracking-wider">Presentation Simulator</h2>
                            <span className="text-[10px] text-slate-600">JUDGING CRITERIA LOADED</span>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                             <PitchCritique config={activeConfig} />
                        </div>
                     </div>
                 )}

             </div>
         </div>
      </div>
    </div>
  );

  // Main Render Switch
  if (phase === 'SELECT_EVENT') return renderEventSelection();
  if (phase === 'TRIAGE') return renderTriage();
  return renderWorkspace();
};

export default ParticipantDashboard;
