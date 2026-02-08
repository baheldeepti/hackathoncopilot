
import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input, TextArea } from './ui/Input';
import { HackathonConfig } from '../types';
import { saveAsset, getAsset } from '../services/storageService';
import { generateFounderSpeech, checkApiHealth } from '../services/geminiService';

interface FounderDashboardProps {
  onPublish: (config: HackathonConfig) => void;
  onLogout: () => void;
}

const VOICES = [
    { name: 'Fenrir', desc: 'Male, Energetic, Professional', type: 'male' },
    { name: 'Puck', desc: 'Male, Deep, Narrative', type: 'male' },
    { name: 'Charon', desc: 'Male, Authoritative, Deep', type: 'male' },
    { name: 'Kore', desc: 'Female, Calm, Soothing', type: 'female' },
    { name: 'Zephyr', desc: 'Female, Energetic, Bright', type: 'female' },
];

const FounderDashboard: React.FC<FounderDashboardProps> = ({ onPublish, onLogout }) => {
  const [name, setName] = useState(() => localStorage.getItem('hc_founder_name') || '');
  const [vision, setVision] = useState(() => localStorage.getItem('hc_founder_vision') || '');
  
  useEffect(() => { localStorage.setItem('hc_founder_name', name); }, [name]);
  useEffect(() => { localStorage.setItem('hc_founder_vision', vision); }, [vision]);

  const [files, setFiles] = useState<File[]>(() => {
    if (!localStorage.getItem('hc_founder_name')) return [];
    try {
        const techDoc = new File([`# TECHNICAL STACK SPECIFICATION\n\n## Frontend Architecture\n- **Framework**: Flutter (Stable Channel)\n- **Language**: Dart 3.0+\n- **Design System**: Material 3\n- **State Management**: Riverpod or Bloc\n\n## Backend Services (Firebase)\n- **Authentication**: Google Sign-In & Anonymous Auth\n- **Database**: Cloud Firestore (NoSQL)\n- **Storage**: Firebase Cloud Storage (for video demos)\n- **Hosting**: Firebase Hosting\n\n## AI Integration\n- **Model**: Gemini 1.5 Pro / Gemini 3 Pro (Preview)\n- **SDK**: google_generative_ai\n- **Capabilities**: Multimodal reasoning (Text, Image, Video)\n`], "Tech_Stack_Architecture.md", { type: "text/markdown" });
        const guideDoc = new File([`# STEP-BY-STEP IMPLEMENTATION GUIDE\n\n## Phase 1: Environment Setup\n1. Install Flutter SDK & VS Code.\n2. Activate Gemini API Key in Google AI Studio.\n3. Run \`flutter pub add google_generative_ai\`.\n\n## Phase 2: Core Features\n1. **Chat Module**: Create a stream-based chat UI connected to \`GenerativeModel\`.\n2. **Camera Logic**: Use \`image_picker\` to capture frames for the Vision model.\n3. **Video Upload**: Compress video using \`ffmpeg_kit\` before sending to API.\n\n## Phase 3: Deployment\n1. Build for Web: \`flutter build web --wasm\`.\n2. Deploy: \`firebase deploy\`.\n`], "Implementation_Guide_v1.md", { type: "text/markdown" });
        const debugDoc = new File([`# DEBUGGING HANDBOOK\n\n## Common Gemini API Errors\n- **403 Forbidden**: API Key is missing or project has billing disabled.\n- **400 Bad Request**: Image too large (compress to < 4MB) or invalid MIME type.\n- **FinishReason.SAFETY**: Content violated safety filters. Adjust threshold settings in \`GenerationConfig\`.\n\n## Flutter/Firebase Issues\n- **"No App [DEFAULT]"**: Call \`Firebase.initializeApp()\` in \`main.dart\`.\n- **CocoaPods Error**: Delete \`Podfile.lock\` and run \`pod install --repo-update\`.\n`], "Debugging_Master_Guide.md", { type: "text/markdown" });
        return [techDoc, guideDoc, debugDoc];
    } catch (e) { return []; }
  });

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null); 
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isAvatarSaved, setIsAvatarSaved] = useState(false);

  // Missing States & Refs restored here
  const [newLink, setNewLink] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Voice State
  const [selectedVoice, setSelectedVoice] = useState('Fenrir');
  const [isVoiceTesting, setIsVoiceTesting] = useState(false);

  // Health Check State
  const [healthStatus, setHealthStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');

  const [youtubeLinks, setYoutubeLinks] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem('hc_founder_links');
          return saved ? JSON.parse(saved) : [];
      } catch(e) { return []; }
  });
  
  useEffect(() => { localStorage.setItem('hc_founder_links', JSON.stringify(youtubeLinks)); }, [youtubeLinks]);

  // Load assets logic...
  useEffect(() => {
    const loadAssets = async () => {
        const storedAvatar = await getAsset('hc_avatar');
        if (storedAvatar && !avatarFile) {
            const file = new File([storedAvatar], "founder_avatar.png", { type: storedAvatar.type });
            setAvatarFile(file);
        }
    };
    loadAssets();
  }, []);

  useEffect(() => {
    const fileToShow = pendingAvatarFile || avatarFile;
    if (fileToShow) {
        const url = URL.createObjectURL(fileToShow);
        setAvatarPreview(url);
        return () => URL.revokeObjectURL(url);
    } else {
        setAvatarPreview(null);
    }
  }, [avatarFile, pendingAvatarFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
          alert("Invalid file format. Please upload a JPG, PNG, or WebP image.");
          e.target.value = '';
          return;
      }

      if (file.size > 5 * 1024 * 1024) { 
          alert("File is too large. Please upload an image under 5MB for optimal performance.");
          e.target.value = '';
          return;
      }

      setPendingAvatarFile(file);
    }
  };

  const handleAvatarUpdate = async () => {
      if (!pendingAvatarFile) return;
      const file = pendingAvatarFile;
      setAvatarFile(file);
      setPendingAvatarFile(null);
      await saveAsset('hc_avatar', file);
      setIsAvatarSaved(true);
      setTimeout(() => setIsAvatarSaved(false), 3000);
  };

  const handleCancelUpdate = () => {
      setPendingAvatarFile(null);
  };

  const playRawAudio = (base64Data: string) => {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
  };

  const handleTestVoice = async (voiceName: string) => {
    if (isVoiceTesting) return;
    setIsVoiceTesting(true);
    try {
        const text = `This is ${voiceName}. System Check. Voice Synthesis Module Online.`;
        const audioBase64 = await generateFounderSpeech(text, voiceName);
        if (audioBase64) {
            playRawAudio(audioBase64);
        }
    } catch (e) {
        console.error("Voice test failed", e);
        alert("Failed to generate voice. Check API key.");
    } finally {
        setIsVoiceTesting(false);
    }
  };
  
  const handleCheckHealth = async () => {
      setHealthStatus('checking');
      const isHealthy = await checkApiHealth();
      setHealthStatus(isHealthy ? 'ok' : 'error');
  };

  const handleAddLink = () => {
    if (newLink) {
      setYoutubeLinks([...youtubeLinks, newLink]);
      setNewLink('');
    }
  };

  const handlePublish = () => {
    setIsPublishing(true);
    setTimeout(() => {
      onPublish({ 
          name, 
          vision, 
          files, 
          avatarFile, 
          youtubeLinks, 
          isPublished: true, 
          founderVoice: selectedVoice
      });
      setIsPublishing(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12 max-w-6xl mx-auto">
      <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
        <div>
            <h2 className="text-3xl font-bold text-cyan-400">Founder Control Deck</h2>
            <p className="text-slate-500 font-mono text-sm mt-1">Initialize Hackathon Parameters</p>
        </div>
        <div className="flex gap-4">
            <Button 
                variant="warning" 
                onClick={handleCheckHealth} 
                isLoading={healthStatus === 'checking'}
                className="text-xs"
            >
                {healthStatus === 'idle' && 'Check API Health'}
                {healthStatus === 'checking' && 'Checking Quota...'}
                {healthStatus === 'ok' && 'API Status: HEALTHY'}
                {healthStatus === 'error' && 'API Status: ERROR / QUOTA'}
            </Button>
            <Button variant="ghost" onClick={onLogout}>Exit Session</Button>
        </div>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
             <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-8 bg-cyan-500 rounded-sm"></span>
                Core Information
             </h3>
             <div className="space-y-6">
                <Input label="Hackathon Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Global AI Hackathon 2025" />
                <TextArea label="Vision Statement & Rules" value={vision} onChange={(e) => setVision(e.target.value)} className="min-h-[150px]" placeholder="Describe the mission, judging criteria, and rules..." />
                
                <div className="flex gap-2 items-end">
                    <Input 
                        label="Reference Links (YouTube/Docs)" 
                        placeholder="https://..." 
                        value={newLink} 
                        onChange={(e) => setNewLink(e.target.value)} 
                    />
                    <Button onClick={handleAddLink} disabled={!newLink} className="mb-2">Add</Button>
                </div>
                {youtubeLinks.length > 0 && (
                    <div className="space-y-2">
                        {youtubeLinks.map((link, i) => (
                            <div key={i} className="flex justify-between items-center text-xs bg-slate-900 p-2 rounded border border-slate-700">
                                <span className="truncate flex-1">{link}</span>
                                <button onClick={() => setYoutubeLinks(youtubeLinks.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 ml-2">Remove</button>
                            </div>
                        ))}
                    </div>
                )}
             </div>
          </div>
          
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
             <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-8 bg-pink-500 rounded-sm"></span>
                Founder 'Clone' Knowledge Base
             </h3>
             <div className="space-y-6">
                 {/* Top Row: Avatar and Voice Selector */}
                 <div className="flex flex-col gap-6">
                    
                    {/* Avatar Upload */}
                    <div className="flex items-center gap-6 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50 transition-all hover:border-pink-500/50 hover:bg-slate-900/60 hover:shadow-[0_0_20px_rgba(236,72,153,0.1)] group">
                        <div className="relative w-24 h-24 flex-shrink-0">
                            <div className={`w-full h-full rounded-full overflow-hidden border-2 transition-all duration-500 ${avatarPreview ? 'border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.4)]' : 'border-slate-600 bg-slate-800'}`}>
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Founder Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                                        <svg className="w-8 h-8 text-slate-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <label className="text-sm font-bold text-pink-400 uppercase tracking-widest block mb-1">
                                        Digital Twin Identity
                                    </label>
                                    <p className="text-xs text-slate-400 mb-4 max-w-sm leading-relaxed">
                                        Upload a high-resolution photo. This trains the <strong>Veo</strong> model.
                                        <br/><span className="text-[10px] text-slate-500">(Max 5MB • PNG/JPG)</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {!pendingAvatarFile ? (
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-pink-600 text-slate-300 hover:text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-all border border-slate-600 hover:border-pink-500 hover:shadow-lg">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                            {avatarFile ? 'Replace' : 'Upload Image'}
                                            <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleAvatarSelect} className="hidden" />
                                        </label>
                                    </div>
                                ) : (
                                    <div className="flex gap-3 animate-fade-in items-center">
                                        <Button onClick={handleAvatarUpdate} className="bg-pink-600 hover:bg-pink-500 border-pink-500 text-white px-5 py-2 text-xs">Update Avatar</Button>
                                        <button onClick={handleCancelUpdate} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white">Cancel</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Voice Selection Panel - EXPANDED */}
                    <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
                         <div className="mb-4 flex items-center justify-between">
                            <div>
                                <label className="text-sm font-bold text-indigo-400 uppercase tracking-widest block mb-1">
                                    Voice Profile
                                </label>
                                <p className="text-xs text-slate-400">
                                    Gemini 2.5 TTS Native Audio
                                </p>
                            </div>
                            {isVoiceTesting && <span className="text-xs text-cyan-400 animate-pulse font-mono">PLAYING AUDIO...</span>}
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {VOICES.map((v) => (
                                <div 
                                    key={v.name}
                                    onClick={() => setSelectedVoice(v.name)}
                                    className={`relative p-3 rounded-lg border cursor-pointer transition-all hover:-translate-y-1 ${selectedVoice === v.name ? 'bg-indigo-900/30 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`font-bold text-sm ${selectedVoice === v.name ? 'text-indigo-300' : 'text-slate-200'}`}>{v.name}</span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleTestVoice(v.name); }}
                                            disabled={isVoiceTesting}
                                            className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600"
                                        >
                                            Test
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-500 uppercase font-mono">{v.desc}</p>
                                    
                                    {selectedVoice === v.name && (
                                        <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_5px_currentColor]"></div>
                                    )}
                                </div>
                            ))}
                         </div>
                    </div>
                 </div>
             </div>
          </div>
          
           {/* General File Upload */}
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
             <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-8 bg-indigo-500 rounded-sm"></span>
                Additional Documents (RAG)
             </h3>
             <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:border-cyan-500/50 transition-colors bg-slate-900/30">
                <label className="block cursor-pointer">
                  <span className="text-cyan-400 hover:text-cyan-300 font-medium">Upload files</span>
                  <span className="text-slate-400"> (PDFs, Markdown, Code)</span>
                  <input type="file" multiple className="hidden" onChange={handleFileChange} accept=".pdf,.mp4,.mp3,.txt,.md,.json,.dart,.ts,.tsx" />
                </label>
             </div>
             {files.length > 0 && (
                <div className="mt-4 space-y-2">
                    {files.map((f, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-800/50 p-3 rounded border border-slate-700">
                            <span className="text-sm text-slate-300 truncate">{f.name}</span>
                            <span className="text-xs text-slate-500 font-mono">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                    ))}
                </div>
             )}
          </div>
        </div>

        {/* Right Col: Health Map & Action */}
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-2">Ready to Launch?</h3>
                <p className="text-slate-400 text-sm mb-6">
                    Copilot will ingest all {files.length} files into the Gemini 1M token context window.
                </p>
                <Button 
                    className="w-full" 
                    onClick={handlePublish}
                    isLoading={isPublishing}
                    disabled={!name || !vision}
                >
                    Publish Knowledge
                </Button>
            </div>
            
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                <h3 className="text-sm font-mono text-slate-400 uppercase mb-4 tracking-wider border-b border-slate-800 pb-2">Knowledge Health Map</h3>
                <div className="space-y-4">
                    {files.length === 0 && youtubeLinks.length === 0 && !avatarFile && <p className="text-xs text-slate-600 italic">No knowledge sources yet.</p>}
                    
                    {avatarFile && (
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_currentColor]"></div>
                            <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                    <span className="text-xs text-slate-300">Digital Twin Avatar</span>
                                    <span className="text-[10px] text-slate-500 font-mono">100% READY</span>
                                </div>
                                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-pink-500 opacity-70 w-full"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex items-center gap-3">
                         <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] bg-indigo-500"></div>
                         <div className="flex-1">
                             <div className="flex justify-between mb-1">
                                 <span className="text-xs text-slate-300">Voice System</span>
                                 <span className="text-[10px] font-mono font-bold uppercase text-cyan-400">
                                     {selectedVoice}
                                 </span>
                             </div>
                             <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full opacity-70 w-full bg-indigo-500"></div>
                             </div>
                         </div>
                    </div>

                    {[...files, ...youtubeLinks].slice(0, 5).map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                            <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                    <span className="text-xs text-slate-300 truncate w-32">{typeof item === 'string' ? 'YouTube Link' : item.name}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">INGESTED</span>
                                </div>
                                <div className="h-1 w-full bg-slate-800 rounded-full">
                                    <div className="h-full bg-cyan-500 opacity-70 w-full"></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default FounderDashboard;
