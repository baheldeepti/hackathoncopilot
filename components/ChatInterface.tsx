
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
  // Default to Auto Video being FALSE to prevent billing blocks during submission
  const [autoVideo, setAutoVideo] = useState(false); 
  const [veoDisabled, setVeoDisabled] = useState(false); // New state to lock video if quota hit

  // Check if ElevenLabs is Active
  const isElevenLabsActive = config.founderVoice === 'ElevenLabs' || (!!config.elevenLabsKey && !!config.elevenLabsVoiceId && config.founderVoice !== 'Fenrir' && config.founderVoice !== 'Puck' && config.founderVoice !== 'Charon' && config.founderVoice !== 'Kore' && config.founderVoice !== 'Zephyr');

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

  const handleClearHistory = () => {
      if (window.confirm("Clear chat history? This cannot be undone.")) {
          const defaultMsg: ChatMessage = { role: 'model', text: `Memory reset. I'm ready for a fresh start. What's next?` };
          setMessages([defaultMsg]);
          localStorage.removeItem('hc_chat_history');
      }
  };

  const forceRefreshKey = async () => {
      try {
          // @ts-ignore
          if (window.aistudio && window.aistudio.openSelectKey) {
              // @ts-ignore
              await window.aistudio.openSelectKey();
              // Reset disabled state to allow retry
              setVeoDisabled(false);
              setAutoVideo(true);
              alert("Key refreshed! Video generation unlocked.");
          } else {
              // Fallback for Localhost / Non-IDX environments where window.aistudio isn't available
              // If the user says they have paid, we trust them and unlock the UI.
              if(window.confirm("Confirm: Has a valid paid API key been configured in your environment?")) {
                  setVeoDisabled(false);
                  setAutoVideo(true);
                  alert("Video generation unlocked. Please retry.");
              }
          }
      } catch (e) {
          console.error(e);
          // Safety fallback
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
          
          // Start sending video frames if video element is ready
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
          // Revert to Webcam
          if (webcamStreamRef.current) {
              userVideoRef.current.srcObject = webcamStreamRef.current;
              setIsScreenSharing(false);
          } else {
              // Restart webcam if lost
              const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              webcamStreamRef.current = stream;
              userVideoRef.current.srcObject = stream;
              setIsScreenSharing(false);
          }
      } else {
          try {
              // Start Screen Share
              const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
              
              // Handle user stopping share via browser UI
              screenStream.getVideoTracks()[0].onended = () => {
                  if (userVideoRef.current && webcamStreamRef.current) {
                      userVideoRef.current.srcObject = webcamStreamRef.current;
                      setIsScreenSharing(false);
                  }
              };

              userVideoRef.current.srcObject = screenStream;
              setIsScreenSharing(true);
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

        // Try standard decoding first (MP3/WAV from ElevenLabs)
        try {
            // Must use slice(0) to ensure ArrayBuffer copy
            const decodedBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
            const source = ctx.createBufferSource();
            source.buffer = decodedBuffer;
            source.connect(ctx.destination);
            source.onended = () => setIsSpeaking(false);
            setIsSpeaking(true);
            source.start(0);
        } catch (decodeErr) {
             // Fallback to Raw PCM (Gemini Default - No Headers)
            const dataInt16 = new Int16Array(bytes.buffer);
            const frameCount = dataInt16.length; // Mono assumption
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
        }
        
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
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2;
            ctx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
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
      
      // Update state to generating
      setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, isVideoGenerating: true, videoError: undefined } : m));
      
      try {
          const videoUrl = await generateFounderVideo(text, config.avatarFile);
          setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, isVideoGenerating: false, videoUrl } : m));
      } catch (err: any) {
          console.error(`Generation attempt ${retryCount} failed`, err);
          
          // Auto-Retry logic for Billing/Quota
          if (retryCount === 0 && (err.toString().includes('429') || (err.message && err.message.includes('quota')))) {
              try {
                  // @ts-ignore
                  if (window.aistudio && window.aistudio.openSelectKey) {
                      // @ts-ignore
                      await window.aistudio.openSelectKey();
                      // Retry once
                      setTimeout(() => checkApiKeyAndGenerateVideo(msgIndex, text, 1), 1000);
                      return;
                  }
              } catch (e) {}
          }

          let errorMsg = "Generation failed";
          // ENHANCED ERROR HANDLING FOR 429
          if (err.toString().includes('429') || (err.message && err.message.includes('quota'))) {
              errorMsg = "Veo Quota Exceeded (Billing Required)";
              setAutoVideo(false);
              setVeoDisabled(true); // LOCK Veo to prevent loop
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
      // If disabled, try to re-enable (assuming user fixed the issue)
      if (veoDisabled) {
          forceRefreshKey(); // Attempt unlock
          if (veoDisabled) return; // If still disabled (user cancelled), stop.
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
              
              const isElevenLabs = isElevenLabsActive && config.elevenLabsKey && config.elevenLabsVoiceId;

              setMessages(prev => {
                  const newArr = [...prev];
                  newArr[newArr.length - 1] = { 
                      role: 'model', 
                      text: displayText.replace("[ESCALATE]", "").trim(),
                      isEscalated: displayText.includes("[ESCALATE]") && !isElevenLabs, // Hide Escalate tag if voice is active
                      isClonedVoice: !!isElevenLabs
                  };
                  return newArr;
              });
          }
      }
      if (isFounder && fullText) {
         try {
             // Use ElevenLabs logic if configured
             const isElevenLabs = isElevenLabsActive && config.elevenLabsKey && config.elevenLabsVoiceId;
             
             const audioData = await generateFounderSpeech(
                 fullText, 
                 isElevenLabs ? '' : (config.founderVoice || 'Fenrir'),
                 isElevenLabs ? { apiKey: config.elevenLabsKey!, voiceId: config.elevenLabsVoiceId! } : undefined
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
                <span className="font-mono text-sm text-cyan-400">ONLINE // GEMINI-3-PRO-PREVIEW</span>
            </div>
            
            {/* VOICE SYSTEM INDICATOR */}
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider ${isElevenLabsActive ? 'bg-pink-900/30 border-pink-500/50 text-pink-300' : 'bg-cyan-900/30 border-cyan-500/50 text-cyan-300'}`}>
                {isElevenLabsActive ? (
                    <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        <span>NEURAL CLONE (ELEVENLABS)</span>
                    </>
                ) : (
                    <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.536 8.464a5 5 0 000 7.072m-2.828-9.9a9 9 0 000 12.728M12 12h.01" /></svg>
                        <span>GEMINI 2.5 TTS ({config.founderVoice || 'FENRIR'})</span>
                    </>
                )}
            </div>
        </div>
        
        <div className="flex items-center gap-3">
             <Button 
                onClick={startLiveCall}
                disabled={isLiveCallActive}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)] animate-pulse"
            >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                LIVE VIDEO CALL
            </Button>
            
            {/* Founder Mode Toggle */}
            <div 
                onClick={() => setFounderMode(!founderMode)}
                className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${founderMode ? 'bg-cyan-900/50 border-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'bg-slate-800 border-slate-600'}`}
            >
                <div className={`w-3 h-3 rounded-full transition-colors ${founderMode ? 'bg-cyan-400' : 'bg-slate-500'}`}></div>
                <span className={`text-xs font-bold uppercase tracking-wider ${founderMode ? 'text-cyan-300' : 'text-slate-400'}`}>
                    Founder Mode
                </span>
            </div>

            {/* Auto Video Toggle - Shows Disabled State if Veo Quota hit */}
            {founderMode && (
                <div 
                    onClick={() => {
                        if (veoDisabled) {
                            forceRefreshKey();
                        } else {
                            setAutoVideo(!autoVideo);
                        }
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${veoDisabled ? 'cursor-pointer bg-red-900/30 border-red-500' : autoVideo ? 'cursor-pointer bg-pink-900/50 border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.3)]' : 'cursor-pointer bg-slate-800 border-slate-600'}`}
                    title={veoDisabled ? "Click to Re-Enable Video (Requires Paid Key)" : "Toggle Auto Video"}
                >
                    <svg className={`w-3 h-3 ${autoVideo && !veoDisabled ? 'text-pink-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    <span className={`text-xs font-bold uppercase tracking-wider ${autoVideo && !veoDisabled ? 'text-pink-300' : veoDisabled ? 'text-red-400' : 'text-slate-400'}`}>
                        {veoDisabled ? 'Video Disabled (Click to Fix)' : 'Auto Video'}
                    </span>
                </div>
            )}
        </div>
      </div>

      {/* LIVE CALL OVERLAY */}
      {isLiveCallActive && (
          <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 animate-fade-in">
              <div className="w-full h-full max-w-4xl relative flex flex-col rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl">
                   
                   {/* STATUS HEADER */}
                   <div className="absolute top-6 left-0 right-0 flex justify-center z-20 pointer-events-none">
                        <div className={`px-5 py-2 rounded-full backdrop-blur-md border flex items-center gap-3 shadow-2xl transition-colors duration-500 ${
                            liveCallStatus === 'connected' ? 'bg-green-900/60 border-green-500/50 text-green-400 shadow-green-900/20' :
                            liveCallStatus === 'error' ? 'bg-red-900/60 border-red-500/50 text-red-400 shadow-red-900/20' :
                            'bg-yellow-900/60 border-yellow-500/50 text-yellow-400 shadow-yellow-900/20'
                        }`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${liveCallStatus === 'connected' ? 'bg-green-500' : 'bg-current animate-ping'}`}></div>
                            <span className="text-xs font-bold font-mono uppercase tracking-widest drop-shadow-sm">
                                {liveCallStatus === 'connected' ? 'SECURE CONNECTION ESTABLISHED' : 
                                 liveCallStatus === 'error' ? 'CONNECTION FAILED' : 'NEGOTIATING HANDSHAKE...'}
                            </span>
                        </div>
                   </div>

                   {/* Founder Avatar View (Center Stage) */}
                   <div className="flex-1 relative flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
                        <div className={`relative w-64 h-64 rounded-full p-2 ${isLiveAgentSpeaking ? 'border-4 border-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.5)] scale-105' : 'border-4 border-slate-700'} transition-all duration-300`}>
                            {avatarUrl ? (
                                <img src={avatarUrl} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-slate-800 rounded-full flex items-center justify-center">
                                    <svg className="w-20 h-20 text-slate-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                                </div>
                            )}
                            {/* Pulse Rings */}
                            {isLiveAgentSpeaking && (
                                <>
                                    <div className="absolute inset-0 border-2 border-cyan-500 rounded-full animate-ping opacity-50"></div>
                                    <div className="absolute inset-0 border-2 border-cyan-500 rounded-full animate-ping opacity-30" style={{animationDelay: '0.3s'}}></div>
                                </>
                            )}
                        </div>

                        {/* Speaking Badge */}
                        {isLiveAgentSpeaking && (
                             <div className="absolute bottom-28 bg-cyan-950/80 border border-cyan-500 text-cyan-400 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.3)] backdrop-blur-sm z-10">
                                 Voice Activity Detected
                             </div>
                        )}

                        <div className="absolute bottom-8 text-center">
                             <h3 className="text-2xl font-bold text-white tracking-widest uppercase">
                                 {config.name} Founder
                             </h3>
                             <div className="inline-block mt-2 px-3 py-1 bg-slate-800 rounded border border-slate-700 text-[10px] text-slate-400">
                                 <span className="text-green-400 font-bold">INFO:</span> Live Call uses Native Audio for ultra-low latency. <br/>Clone Voice (ElevenLabs) is active in text chat.
                             </div>
                        </div>
                   </div>

                   {/* User Video (PiP) */}
                   <div className="absolute top-6 right-6 w-56 aspect-video bg-black rounded-lg border-2 border-slate-600 shadow-2xl overflow-hidden group z-30">
                       <video ref={userVideoRef} autoPlay muted className={`w-full h-full object-cover ${!isScreenSharing ? 'transform scale-x-[-1]' : ''}`} />
                       
                       {/* Overlay info */}
                       <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full animate-pulse ${isScreenSharing ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                <span className="text-[10px] font-bold text-white uppercase tracking-wider">{isScreenSharing ? 'Screen Share' : 'Your Camera'}</span>
                            </div>
                       </div>
                       
                       {/* Screen Share Overlay Indicator */}
                       {isScreenSharing && (
                           <div className="absolute inset-0 flex items-center justify-center bg-yellow-500/10 pointer-events-none">
                               <div className="bg-yellow-500/90 text-black text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                                   Sharing Screen
                               </div>
                           </div>
                       )}

                       {/* Screen Share Toggle Mini-Btn */}
                       <button 
                           onClick={toggleScreenShare}
                           className="absolute top-2 right-2 bg-black/60 hover:bg-slate-700 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                           title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
                       >
                           {isScreenSharing ? (
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                           ) : (
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                           )}
                       </button>
                   </div>

                   {/* Controls */}
                   <div className="h-24 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-6 z-30">
                        <Button 
                            variant={isScreenSharing ? "danger" : "secondary"} 
                            onClick={toggleScreenShare} 
                            className={`px-8 rounded-full border-2 ${isScreenSharing ? 'animate-pulse' : ''}`}
                        >
                            {isScreenSharing ? (
                                <>
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    STOP SHARING
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                    SHARE SCREEN
                                </>
                            )}
                        </Button>
                        <Button variant="danger" onClick={endLiveCall} className="px-10 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] border-2 border-red-500">
                            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"></path></svg>
                            END CALL
                        </Button>
                   </div>
              </div>
          </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
            
            {/* Founder Avatar with visual indicator */}
            {msg.role === 'model' && founderMode && (
                <div className="mr-3 flex flex-col items-center justify-start mt-1">
                    <div className={`w-10 h-10 rounded-full overflow-hidden border-2 ${isSpeaking && idx === messages.length - 1 ? 'border-cyan-400 shadow-[0_0_10px_cyan]' : 'border-slate-700'} relative`}>
                         {avatarUrl ? (
                            <img src={avatarUrl} alt="Founder" className="w-full h-full object-cover" />
                        ) : (
                             <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                 <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                             </div>
                        )}
                        {/* Audio Speaking Ring Overlay */}
                        {isSpeaking && idx === messages.length - 1 && (
                            <div className="absolute inset-0 border-2 border-cyan-400 rounded-full animate-ping"></div>
                        )}
                    </div>
                </div>
            )}

            <div className={`max-w-[85%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-2xl px-5 py-4 relative shadow-md text-sm leading-relaxed transition-all duration-500 ${
                    msg.role === 'user' 
                      ? 'bg-cyan-900/30 text-cyan-50 border border-cyan-800/50 rounded-br-sm' 
                      : (msg.videoUrl || msg.isVideoGenerating) 
                        ? 'bg-slate-800 text-slate-200 border border-pink-500/30 shadow-[0_0_10px_rgba(236,72,153,0.15)] rounded-bl-sm'
                        : 'bg-slate-800 text-slate-200 border border-slate-700/80 rounded-bl-sm'
                }`}>
                    {/* Visual Indicator for Founder Video Clone */}
                    {msg.role === 'model' && (msg.videoUrl || msg.isVideoGenerating) && (
                        <div className="absolute -top-2.5 left-4 flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 border border-pink-500/50 text-pink-400 text-[9px] font-mono tracking-widest rounded-full uppercase shadow-sm z-10">
                            <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse"></span>
                            Founder Clone
                        </div>
                    )}
                    
                    {/* NEW: Visual Indicator for Neural Voice Clone (Audio Only) */}
                    {msg.role === 'model' && msg.isClonedVoice && !msg.videoUrl && !msg.isVideoGenerating && (
                        <div className="absolute -top-2.5 right-4 flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 border border-pink-500/50 text-pink-400 text-[9px] font-mono tracking-widest rounded-full uppercase shadow-sm z-10">
                             <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                             Neural Voice
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="prose prose-invert max-w-none text-sm prose-p:my-1 prose-headings:text-slate-100 prose-headings:my-2 prose-strong:text-cyan-300 prose-ul:my-2 prose-li:my-0.5">
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>

                        {/* Video Player or Error State */}
                        {(msg.videoUrl || msg.isVideoGenerating || msg.videoError) && (
                             <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-1 animate-fade-in mt-2 md:mt-0">
                                 {msg.isVideoGenerating ? (
                                    <div className="aspect-video bg-slate-950 rounded border border-slate-700 flex flex-col items-center justify-center gap-2 p-4 text-center relative overflow-hidden">
                                        <div className="absolute inset-0 bg-pink-500/5 animate-pulse"></div>
                                        <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin relative z-10"></div>
                                        <span className="text-[10px] text-pink-400 animate-pulse font-mono relative z-10">SYNTHESIZING CLONE...</span>
                                    </div>
                                 ) : msg.videoError ? (
                                     <div className="aspect-video bg-slate-950 rounded border border-red-500/30 flex flex-col items-center justify-center p-4 text-center">
                                         <svg className="w-6 h-6 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                         <span className="text-[10px] text-red-300 font-bold uppercase block">{msg.videoError}</span>
                                         
                                         {msg.videoError.includes('Billing') ? (
                                             <div className="flex flex-col gap-2 w-full mt-2">
                                                 <a href="https://console.cloud.google.com/billing" target="_blank" className="text-[9px] bg-red-600 hover:bg-red-500 text-white py-1 px-2 rounded font-bold uppercase">
                                                     Manage Billing
                                                 </a>
                                                 <button 
                                                     onClick={forceRefreshKey} 
                                                     className="text-[9px] text-slate-400 hover:text-white underline"
                                                 >
                                                     I paid! Refresh Key
                                                 </button>
                                             </div>
                                         ) : (
                                            <button 
                                                onClick={() => handleRetryVideo(idx, msg.text)}
                                                className="text-[9px] text-red-400/70 mt-1 block hover:text-white"
                                            >
                                                Tap to Retry
                                            </button>
                                         )}
                                     </div>
                                 ) : (
                                    <div className="rounded overflow-hidden border border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.3)] relative group">
                                        {/* Video Player Badge */}
                                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md border border-pink-500/30 rounded text-[10px] font-bold text-pink-400 flex items-center gap-1.5 z-10">
                                             <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse"></div>
                                             AI REPLICA
                                        </div>
                                        
                                        <video controls autoPlay src={msg.videoUrl} className="w-full aspect-video bg-black" />
                                        <div className="bg-slate-900 p-1 text-[8px] text-center text-pink-400 font-mono tracking-widest uppercase border-t border-slate-800">
                                            Video Generated by Veo 3.1
                                        </div>
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
             <div className="flex justify-start items-center gap-2 animate-fade-in">
                 {founderMode && (
                     <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                         <div className="w-4 h-4 rounded-full bg-slate-600 animate-pulse"></div>
                     </div>
                 )}
                 <div className="bg-slate-800 rounded-full px-4 py-3 border border-slate-700 flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></span>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-2">
        {mediaBlob && (
             <div className="flex items-center gap-3 bg-cyan-900/20 w-fit px-3 py-1.5 rounded-full border border-cyan-500/30 animate-fade-in self-start">
                 <span className="text-xs text-cyan-200 font-mono uppercase">
                     {mediaBlob.type === 'audio' ? 'Voice Memo Ready' : 'Video Memo Ready'}
                 </span>
                 <button onClick={clearMedia} className="text-slate-500 hover:text-red-400 ml-1">×</button>
             </div>
        )}

        <div className="flex gap-2 items-center relative">
            {recordingType === 'audio' && (
                <div className="absolute inset-0 bg-slate-900 z-10 flex items-center justify-between px-2 rounded-lg border border-cyan-500/50">
                    <canvas ref={canvasRef} className="h-full w-full rounded" width={300} height={40} />
                    <button onClick={stopRecording} className="ml-4 p-2 bg-red-500/20 text-red-400 rounded-full">
                        <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                    </button>
                </div>
            )}

            {!recordingType ? (
                <>
                    <button onClick={() => startRecording('audio')} disabled={isLoading} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-700 hover:border-cyan-500/50 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                    </button>
                    <button onClick={() => startRecording('video')} disabled={isLoading} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-pink-400 border border-slate-700 hover:border-pink-500/50 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                </>
            ) : recordingType === 'video' && (
                <button onClick={stopRecording} className="p-2 px-4 rounded-lg bg-red-900/50 text-red-200 border border-red-500 animate-pulse text-xs font-bold">
                    STOP
                </button>
            )}

            <input 
                type="text" 
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none placeholder-slate-600 font-sans shadow-inner"
                placeholder={recordingType ? "Recording..." : "Ask your co-founder..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading || !!recordingType}
            />
            <Button onClick={handleSend} disabled={isLoading || (!inputValue.trim() && !mediaBlob)} className="px-5 py-2">
                <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
