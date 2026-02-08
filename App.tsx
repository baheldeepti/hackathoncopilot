
import React, { useState, useEffect } from 'react';
import SplashScreen from './components/SplashScreen';
import FounderDashboard from './components/FounderDashboard';
import ParticipantDashboard from './components/ParticipantDashboard';
import { AppView, HackathonConfig } from './types';
import { getAsset, clearAsset } from './services/storageService';

function App() {
  // Load initial view from local storage
  const [currentView, setCurrentView] = useState<AppView>(() => {
    return (localStorage.getItem('hc_app_view') as AppView) || AppView.SPLASH;
  });

  const [userName, setUserName] = useState<string>('');

  // Default Sample Data (Google Solution Challenge)
  const defaultSampleConfig: HackathonConfig = {
      name: "Google Solution Challenge 2025", 
      vision: `MISSION:
Build a solution for one or more of the United Nations' 17 Sustainable Development Goals using Google technology.

JUDGING CRITERIA:
1. Impact (40%): Does it solve a real problem for a specific user?
2. Technology (40%): Implementation of Google Tech (Firebase, Flutter, Gemini, etc.).
3. Presentation (20%): Clarity of the video demo.

RULES:
- Teams of up to 4 students.
- Must submit a 2-minute demo video.
- Code must be in a public repository.`,
      files: [],
      avatarFile: null,
      youtubeLinks: [
          'https://www.youtube.com/watch?v=FxiMInC8vr0', // Solution Challenge Overview
          'https://www.youtube.com/watch?v=zRw8s71aRbw'  // How to Pitch
      ],
      isPublished: true, // Demo is published by default
      founderVoice: 'Fenrir'
  };

  const emptyConfig: HackathonConfig = {
      name: "",
      vision: "",
      files: [],
      avatarFile: null,
      youtubeLinks: [],
      isPublished: false,
      founderVoice: 'Fenrir'
  };

  // App State with Persistence logic for config (excluding files)
  const [hackathonConfig, setHackathonConfig] = useState<HackathonConfig>(() => {
    try {
      const saved = localStorage.getItem('hc_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          files: [], // Files cannot be persisted in localStorage
          avatarFile: null,
          founderVoice: parsed.founderVoice || 'Fenrir'
        };
      }
    } catch(e) {
      console.error("Failed to load config", e);
    }
    return emptyConfig;
  });

  // Save view on change
  useEffect(() => {
    localStorage.setItem('hc_app_view', currentView);
  }, [currentView]);

  // Persist config text fields when changed
  useEffect(() => {
    const { files, avatarFile, ...safeConfig } = hackathonConfig;
    localStorage.setItem('hc_config', JSON.stringify(safeConfig));
  }, [hackathonConfig]);

  // NEW: Hydrate assets from IndexedDB on startup
  useEffect(() => {
      const hydrateAssets = async () => {
          try {
              const avatarBlob = await getAsset('hc_avatar');
              const briefingBlob = await getAsset('hc_briefing');
              
              setHackathonConfig(prev => {
                  const newConfig = { ...prev };
                  let changed = false;

                  if (avatarBlob) {
                      newConfig.avatarFile = new File([avatarBlob], "founder_avatar.png", { type: avatarBlob.type });
                      changed = true;
                  }

                  if (briefingBlob) {
                      const briefingFile = new File([briefingBlob], "founder_briefing_rec.webm", { type: briefingBlob.type });
                      // Avoid duplicates
                      if (!newConfig.files.some(f => f.name === briefingFile.name)) {
                          newConfig.files = [...newConfig.files, briefingFile];
                          changed = true;
                      }
                  }

                  return changed ? newConfig : prev;
              });
          } catch (e) {
              console.error("Asset hydration failed", e);
          }
      };
      hydrateAssets();
  }, []);

  // Helper to generate a default avatar file for Demo Mode (or load from DB)
  const loadDemoAssets = async (baseConfig: HackathonConfig): Promise<HackathonConfig> => {
    const config = { ...baseConfig, files: [] as File[] };
    
    // 1. Load Persisted Avatar (IndexedDB)
    const storedAvatar = await getAsset('hc_avatar');
    if (storedAvatar) {
         config.avatarFile = new File([storedAvatar], "my_saved_founder.png", { type: storedAvatar.type });
    } else {
         // Fallback generation if no saved avatar
         const canvas = document.createElement('canvas');
         canvas.width = 512;
         canvas.height = 512;
         const ctx = canvas.getContext('2d');
         if (ctx) {
            const gradient = ctx.createLinearGradient(0, 0, 512, 512);
            gradient.addColorStop(0, '#0f172a'); 
            gradient.addColorStop(1, '#0891b2'); 
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 512, 512);
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)'; 
            ctx.lineWidth = 2;
            for(let i=0; i<10; i++) {
                ctx.beginPath();
                ctx.moveTo(0, i * 50);
                ctx.lineTo(512, i * 50 + 100);
                ctx.stroke();
            }
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 80px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('FOUNDER', 256, 256);
         }
         await new Promise<void>(resolve => {
             canvas.toBlob(b => {
                 if (b) config.avatarFile = new File([b], "default_founder.png", { type: "image/png" });
                 resolve();
             });
         });
    }

    // 2. Load Persisted Briefing Video
    const storedBriefing = await getAsset('hc_briefing');
    if (storedBriefing) {
        const videoFile = new File([storedBriefing], "founder_briefing_rec.webm", { type: storedBriefing.type });
        config.files.push(videoFile);
    }

    return config;
  };

  const handleAuth = async (role: AppView, isDemo: boolean, name: string, isSignUp: boolean) => {
      setUserName(name);
      
      if (isDemo) {
          // DEMO MODE: Load Pre-filled Data
          const configWithAssets = await loadDemoAssets(defaultSampleConfig);
          setHackathonConfig(configWithAssets);
          
          localStorage.setItem('hc_founder_name', defaultSampleConfig.name);
          localStorage.setItem('hc_founder_vision', defaultSampleConfig.vision);
          localStorage.setItem('hc_founder_links', JSON.stringify(defaultSampleConfig.youtubeLinks));
      } 
      else if (isSignUp) {
          // NEW SIGN UP: Clear previous data for a fresh start
          localStorage.removeItem('hc_config');
          localStorage.removeItem('hc_founder_name');
          localStorage.removeItem('hc_founder_vision');
          localStorage.removeItem('hc_founder_links');
          await clearAsset('hc_avatar');
          await clearAsset('hc_briefing');
          
          setHackathonConfig(emptyConfig);
      }
      // ELSE: Normal Login (Data is hydrated from localStorage via useEffects)

      setCurrentView(role);
  };

  const handleFounderPublish = (config: HackathonConfig) => {
    setHackathonConfig(config);
    alert("Hackathon Knowledge Base Published Successfully!");
  };

  const handleLogout = () => {
    setCurrentView(AppView.SPLASH);
    setUserName('');
  };

  return (
    <div className="antialiased text-slate-100 min-h-screen font-sans selection:bg-cyan-500/30 selection:text-cyan-200 relative">
      {/* App Container */}
      {currentView === AppView.SPLASH && (
        <SplashScreen onSelectRole={handleAuth} />
      )}
      
      {currentView === AppView.FOUNDER && (
        <FounderDashboard 
          onPublish={handleFounderPublish} 
          onLogout={handleLogout} 
        />
      )}

      {currentView === AppView.PARTICIPANT && (
        <ParticipantDashboard 
          config={hackathonConfig}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
