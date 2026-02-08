
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input, TextArea } from './ui/Input';
import { HackathonConfig, AppView } from '../types';
import { saveAsset, getAsset, clearAsset } from '../services/storageService';
import { generateFounderSpeech, checkApiHealth, analyzeVoiceMatch, createElevenLabsVoice, validateAudioForCloning } from '../services/geminiService';

interface FounderDashboardProps {
  onPublish: (config: HackathonConfig) => void;
  onLogout: () => void;
}

const VOICES = [
    { name: 'Fenrir', desc: 'Male, Energetic' },
    { name: 'Puck', desc: 'Male, Deep' },
    { name: 'Charon', desc: 'Male, Authoritative' },
    { name: 'Kore', desc: 'Female, Calm' },
    { name: 'Zephyr', desc: 'Female, Energetic' },
];

const TRAINING_SCRIPT = `
"Hello everyone. I am the lead organizer for this hackathon.
We are looking for innovation, technical depth, and real-world impact.
Remember to focus on the user problem, not just the technology.
I am here to guide you through the process, debug your code, and refine your pitch.
Let's build something amazing together."
`;

const FounderDashboard: React.FC<FounderDashboardProps> = ({ onPublish, onLogout }) => {
  // Config loaded from local storage OR empty (handled by App.tsx clearing storage on SignUp)
  const [name, setName] = useState(() => localStorage.getItem('hc_founder_name') || '');
  const [vision, setVision] = useState(() => localStorage.getItem('hc_founder_vision') || '');
  
  useEffect(() => { localStorage.setItem('hc_founder_name', name); }, [name]);
  useEffect(() => { localStorage.setItem('hc_founder_vision', vision); }, [vision]);

  const [files, setFiles] = useState<File[]>(() => {
    // Only load sample docs if we are in a session that already has a name set (Implies Demo or Returning User)
    // If it's a blank name (New User), we start empty.
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
  const [isRecording, setIsRecording] = useState(false);
  const [briefingVideoUrl, setBriefingVideoUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  // Voice State
  const [voiceMode, setVoiceMode] = useState<'standard' | 'clone'>('standard');
  const [selectedVoice, setSelectedVoice] = useState('Fenrir');
  const [isVoiceTesting, setIsVoiceTesting] = useState(false);
  const [isAutoMatchingVoice, setIsAutoMatchingVoice] = useState(false);

  // Audio Quality Analysis State
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [audioQuality, setAudioQuality] = useState<{score: number, issues: string[], suitable: boolean} | null>(null);

  // ElevenLabs State
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState('');
  const [isElevenLabsTesting, setIsElevenLabsTesting] = useState(false);
  const [isCreatingClone, setIsCreatingClone] = useState(false);

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
        const storedBriefing = await getAsset('hc_briefing');
        if (storedBriefing) {
            const file = new File([storedBriefing], "founder_briefing_rec.webm", { type: storedBriefing.type });
            setFiles(prev => {
                if (prev.some(f => f.name === file.name)) return prev;
                return [...prev, file];
            });
            setBriefingVideoUrl(URL.createObjectURL(storedBriefing));
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
      
      // Validation Logic
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
          alert("Invalid file format. Please upload a JPG, PNG, or WebP image.");
          e.target.value = ''; // Reset input
          return;
      }

      // 5MB Limit
      if (file.size > 5 * 1024 * 1024) { 
          alert("File is too large. Please upload an image under 5MB for optimal performance.");
          e.target.value = ''; // Reset input
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
      // Robust decoding for both MP3 (ElevenLabs) and PCM (Gemini)
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Try native decode first (Works for MP3/WAV/AAC)
      ctx.decodeAudioData(bytes.buffer.slice(0), (buffer) => {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
      }, (err) => {
          // Fallback for Raw PCM (Gemini default)
          const dataInt16 = new Int16Array(bytes.buffer);
          const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
          const channelData = buffer.getChannelData(0);
          for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
      });
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

  const handleCreateClone = async () => {
      // Refresh files list from state to ensure we have the latest
      const briefingFile = files.find(f => f.name === 'founder_briefing_rec.webm');
      
      if (!briefingFile) {
          alert("Audio Sample Missing: Please record a Briefing Video in the left panel first.");
          return;
      }
      if (!elevenLabsKey) {
          alert("Credentials Missing: Please enter your ElevenLabs API Key.");
          return;
      }

      setIsCreatingClone(true);
      try {
          const newVoiceId = await createElevenLabsVoice(elevenLabsKey, name, briefingFile);
          setElevenLabsVoiceId(newVoiceId);
          alert("Clone Successful! The voice is now active.");
      } catch (e: any) {
          console.error("Clone creation failed", e);
          alert(`Clone Failed: ${e.message}`);
      } finally {
          setIsCreatingClone(false);
      }
  };

  const handleTestElevenLabs = async () => {
      if (!elevenLabsKey || !elevenLabsVoiceId) return;
      setIsElevenLabsTesting(true);
      try {
          const text = "Neural Link Established. This is your digital clone speaking via Eleven Labs.";
          const audioBase64 = await generateFounderSpeech(text, '', { apiKey: elevenLabsKey, voiceId: elevenLabsVoiceId });
          if (audioBase64) {
             playRawAudio(audioBase64);
          }
      } catch (e) {
          console.error(e);
          alert("ElevenLabs Test Failed. Check API Key/Voice ID.");
      } finally {
          setIsElevenLabsTesting(false);
      }
  };

  const handleAutoMatchVoice = async () => {
      const briefingFile = files.find(f => f.name === 'founder_briefing_rec.webm');
      if (!briefingFile) {
          alert("Please record a Briefing Video first so the AI can hear your voice.");
          return;
      }
      setIsAutoMatchingVoice(true);
      try {
          const matchedVoice = await analyzeVoiceMatch(briefingFile);
          setSelectedVoice(matchedVoice);
      } catch (e) {
          console.error("Voice match failed", e);
          alert(`Could not analyze audio. Please try manually selecting a voice. (${e instanceof Error ? e.message : 'Unknown Error'})`);
      } finally {
          setIsAutoMatchingVoice(false);
      }
  };
  
  const handleAnalyzeAudioQuality = async () => {
      const briefingFile = files.find(f => f.name === 'founder_briefing_rec.webm');
      if (!briefingFile) return;

      setIsAnalyzingAudio(true);
      try {
          const analysis = await validateAudioForCloning(briefingFile);
          setAudioQuality(analysis);
      } catch (e) {
          console.error("Analysis failed", e);
          alert("Audio analysis failed.");
      } finally {
          setIsAnalyzingAudio(false);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      mediaRecorder.start();
      setIsRecording(true);
      setAudioQuality(null); // Reset previous quality checks
    } catch (err) {
      alert("Could not access camera/microphone. Check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      if (videoRef.current && videoRef.current.srcObject) {
         const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
         tracks.forEach(track => track.stop());
         videoRef.current.srcObject = null;
      }
      setIsRecording(false);
      // Wait for data to be available
      setTimeout(async () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const file = new File([blob], "founder_briefing_rec.webm", { type: 'video/webm' });
          
          // Force state update to include new file immediately
          setFiles(prev => {
              const others = prev.filter(f => f.name !== file.name);
              return [...others, file];
          });
          
          recordedChunksRef.current = [];
          await saveAsset('hc_briefing', blob);
          setBriefingVideoUrl(URL.createObjectURL(blob));
      }, 500);
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
          founderVoice: voiceMode === 'clone' ? 'ElevenLabs' : selectedVoice,
          elevenLabsKey: voiceMode === 'clone' ? elevenLabsKey : undefined,
          elevenLabsVoiceId: voiceMode === 'clone' ? elevenLabsVoiceId : undefined
      });
      setIsPublishing(false);
    }, 1500);
  };

  const playRecordedBriefing = () => {
      if (briefingVideoUrl && videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.src = briefingVideoUrl;
          videoRef.current.play();
      }
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
                
                {/* Manual Link Input UI restored */}
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
                 {/* Top Row: Avatar and Briefing */}
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

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Live Record Panel */}
                    <div className="border border-slate-700 rounded-lg p-4 bg-slate-950/50 flex flex-col items-center relative overflow-hidden">
                        <div className="w-full bg-slate-900 px-3 py-2 rounded-t-lg border-b border-slate-800 flex justify-between items-center mb-2 z-10">
                            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Source Audio Input</span>
                            <div className={`w-2 h-2 rounded-full ${briefingVideoUrl ? 'bg-green-500 shadow-[0_0_5px_green]' : 'bg-red-500 shadow-[0_0_5px_red]'}`}></div>
                        </div>
                        
                        <div className="w-full aspect-video bg-black rounded mb-4 overflow-hidden relative border border-slate-800 group">
                            <video ref={videoRef} autoPlay muted={isRecording} controls={!isRecording} className="w-full h-full object-cover" />
                            {isRecording && (
                                <>
                                    <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red] z-20"></div>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/60 backdrop-blur-sm z-10 p-6">
                                        <div className="text-center text-white">
                                            <p className="text-[10px] text-pink-400 font-mono mb-2 uppercase tracking-widest">Training Script</p>
                                            <p className="text-lg font-serif italic leading-relaxed text-slate-200">
                                                {TRAINING_SCRIPT}
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-4">(Read clearly and naturally)</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        
                        {!isRecording ? (
                            <div className="flex gap-2 w-full">
                                <Button onClick={startRecording} className="flex-1 text-xs">
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                    Rec Briefing
                                </Button>
                                {briefingVideoUrl && (
                                    <Button onClick={playRecordedBriefing} variant="secondary" className="flex-1 text-xs">
                                        Review
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Button onClick={stopRecording} variant="danger" className="w-full">
                                Stop & Save
                            </Button>
                        )}
                        <p className="text-[9px] text-slate-500 mt-2 text-center">
                            This audio is used to train your Neural Voice Clone.
                        </p>
                    </div>
                    
                    {/* Voice Selection Panel - REDESIGNED */}
                    <div className="border border-slate-700 rounded-lg bg-slate-950/50 flex flex-col overflow-hidden">
                        {/* Tab Switcher */}
                        <div className="flex border-b border-slate-800">
                            <button 
                                onClick={() => setVoiceMode('standard')}
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${voiceMode === 'standard' ? 'bg-slate-800 text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
                            >
                                Option A: Gemini Presets
                            </button>
                            <button 
                                onClick={() => setVoiceMode('clone')}
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${voiceMode === 'clone' ? 'bg-slate-800 text-pink-400 border-b-2 border-pink-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
                            >
                                Option B: Custom Clone
                            </button>
                        </div>

                        {/* Standard Mode */}
                        {voiceMode === 'standard' && (
                            <div className="p-4 flex-1 flex flex-col">
                                <div className="mb-4">
                                    <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                                        <strong className="text-cyan-400">Low Latency • High Stability.</strong><br/>
                                        Selects the pre-built Gemini voice that best matches the tone of your recording. <span className="text-slate-500">(Not a clone)</span>
                                    </p>
                                </div>

                                {/* ACTIVE CONFIGURATION INDICATOR */}
                                <div className="mb-4 bg-cyan-900/10 border border-cyan-500/30 p-3 rounded-lg flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-mono text-cyan-400 uppercase tracking-wider mb-1">Active Selection</p>
                                        <p className="text-sm font-bold text-white flex items-center gap-2">
                                            {selectedVoice}
                                            <span className="text-[10px] font-normal text-slate-400 opacity-80">
                                                ({VOICES.find(v => v.name === selectedVoice)?.desc})
                                            </span>
                                        </p>
                                    </div>
                                    <Button 
                                        onClick={() => handleTestVoice(selectedVoice)}
                                        disabled={isVoiceTesting}
                                        className="h-8 px-3 text-[10px] bg-cyan-600 hover:bg-cyan-500 border-none shadow-none"
                                    >
                                        {isVoiceTesting ? 'Playing...' : 'Test Audio'}
                                    </Button>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[140px] mb-3 space-y-2">
                                    {VOICES.map((v) => (
                                        <div 
                                            key={v.name}
                                            onClick={() => setSelectedVoice(v.name)}
                                            className={`flex items-center justify-between p-2 rounded cursor-pointer border text-xs transition-all relative ${selectedVoice === v.name ? 'bg-cyan-900/30 border-cyan-500 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.15)]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${selectedVoice === v.name ? 'border-cyan-400 bg-cyan-400' : 'border-slate-600 bg-transparent'}`}>
                                                    {selectedVoice === v.name && <div className="w-1 h-1 bg-white rounded-full"></div>}
                                                </div>
                                                <div>
                                                    <span className="font-bold block">{v.name}</span>
                                                    <span className="text-[10px] opacity-70 block">{v.desc}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Button 
                                    onClick={handleAutoMatchVoice} 
                                    disabled={!briefingVideoUrl}
                                    isLoading={isAutoMatchingVoice}
                                    className="w-full text-xs bg-slate-800 border-slate-600 hover:border-cyan-400"
                                >
                                   {isAutoMatchingVoice ? 'Analyzing Tone...' : 'Analyze & Find Closest Match'}
                                </Button>
                            </div>
                        )}

                        {/* Clone Mode */}
                        {voiceMode === 'clone' && (
                            <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
                                <div className="bg-slate-900 p-3 rounded border border-slate-800">
                                    <p className="text-[10px] text-pink-300 mb-2 leading-relaxed">
                                        <strong className="text-pink-500">Maximum Realism • Powered by ElevenLabs.</strong><br/>
                                        Trains a custom AI model on your audio sample to clone your voice.
                                    </p>
                                    
                                    <div className="space-y-2 mt-3 pt-3 border-t border-slate-800">
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span className="text-slate-400">Audio Sample</span>
                                            <span className={briefingVideoUrl ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{briefingVideoUrl ? "READY" : "MISSING"}</span>
                                        </div>
                                        
                                        {briefingVideoUrl && !elevenLabsVoiceId && (
                                            <div className="mt-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] text-slate-400">Sample Quality</span>
                                                    {audioQuality ? (
                                                        <span className={`text-[10px] font-bold ${audioQuality.suitable ? 'text-green-400' : 'text-red-400'}`}>
                                                            {audioQuality.score}/100
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-600">UNTESTED</span>
                                                    )}
                                                </div>
                                                
                                                {!audioQuality && (
                                                    <Button 
                                                        variant="secondary" 
                                                        className="w-full h-7 text-[10px] bg-slate-800 border-slate-700" 
                                                        onClick={handleAnalyzeAudioQuality}
                                                        isLoading={isAnalyzingAudio}
                                                    >
                                                        Analyze Audio Quality
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Input 
                                    placeholder="Enter ElevenLabs API Key" 
                                    className="text-xs py-1.5" 
                                    type="password"
                                    value={elevenLabsKey}
                                    onChange={(e) => setElevenLabsKey(e.target.value)}
                                />

                                {!elevenLabsVoiceId ? (
                                    <Button 
                                        variant="primary"
                                        className={`w-full text-xs py-2 shadow-none ${(!audioQuality?.suitable && audioQuality !== null) ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-pink-600 hover:bg-pink-500 border-pink-500'}`}
                                        onClick={handleCreateClone}
                                        isLoading={isCreatingClone}
                                        disabled={!elevenLabsKey || !briefingVideoUrl || (!audioQuality?.suitable && audioQuality !== null)}
                                    >
                                        {(!audioQuality?.suitable && audioQuality !== null) ? 'Quality Check Failed' : '⚡ Train Neural Voice Model'}
                                    </Button>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="p-2 bg-green-900/20 border border-green-500/30 rounded text-center">
                                            <p className="text-[10px] text-green-400 font-mono mb-1">CLONE ACTIVE</p>
                                            <p className="text-[9px] text-slate-400 break-all">{elevenLabsVoiceId}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button 
                                                variant="secondary" 
                                                className="flex-1 text-xs h-8"
                                                onClick={handleTestElevenLabs}
                                                isLoading={isElevenLabsTesting}
                                            >
                                                Test Clone
                                            </Button>
                                            <Button 
                                                variant="danger" 
                                                className="w-16 text-xs h-8 px-0"
                                                onClick={() => {
                                                    setElevenLabsVoiceId('');
                                                    setAudioQuality(null);
                                                }}
                                            >
                                                Reset
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
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
                         <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${voiceMode === 'clone' ? 'bg-pink-400' : 'bg-indigo-500'}`}></div>
                         <div className="flex-1">
                             <div className="flex justify-between mb-1">
                                 <span className="text-xs text-slate-300">Voice System</span>
                                 <span className={`text-[10px] font-mono font-bold uppercase ${voiceMode === 'clone' ? 'text-pink-400' : 'text-cyan-400'}`}>
                                     {voiceMode === 'clone' ? 'NEURAL CLONE' : selectedVoice}
                                 </span>
                             </div>
                             <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                 <div className={`h-full opacity-70 w-full ${voiceMode === 'clone' ? 'bg-pink-500' : 'bg-indigo-500'}`}></div>
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
