
import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { HackathonConfig, ChatMessage } from '../types';
import { createHackathonChat, sendMessageToChat, generateFounderSpeech, generateFounderVideo, blobToGenerativePart } from '../services/geminiService';
import { LiveSessionManager } from '../services/liveService';
import { Chat, GenerateContentResponse } from '@google/genai';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
  config: HackathonConfig;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ config }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
      try {
          const saved = localStorage.getItem('hc_chat_history');
          if (saved) {
              return JSON.parse(saved);
          }
      } catch (e) {
          console.error("Failed to load chat history", e);
      }
      return [{ role: 'model', text: `Hey! I'm online and contexts are loaded for "${config.name}". Ready to build?` }];
  });
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  
  // Default to Founder Mode if avatar is present
  const [founderMode, setFounderMode] = useState(!!config.avatarFile);
  const [autoVideo, setAutoVideo] = useState(false); 
  const [veoDisabled, setVeoDisabled] = useState(false); 

  // LIVE CALL STATE
  const [isLiveCallActive, setIsLiveCallActive] = useState(false);
  const [liveCallStatus, setLiveCallStatus] = useState<'connecting' | 'connected' | 'error' | null>(null);
  const [isLiveAgentSpeaking, setIsLiveAgentSpeaking] = useState(false);
  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  
  // Screen Share State
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Media Recording State (Async Messages)
  const [recordingType, setRecordingType] = useState<'audio' | 'video' | null>(null);
  const [mediaBlob, setMediaBlob] = useState<{ blob: Blob, type: 'audio' | 'video' } | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Visualizer State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  // Avatar Image URL logic
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (config.avatarFile) {
        const url = URL.createObjectURL(config.avatarFile);
        setAvatarUrl(url);
        setFounderMode(true);
        return () => URL.revokeObjectURL(url);
    }
  }, [config.avatarFile]);

  useEffect(() => {
      localStorage.setItem('hc_chat_history', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    const initChat = async () => {
        const chat = await createHackathonChat(config);
        setChatSession(chat);
    };
    initChat();
  }, [config]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (recordingStreamRef.current) recordingStreamRef.current.getTracks().forEach(t => t.stop());
        if (liveSessionRef.current) liveSessionRef.current.disconnect();
        if (webcamStreamRef.current) webcamStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const forceRefreshKey = async () => {
      try {
          // @ts-ignore
          if (window.aistudio && window.aistudio.openSelectKey) {
              // @ts-ignore
              await window.aistudio.openSelectKey();
              setVeoDisabled(false);
              setAutoVideo(true);
              alert("Key refreshed! Video generation unlocked.");
          } else {
              if(window.confirm("Confirm: Has a valid paid API key been configured in your environment?")) {
                  setVeoDisabled(false);
                  setAutoVideo(true);
                  alert("Video generation unlocked. Please retry.");
              }
          }
      } catch (e) {
          console.error(e);
          setVeoDisabled(false);
          setAutoVideo(true);
      }
  };

  // LIVE CALL FUNCTIONS
  const startLiveCall = async () => {
      setIsLiveCallActive(true);
      setLiveCallStatus('connecting');
      setIsScreenSharing(false);
      
      try {
          // Initialize Video Stream for UI (Webcam by default)
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          webcamStreamRef.current = stream;

          if (userVideoRef.current) {
              userVideoRef.current.srcObject = stream;
          }

          // Initialize Live Session
          liveSessionRef.current = new LiveSessionManager();
          await liveSessionRef.current.connect(
              config,
              (isSpeaking) => setIsLiveAgentSpeaking(isSpeaking),
              (err) => {
                  console.error(err);
                  setLiveCallStatus('error');
              }
          );
          
          setLiveCallStatus('connected');
          
          if (userVideoRef.current) {
              liveSessionRef.current.startVideoStreaming(userVideoRef.current);
          }

      } catch (e) {
          console.error("Failed to start live call", e);
          setLiveCallStatus('error');
      }
  };

  const toggleScreenShare = async () => {
      if (!userVideoRef.current) return;

      if (isScreenSharing) {
          if (webcamStreamRef.current) {
              userVideoRef.current.srcObject = webcamStreamRef.current;
              setIsScreenSharing(false);
              liveSessionRef.current?.setScreenShareMode(false);
          } else {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              webcamStreamRef.current = stream;
              userVideoRef.current.srcObject = stream;
              setIsScreenSharing(false);
              liveSessionRef.current?.setScreenShareMode(false);
          }
      } else {
          try {
              const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
              
              screenStream.getVideoTracks()[0].onended = () => {
                  if (userVideoRef.current && webcamStreamRef.current) {
                      userVideoRef.current.srcObject = webcamStreamRef.current;
                      setIsScreenSharing(false);
                      liveSessionRef.current?.setScreenShareMode(false);
                  }
              };

              userVideoRef.current.srcObject = screenStream;
              setIsScreenSharing(true);
              liveSessionRef.current?.setScreenShareMode(true);
          } catch (e) {
              console.error("Screen share failed/cancelled", e);
          }
      }
  };

  const endLiveCall = () => {
      if (liveSessionRef.current) {
          liveSessionRef.current.disconnect();
      }
      if (webcamStreamRef.current) {
          webcamStreamRef.current.getTracks().forEach(t => t.stop());
          webcamStreamRef.current = null;
      }
      if (userVideoRef.current && userVideoRef.current.srcObject) {
          const stream = userVideoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(t => t.stop());
          userVideoRef.current.srcObject = null;
      }
      setIsLiveCallActive(false);
      setLiveCallStatus(null);
      setIsScreenSharing(false);
  };

  const playAudioResponse = async (base64Audio: string) => {
    try {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') await ctx.resume();

        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const dataInt16 = new Int16Array(bytes.buffer);
        const frameCount = dataInt16.length; 
        const buffer = ctx.createBuffer(1, frameCount, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i] / 32768.0;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => setIsSpeaking(false);
        setIsSpeaking(true);
        source.start(0);
        
    } catch (e) {
        console.error("Audio playback failed completely", e);
        setIsSpeaking(false);
    }
  };

  const getSupportedMimeType = (type: 'audio' | 'video') => {
    if (type === 'video') {
        const types = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'];
        return types.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
    } else {
        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
        return types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
    }
  };

  const drawVisualizer = () => {
     if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    if (!ctx) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const draw = () => {
        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        ctx.fillStyle = '#0f172a'; // Match input bg
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2;
            ctx.fillStyle = `rgb(34, 211, 238)`; // Cyan
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    };
    draw();
  };
  
  const startRecording = async (type: 'audio' | 'video') => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
          recordingStreamRef.current = stream;
          if (type === 'audio') {
               const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
               const source = audioCtx.createMediaStreamSource(stream);
               const analyser = audioCtx.createAnalyser();
               analyser.fftSize = 256;
               source.connect(analyser);
               analyserRef.current = analyser;
               setTimeout(drawVisualizer, 100);
          }
          const mimeType = getSupportedMimeType(type);
          const recorder = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = recorder;
          chunksRef.current = [];
          recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
          recorder.onstop = () => {
              const blob = new Blob(chunksRef.current, { type: mimeType });
              setMediaBlob({ blob, type });
              setMediaPreviewUrl(URL.createObjectURL(blob));
              stream.getTracks().forEach(track => track.stop());
              recordingStreamRef.current = null;
              if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          };
          recorder.start();
          setRecordingType(type);
      } catch (e) { console.error(e); alert("Could not access recording device."); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current) { mediaRecorderRef.current.stop(); setRecordingType(null); } };
  const clearMedia = () => { setMediaBlob(null); if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl); setMediaPreviewUrl(null); };

  const checkApiKeyAndGenerateVideo = async (msgIndex: number, text: string, retryCount = 0) => {
      if (!config.avatarFile || veoDisabled) return;
      
      setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, isVideoGenerating: true, videoError: undefined } : m));
      
      try {
          const videoUrl = await generateFounderVideo(text, config.avatarFile);
          setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, isVideoGenerating: false, videoUrl } : m));
      } catch (err: any) {
          console.error(`Generation attempt ${retryCount} failed`, err);
          
          if (retryCount === 0 && (err.toString().includes('429') || (err.message && err.message.includes('quota')))) {
              try {
                  // @ts-ignore
                  if (window.aistudio && window.aistudio.openSelectKey) {
                      // @ts-ignore
                      await window.aistudio.openSelectKey();
                      setTimeout(() => checkApiKeyAndGenerateVideo(msgIndex, text, 1), 1000);
                      return;
                  }
              } catch (e) {}
          }

          let errorMsg = "Generation failed";
          if (err.toString().includes('429') || (err.message && err.message.includes('quota'))) {
              errorMsg = "Veo Quota Exceeded";
              setAutoVideo(false);
              setVeoDisabled(true); 
              setMessages(prev => [...prev, { 
                  role: 'model', 
                  text: "**[SYSTEM ALERT]** Veo video generation quota exceeded. Auto-switching to Audio-Only Mode." 
              }]);
          }
          setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, isVideoGenerating: false, videoError: errorMsg } : m));
      }
  };

  const cleanResponseText = (text: string) => text.replace(/\*\s*\(Spoken Script Mode Active\)\s*\*\*/gi, '').replace(/\(Spoken Script Mode Active\)/gi, '').trim();

  const handleRetryVideo = (index: number, text: string) => {
      if (veoDisabled) {
          forceRefreshKey(); 
          if (veoDisabled) return; 
      }
      checkApiKeyAndGenerateVideo(index, cleanResponseText(text), 0);
  };

  const handleSend = async () => {
    if ((!inputValue.trim() && !mediaBlob) || !chatSession) return;
    const userMsgText = inputValue;
    const isFounder = founderMode; 
    const shouldAutoVideo = isFounder && autoVideo && !veoDisabled;
    const modelMsgIndex = messages.length + 1; 

    setInputValue('');
    const displayMsg = userMsgText || (mediaBlob?.type === 'video' ? '[Video Message]' : '[Voice Message]');
    setMessages(prev => [...prev, { role: 'user', text: displayMsg }]);
    setIsLoading(true);

    try {
      let msgToSend: any = userMsgText;
      if (isFounder) msgToSend = `[User is speaking to their Founder/Mentor] ${userMsgText}`;
      let payload: string | Array<any> = msgToSend;
      if (mediaBlob) {
          const mimeType = mediaBlob.blob.type;
          const mediaPart = await blobToGenerativePart(mediaBlob.blob, mimeType);
          payload = [{ text: msgToSend }, mediaPart];
      }
      clearMedia();

      const result = await sendMessageToChat(chatSession, payload);
      let fullText = '';
      setMessages(prev => [...prev, { role: 'model', text: '' }]); 

      for await (const chunk of result) {
          const chunkText = (chunk as GenerateContentResponse).text;
          if (chunkText) {
              fullText += chunkText;
              const displayText = cleanResponseText(fullText);
              
              setMessages(prev => {
                  const newArr = [...prev];
                  newArr[newArr.length - 1] = { 
                      role: 'model', 
                      text: displayText.replace("[ESCALATE]", "").trim(),
                      isEscalated: displayText.includes("[ESCALATE]")
                  };
                  return newArr;
              });
          }
      }
      if (isFounder && fullText) {
         try {
             const audioData = await generateFounderSpeech(
                 fullText, 
                 config.founderVoice || 'Fenrir'
             );
             if (audioData) await playAudioResponse(audioData);
         } catch (speechErr) { console.error(speechErr); }
         if (shouldAutoVideo) checkApiKeyAndGenerateVideo(modelMsgIndex, cleanResponseText(fullText));
      }
    } catch (error) { setMessages(prev => [...prev, { role: 'model', text: "Error: Could not connect to the neural core." }]); } finally { setIsLoading(false); }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  return (
    <div className="flex flex-col h-[700px] bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative">
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center z-10 flex-wrap gap-2">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-cyan-400 animate-pulse' : 'bg-green-500'} transition-colors`}></div>
                <span className="font-mono text-sm text-cyan-400">GEMINI-3-PRO // {config.founderVoice || 'FENRIR'}</span>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
             <Button 
                onClick={startLiveCall}
                disabled={isLiveCallActive}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]"
            >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                LIVE UPLINK
            </Button>
            
            <div 
                onClick={() => setFounderMode(!founderMode)}
                className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${founderMode ? 'bg-cyan-900/50 border-cyan-500' : 'bg-slate-800 border-slate-600'}`}
            >
                <div className={`w-3 h-3 rounded-full transition-colors ${founderMode ? 'bg-cyan-400' : 'bg-slate-500'}`}></div>
                <span className={`text-xs font-bold uppercase tracking-wider ${founderMode ? 'text-cyan-300' : 'text-slate-400'}`}>
                    Founder Mode
                </span>
            </div>

            {founderMode && (
                <div 
                    onClick={() => { if (veoDisabled) forceRefreshKey(); else setAutoVideo(!autoVideo); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${veoDisabled ? 'cursor-pointer bg-red-900/30 border-red-500' : autoVideo ? 'cursor-pointer bg-pink-900/50 border-pink-500' : 'cursor-pointer bg-slate-800 border-slate-600'}`}
                >
                    <span className={`text-xs font-bold uppercase tracking-wider ${autoVideo && !veoDisabled ? 'text-pink-300' : veoDisabled ? 'text-red-400' : 'text-slate-400'}`}>
                        {veoDisabled ? 'Veo Quota' : 'Auto Video'}
                    </span>
                </div>
            )}
        </div>
      </div>

      {/* IMMERSIVE LIVE CALL HUD */}
      {isLiveCallActive && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-0 animate-fade-in overflow-hidden">
              {/* HUD GRID OVERLAY */}
              <div className="absolute inset-0 pointer-events-none opacity-20" style={{
                  backgroundImage: `linear-gradient(rgba(34, 211, 238, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.1) 1px, transparent 1px)`,
                  backgroundSize: '100px 100px'
              }}></div>
              
              {/* TOP BAR */}
              <div className="absolute top-0 w-full h-16 bg-gradient-to-b from-black via-black/80 to-transparent flex justify-between items-start p-6 z-40">
                   <div className="flex gap-4">
                       <div className="text-cyan-500 font-mono text-xs">
                           <div>SYS.CONNECTION: <span className="text-white">{liveCallStatus?.toUpperCase()}</span></div>
                           <div>LATENCY: <span className="text-white">~400ms</span></div>
                           <div>MODE: <span className="text-white">NATIVE_AUDIO_SOCKET</span></div>
                       </div>
                   </div>
                   <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></div>
                        <span className="text-red-500 font-bold tracking-widest text-sm">REC</span>
                   </div>
              </div>

              {/* MAIN CONTENT LAYER */}
              <div className="relative w-full h-full flex items-center justify-center">
                   
                   {/* CENTER AVATAR (FOUNDER) */}
                   <div className="relative z-10 transform transition-all duration-300">
                        <div className={`relative w-64 h-64 md:w-96 md:h-96 rounded-full p-1 ${isLiveAgentSpeaking ? 'border-4 border-cyan-400 shadow-[0_0_100px_rgba(34,211,238,0.4)] scale-105' : 'border-2 border-slate-800'} transition-all duration-300`}>
                            {avatarUrl ? (
                                <img src={avatarUrl} className="w-full h-full rounded-full object-cover grayscale opacity-80" />
                            ) : (
                                <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center">
                                    <svg className="w-32 h-32 text-slate-700" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                                </div>
                            )}
                            
                            {/* HOLOGRAM SCANLINES */}
                            <div className="absolute inset-0 rounded-full bg-[linear-gradient(rgba(34,211,238,0.1)_1px,transparent_1px)] bg-[size:100%_4px] opacity-30 pointer-events-none"></div>

                            {/* RING ANIMATION */}
                            {isLiveAgentSpeaking && (
                                <div className="absolute -inset-4 border border-cyan-500/50 rounded-full animate-[spin_10s_linear_infinite]"></div>
                            )}
                        </div>
                        <div className="mt-8 text-center">
                             <h3 className="text-2xl font-black text-white tracking-[0.2em] uppercase font-mono">{config.name}</h3>
                             <p className="text-cyan-500 text-xs tracking-widest mt-1">FOUNDER UPLINK ACTIVE</p>
                        </div>
                   </div>

                   {/* USER PIP (Right Side) */}
                   <div className="absolute bottom-32 right-8 w-64 aspect-video bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-2xl z-30 group">
                       <video ref={userVideoRef} autoPlay muted className={`w-full h-full object-cover ${!isScreenSharing ? 'transform scale-x-[-1]' : ''}`} />
                       <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[8px] text-white font-mono uppercase">
                           {isScreenSharing ? 'SCREEN FEED' : 'YOUR FEED'}
                       </div>
                   </div>
              </div>

              {/* BOTTOM CONTROL BAR */}
              <div className="absolute bottom-0 w-full h-24 bg-black border-t border-slate-800 flex items-center justify-center gap-8 z-50">
                  <button 
                      onClick={toggleScreenShare}
                      className={`flex flex-col items-center gap-1 group ${isScreenSharing ? 'text-yellow-400' : 'text-slate-400 hover:text-white'}`}
                  >
                      <div className={`p-3 rounded-full border transition-all ${isScreenSharing ? 'border-yellow-500 bg-yellow-500/10' : 'border-slate-700 bg-slate-900'}`}>
                           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                      </div>
                      <span className="text-[10px] font-bold tracking-widest uppercase">{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
                  </button>

                  <button 
                      onClick={endLiveCall}
                      className="flex flex-col items-center gap-1 group text-red-500 hover:text-red-400"
                  >
                      <div className="p-4 rounded-full border border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-transform group-hover:scale-110">
                           <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </div>
                      <span className="text-[10px] font-bold tracking-widest uppercase">Terminate</span>
                  </button>
              </div>
          </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
            
            {msg.role === 'model' && founderMode && (
                <div className="mr-3 flex flex-col items-center justify-start">
                    <div className={`w-10 h-10 rounded-full overflow-hidden border-2 ${isSpeaking && idx === messages.length - 1 ? 'border-cyan-400 shadow-[0_0_15px_cyan]' : 'border-slate-700'}`}>
                         {avatarUrl ? (
                            <img src={avatarUrl} alt="Founder" className="w-full h-full object-cover" />
                        ) : (
                             <div className="w-full h-full bg-slate-800 flex items-center justify-center text-xs text-slate-500">AI</div>
                        )}
                    </div>
                </div>
            )}

            <div className={`max-w-[85%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-5 py-4 relative shadow-lg text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-cyan-900/40 to-slate-900 text-cyan-50 border border-cyan-800/50 rounded-2xl rounded-tr-sm' 
                      : 'bg-slate-800/80 backdrop-blur text-slate-200 border border-slate-700 rounded-2xl rounded-tl-sm'
                }`}>
                    {msg.role === 'model' && (msg.videoUrl || msg.isVideoGenerating) && (
                        <div className="absolute -top-3 left-4 px-2 py-0.5 bg-slate-950 border border-pink-500/50 text-pink-400 text-[9px] font-mono tracking-widest rounded uppercase shadow-sm z-10">
                            Veo Clone
                        </div>
                    )}
                    
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="prose prose-invert max-w-none text-sm">
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>

                        {(msg.videoUrl || msg.isVideoGenerating || msg.videoError) && (
                             <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-1 mt-2 md:mt-0">
                                 {msg.isVideoGenerating ? (
                                    <div className="aspect-video bg-slate-950 rounded border border-slate-700 flex flex-col items-center justify-center gap-2 p-4 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-pink-500/5 animate-pulse"></div>
                                        <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-[9px] text-pink-400 font-mono">SYNTHESIZING...</span>
                                    </div>
                                 ) : msg.videoError ? (
                                     <div className="aspect-video bg-slate-950 rounded border border-red-900/30 flex flex-col items-center justify-center p-4 text-center">
                                         <span className="text-[10px] text-red-400 font-bold uppercase">{msg.videoError}</span>
                                         {msg.videoError.includes('Billing') && (
                                             <button onClick={forceRefreshKey} className="text-[9px] text-slate-400 underline mt-1">Refresh Key</button>
                                         )}
                                     </div>
                                 ) : (
                                    <div className="rounded overflow-hidden border border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.2)]">
                                        <video controls autoPlay src={msg.videoUrl} className="w-full aspect-video bg-black" />
                                    </div>
                                 )}
                             </div>
                        )}
                    </div>
                </div>
            </div>
          </div>
        ))}
        {isLoading && (
             <div className="flex justify-start items-center gap-2 animate-fade-in pl-14">
                 <div className="bg-slate-800 rounded-full px-4 py-3 border border-slate-700 flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></span>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900/90 backdrop-blur border-t border-slate-800">
        {mediaBlob && (
             <div className="flex items-center gap-3 bg-cyan-900/20 w-fit px-3 py-1 mb-2 rounded border border-cyan-500/30 animate-fade-in">
                 <span className="text-xs text-cyan-200 font-mono uppercase">
                     {mediaBlob.type === 'audio' ? 'Voice Memo Attached' : 'Video Memo Attached'}
                 </span>
                 <button onClick={clearMedia} className="text-slate-500 hover:text-white ml-2">×</button>
             </div>
        )}

        <div className="flex gap-3 items-center relative">
            {recordingType === 'audio' && (
                <div className="absolute inset-0 bg-slate-900 z-20 flex items-center justify-between px-2 rounded-lg border border-cyan-500/50">
                    <canvas ref={canvasRef} className="h-full flex-1 rounded opacity-50" width={300} height={40} />
                    <button onClick={stopRecording} className="ml-4 p-2 text-red-400 hover:text-white">
                        <div className="w-3 h-3 bg-current rounded-sm"></div>
                    </button>
                </div>
            )}

            {!recordingType ? (
                <>
                    <button onClick={() => startRecording('audio')} disabled={isLoading} className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-700 hover:border-cyan-500/50 transition-all hover:-translate-y-0.5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                    </button>
                    <button onClick={() => startRecording('video')} disabled={isLoading} className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:text-pink-400 border border-slate-700 hover:border-pink-500/50 transition-all hover:-translate-y-0.5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                </>
            ) : recordingType === 'video' && (
                <button onClick={stopRecording} className="p-3 px-6 rounded-xl bg-red-900/20 text-red-500 border border-red-500/50 animate-pulse text-xs font-bold tracking-widest uppercase">
                    Stop Rec
                </button>
            )}

            <input 
                type="text" 
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none placeholder-slate-600 transition-all"
                placeholder={recordingType ? "Recording..." : "Type your update..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading || !!recordingType}
            />
            <Button onClick={handleSend} disabled={isLoading || (!inputValue.trim() && !mediaBlob)} className="px-5 py-3 rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
