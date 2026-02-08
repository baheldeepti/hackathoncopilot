
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { analyzePitchVideo, generateFounderSpeech, generateFounderVideo } from '../services/geminiService';
import { HackathonConfig } from '../types';
import { Input } from './ui/Input';

interface PitchCritiqueProps {
    config: HackathonConfig;
}

interface AnalysisResult {
    scores: {
        innovation: number;
        impact: number;
        technology: number;
        presentation: number;
    };
    critique: string;
    structure_analysis: {
        current: string;
        ideal: string;
        advice: string;
    };
    tone_analysis: string;
    improvements: string[];
    spoken_commentary: string;
    script_enhancements: Array<{
        context: string;
        suggested_line: string;
    }>;
}

const PitchCritique: React.FC<PitchCritiqueProps> = ({ config }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoLink, setVideoLink] = useState<string>('');
  const [inputType, setInputType] = useState<'file' | 'link'>('file');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showKeyRefresh, setShowKeyRefresh] = useState(false);

  // Founder Video State
  const [coachingVideoUrl, setCoachingVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerationError, setVideoGenerationError] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
      setResult(null);
      setCoachingVideoUrl(null);
      setVideoGenerationError(null);
      setAnalysisError(null);
      setShowKeyRefresh(false);
    }
  };

  const forceRefreshKey = async () => {
      try {
          // @ts-ignore
          if (window.aistudio && window.aistudio.openSelectKey) {
              // @ts-ignore
              await window.aistudio.openSelectKey();
              setAnalysisError(null);
              setShowKeyRefresh(false);
              alert("Key refreshed! Try running the analysis again.");
          }
      } catch (e) {
          console.error(e);
          alert("Could not open key selector.");
      }
  };

  const handleCritique = async (retry = false) => {
    if (inputType === 'file' && !videoFile) return;
    if (inputType === 'link' && !videoLink) return;

    setIsAnalyzing(true);
    setResult(null);
    setCoachingVideoUrl(null);
    setVideoGenerationError(null);
    setAnalysisError(null);
    setShowKeyRefresh(false);
    
    try {
        const input = inputType === 'file' ? videoFile! : videoLink;
        const jsonResponse = await analyzePitchVideo(input, `Name: ${config.name}. Vision: ${config.vision}`);
        
        try {
            const parsed = JSON.parse(jsonResponse);
            // Handle specific prompt error output
            if (parsed.critique && parsed.critique.includes("Error:")) {
                throw new Error(parsed.critique);
            }
            setResult(parsed);
        } catch (jsonErr: any) {
            console.error("JSON Parse Error", jsonResponse);
            setAnalysisError(jsonErr.message || "The AI analyzed your video but failed to format the report correctly.");
        }
    } catch (err: any) {
        console.error("Pitch Critique Error", err);
        let msg = 'Error analyzing pitch. Please ensure the video/link is accessible.';
        
        if (err.toString().includes('403') || err.toString().includes('429') || (err.message && err.message.includes('quota'))) {
            msg = "Access Denied or Quota Exceeded. Please check your API Key billing status.";
            setShowKeyRefresh(true);
            
            // Auto-trigger key selection if it's the first failure and looks like auth
            if (!retry && window.confirm("Authentication Issue Detected. Would you like to refresh your API Key?")) {
                await forceRefreshKey();
                return;
            }
        }
        
        setAnalysisError(msg);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const prepareAudio = async (text: string) => {
      try {
          // Generate speech
          const audioBase64 = await generateFounderSpeech(
              text, 
              config.founderVoice || 'Fenrir',
              { apiKey: config.elevenLabsKey || '', voiceId: config.elevenLabsVoiceId || '' }
          );
          
          if (!audioBase64) return null;

          // Decode immediately
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          audioContextRef.current = ctx;
          
          const binaryString = atob(audioBase64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
          }

          // Try standard decoding or PCM fallback
          try {
             return await ctx.decodeAudioData(bytes.buffer.slice(0));
          } catch(e) {
              // PCM Fallback
              const dataInt16 = new Int16Array(bytes.buffer);
              const frameCount = dataInt16.length; 
              const buffer = ctx.createBuffer(1, frameCount, 24000);
              const channelData = buffer.getChannelData(0);
              for (let i = 0; i < frameCount; i++) {
                  channelData[i] = dataInt16[i] / 32768.0;
              }
              return buffer;
          }
      } catch (e) {
          console.error("Failed to prepare audio", e);
          return null;
      }
  };

  const handleGenerateCoaching = async () => {
      if (!result?.spoken_commentary || !config.avatarFile) return;
      setIsGeneratingVideo(true);
      setVideoGenerationError(null);
      audioBufferRef.current = null;

      try {
          // 1. Start generation
          const [videoUrl, audioBuffer] = await Promise.all([
              generateFounderVideo(result.spoken_commentary, config.avatarFile),
              prepareAudio(result.spoken_commentary)
          ]);
          
          if (!videoUrl) throw new Error("Failed to generate video");
          
          setCoachingVideoUrl(videoUrl);
          audioBufferRef.current = audioBuffer;

      } catch (e: any) {
          console.error("Coaching generation failed", e);
          let msg = "Could not generate video.";
          if (e.toString().includes('429') || (e.message && e.message.includes('quota'))) {
              msg = "Veo Quota Exceeded (429). Billing required.";
          }
          setVideoGenerationError(msg);
      } finally {
          setIsGeneratingVideo(false);
      }
  };

  const handleVideoPlay = () => {
      // Play Pre-loaded Audio
      if (audioBufferRef.current && audioContextRef.current) {
          const ctx = audioContextRef.current;
          if (ctx.state === 'suspended') ctx.resume();
          
          const source = ctx.createBufferSource();
          source.buffer = audioBufferRef.current;
          source.connect(ctx.destination);
          source.onended = () => setIsAudioPlaying(false);
          
          setIsAudioPlaying(true);
          source.start(0);
      }
  };

  const getScoreColor = (score: number) => {
      if (score >= 80) return 'bg-green-500 shadow-[0_0_10px_#22c55e]';
      if (score >= 50) return 'bg-yellow-500 shadow-[0_0_10px_#eab308]';
      return 'bg-red-500 shadow-[0_0_10px_#ef4444]';
  };

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl h-full flex flex-col relative">
      {/* Header */}
      <div className="p-5 bg-slate-900 border-b border-slate-800 flex flex-col gap-4">
        <div className="flex justify-between items-center">
             <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tight">
                <span className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg shadow-lg text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </span>
                DEEPMIND PITCH LAB
            </h3>
            <span className="text-[10px] text-pink-400 font-mono border border-pink-500/30 px-2 py-0.5 rounded-full bg-pink-900/10">
                PITCH CALIBRATION CENTER
            </span>
        </div>
        
        {/* INSTRUCTIONS PANEL */}
        <div className="bg-slate-950/80 p-4 rounded-lg border border-slate-700/50 flex flex-col md:flex-row gap-4 text-xs">
            <div className="flex-1">
                <p className="font-bold text-slate-300 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    How It Works
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-slate-400">
                    <li><strong>Upload or Paste</strong> your pitch demo (MP4, YouTube, Loom, Vimeo).</li>
                    <li><strong>AI Analysis</strong> runs against specific judging criteria (Impact, Tech, etc).</li>
                    <li><strong>Get Feedback</strong> on Structure, Tone, and Missing Elements.</li>
                </ol>
            </div>
            <div className="flex-1 border-t md:border-t-0 md:border-l border-slate-700 pt-3 md:pt-0 md:pl-4">
                 <p className="font-bold text-slate-300 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                    Maximizing Points
                </p>
                <p className="text-slate-400 leading-relaxed">
                    The AI checks your <strong>Time Allocation</strong> (Intro vs Demo) and <strong>Voice Energy</strong>. It helps you structure the perfect 2-minute pitch to win.
                </p>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Column: Input & Founder Video */}
            <div className="space-y-6">
                {/* 1. Input Section */}
                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 backdrop-blur-sm">
                    <h4 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Source Material</h4>
                    
                    <div className="flex p-1 bg-slate-950 rounded-lg border border-slate-800 mb-4">
                        <button 
                            onClick={() => setInputType('link')}
                            className={`flex-1 py-2 text-xs font-mono uppercase tracking-wide rounded-md transition-all ${inputType === 'link' ? 'bg-slate-800 text-cyan-400 shadow' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Paste Link
                        </button>
                        <button 
                            onClick={() => setInputType('file')}
                            className={`flex-1 py-2 text-xs font-mono uppercase tracking-wide rounded-md transition-all ${inputType === 'file' ? 'bg-slate-800 text-cyan-400 shadow' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Upload File
                        </button>
                    </div>

                    {inputType === 'file' ? (
                        <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${videoFile ? 'border-pink-500 bg-pink-900/10' : 'border-slate-700 bg-slate-900/50 hover:border-cyan-500 hover:bg-slate-800'}`}>
                            <input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={handleFileChange} className="hidden" id="pitch-upload" />
                            <label htmlFor="pitch-upload" className="cursor-pointer flex flex-col items-center gap-3">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${videoFile ? 'bg-pink-600 text-white shadow-lg scale-110' : 'bg-slate-800 text-slate-500'}`}>
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                </div>
                                <div>
                                    <span className={`block font-bold text-sm ${videoFile ? 'text-pink-300' : 'text-slate-300'}`}>
                                        {videoFile ? videoFile.name : 'Drop Pitch Video'}
                                    </span>
                                    <span className="text-[10px] text-slate-500 mt-1 font-mono uppercase">MP4 / WEBM / MOV</span>
                                </div>
                            </label>
                        </div>
                    ) : (
                        <Input 
                            placeholder="https://youtube.com/... or Loom / Vimeo" 
                            value={videoLink}
                            onChange={(e) => setVideoLink(e.target.value)}
                            className="bg-slate-950 border-slate-700 focus:border-cyan-500"
                        />
                    )}

                    <Button 
                        onClick={() => handleCritique(false)} 
                        disabled={(inputType === 'file' && !videoFile) || (inputType === 'link' && !videoLink) || isAnalyzing}
                        isLoading={isAnalyzing}
                        className="w-full mt-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white border-none shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                    >
                        {isAnalyzing ? 'Analyzing Structure & Tone...' : 'Run DeepMind Analysis'}
                    </Button>
                    
                    {analysisError && (
                        <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-xs text-red-200 animate-fade-in">
                            <p className="font-bold mb-1">Analysis Failed</p>
                            <p className="mb-2">{analysisError}</p>
                            {showKeyRefresh && (
                                <button 
                                    onClick={forceRefreshKey}
                                    className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded uppercase tracking-wider text-[10px]"
                                >
                                    Fix API Key / Billing
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* 2. Founder Coaching Section */}
                {result && (
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>
                        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                             <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                             Founder Feedback (The "Vibe")
                        </h4>
                        
                        <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 shadow-2xl">
                            {coachingVideoUrl ? (
                                <video 
                                    ref={videoPlayerRef}
                                    src={coachingVideoUrl} 
                                    className="w-full h-full object-cover" 
                                    controls 
                                    onPlay={handleVideoPlay}
                                />
                            ) : videoGenerationError ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 relative p-6 text-center">
                                     <svg className="w-8 h-8 text-red-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                     <p className="text-red-400 text-sm font-bold">Video Unavailable</p>
                                     <p className="text-slate-500 text-xs mt-1">{videoGenerationError}</p>
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 relative">
                                    {config.avatarFile ? (
                                        <img src={URL.createObjectURL(config.avatarFile)} className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm" />
                                    ) : null}
                                    <div className="relative z-10 text-center p-6">
                                        <p className="text-slate-300 text-sm font-medium mb-4 italic">
                                            "{result.spoken_commentary}"
                                        </p>
                                        <Button 
                                            onClick={handleGenerateCoaching} 
                                            isLoading={isGeneratingVideo}
                                            variant="secondary"
                                            className="bg-white/10 hover:bg-white/20 backdrop-blur-md border-white/20 text-white"
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                            Generate Video Feedback
                                        </Button>
                                    </div>
                                </div>
                            )}
                            
                            {/* Audio Waveform overlay */}
                            {isAudioPlaying && (
                                <div className="absolute bottom-4 left-4 right-4 h-8 flex items-end gap-1 justify-center opacity-80 pointer-events-none">
                                    {[...Array(10)].map((_, i) => (
                                        <div key={i} className="w-1 bg-cyan-400 rounded-full animate-[bounce_1s_infinite]" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }}></div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column: Analysis Results */}
            <div className="space-y-6">
                {!result ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 border-2 border-dashed border-slate-800 rounded-xl p-12">
                        <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center">
                            <svg className="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <p className="font-mono text-sm">Awaiting Video Input for Evaluation...</p>
                    </div>
                ) : (
                    <div className="animate-fade-in space-y-6">
                        
                        {/* Scores */}
                        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                             <h4 className="text-xs font-mono uppercase text-slate-500 mb-4 tracking-widest">Judging Criteria Scorecard</h4>
                             <div className="space-y-5">
                                {Object.entries(result.scores).map(([key, value]) => {
                                    const score = value as number;
                                    return (
                                    <div key={key}>
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-sm font-bold capitalize text-slate-200">{key}</span>
                                            <span className={`text-sm font-mono font-bold ${score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{score}/100</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                            <div className={`h-full rounded-full transition-all duration-1000 ${getScoreColor(score)}`} style={{ width: `${score}%` }}></div>
                                        </div>
                                    </div>
                                )})}
                             </div>
                        </div>

                        {/* Structure & Tone Analysis */}
                        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                             <h4 className="text-xs font-mono uppercase text-cyan-500 mb-4 tracking-widest flex items-center gap-2">
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
                                 Structure & Tone
                             </h4>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                 <div className="bg-slate-950 p-3 rounded-lg border border-slate-700">
                                     <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Your Structure</p>
                                     <p className="text-xs text-slate-300 leading-relaxed">{result.structure_analysis.current}</p>
                                 </div>
                                 <div className="bg-slate-950 p-3 rounded-lg border border-green-900/50">
                                     <p className="text-[10px] text-green-500 uppercase font-bold mb-1">Recommended</p>
                                     <p className="text-xs text-slate-300 leading-relaxed">{result.structure_analysis.ideal}</p>
                                 </div>
                             </div>

                             <div className="mb-4">
                                 <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Gap Analysis</p>
                                 <p className="text-sm text-cyan-200">{result.structure_analysis.advice}</p>
                             </div>

                             <div className="pt-4 border-t border-slate-800">
                                 <div className="flex items-start gap-3">
                                     <div className="p-2 bg-purple-900/20 rounded-full text-purple-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                                     </div>
                                     <div>
                                         <p className="text-[10px] text-purple-400 uppercase font-bold mb-1">Tone Check</p>
                                         <p className="text-sm text-slate-300 italic">"{result.tone_analysis}"</p>
                                     </div>
                                 </div>
                             </div>
                        </div>

                        {/* Critique Text */}
                        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                            <h4 className="text-cyan-400 text-sm font-bold mb-3 flex items-center gap-2 uppercase tracking-wide">
                                Evaluation Summary
                            </h4>
                            <p className="text-sm text-slate-300 leading-7 font-light">
                                {result.critique}
                            </p>
                        </div>
                        
                        {/* Script Doctor */}
                        {result.script_enhancements && result.script_enhancements.length > 0 && (
                            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                                <h4 className="text-purple-400 text-sm font-bold mb-4 flex items-center gap-2 uppercase tracking-wide">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                    Script Doctor
                                </h4>
                                <div className="space-y-4">
                                    {result.script_enhancements.map((enhancement, i) => (
                                        <div key={i} className="bg-slate-950/50 p-4 rounded-lg border-l-2 border-purple-500">
                                            <p className="text-[10px] text-slate-500 uppercase font-mono mb-1">{enhancement.context}</p>
                                            <p className="text-sm text-purple-200 italic">"{enhancement.suggested_line}"</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Improvements */}
                        <div>
                            <h4 className="text-xs font-mono uppercase text-slate-500 mb-3 tracking-widest">Tactical Improvements</h4>
                            <div className="flex flex-wrap gap-2">
                                {result.improvements.map((tip, i) => (
                                    <div key={i} className="bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-xs text-slate-300 flex items-center gap-2">
                                        <span className="text-cyan-500">•</span>
                                        {tip}
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}
            </div>
          </div>
      </div>
    </div>
  );
};

export default PitchCritique;
