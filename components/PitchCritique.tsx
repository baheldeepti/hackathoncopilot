
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { analyzePitchVideo, generateFounderSpeech } from '../services/geminiService';
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

  // Audio / Founder Feedback State (Replaced Video)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
      setResult(null);
      setAnalysisError(null);
      setShowKeyRefresh(false);
      audioBufferRef.current = null;
      if (audioContextRef.current) audioContextRef.current.suspend();
      setIsAudioPlaying(false);
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
    setAnalysisError(null);
    setShowKeyRefresh(false);
    audioBufferRef.current = null;
    
    try {
        const input = inputType === 'file' ? videoFile! : videoLink;
        const jsonResponse = await analyzePitchVideo(input, `Name: ${config.name}. Vision: ${config.vision}`);
        
        try {
            const parsed = JSON.parse(jsonResponse);
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
          const audioBase64 = await generateFounderSpeech(text, config.founderVoice || 'Fenrir');
          if (!audioBase64) return null;

          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          audioContextRef.current = ctx;
          
          const binaryString = atob(audioBase64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
          }

          try {
             return await ctx.decodeAudioData(bytes.buffer.slice(0));
          } catch(e) {
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

  const handlePlayFeedback = async () => {
    if (isAudioPlaying) {
        if (audioContextRef.current) {
            audioContextRef.current.suspend();
        }
        setIsAudioPlaying(false);
        return;
    }

    if (!result?.spoken_commentary) return;

    if (audioBufferRef.current && audioContextRef.current) {
        if (audioContextRef.current.state === 'suspended') {
             await audioContextRef.current.resume();
             setIsAudioPlaying(true);
             return;
        }
        playAudioBuffer();
        return;
    }

    setIsLoadingAudio(true);
    try {
        const buffer = await prepareAudio(result.spoken_commentary);
        if (buffer) {
            audioBufferRef.current = buffer;
            playAudioBuffer();
        }
    } catch (e) {
        console.error("Playback failed", e);
    } finally {
        setIsLoadingAudio(false);
    }
  };

  const playAudioBuffer = () => {
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
      if (score >= 80) return 'bg-green-500 shadow-[0_0_15px_#22c55e]';
      if (score >= 50) return 'bg-yellow-500 shadow-[0_0_15px_#eab308]';
      return 'bg-red-500 shadow-[0_0_15px_#ef4444]';
  };

  const getLoadingText = () => {
      if (inputType === 'link') return 'Scanning Video Metadata...';
      return 'Analyzing Visuals & Speech...';
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
                PITCH CALIBRATION DECK
            </h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Column: Input & Founder Audio */}
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
                                    <span className="text-[10px] text-slate-500 mt-1 font-mono uppercase">
                                        {videoFile ? 'Ready to analyze frames' : 'Visual & Slide Analysis Supported'}
                                    </span>
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
                        {isAnalyzing ? getLoadingText() : 'Run DeepMind Analysis'}
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

                {/* 2. Founder Coaching Section (AUDIO ONLY REPLACEMENT) */}
                {result && (
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>
                        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                             <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                             Founder Feedback (The "Vibe")
                        </h4>
                        
                        <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 shadow-2xl flex items-center justify-center">
                            {/* Background Avatar with blur */}
                            {config.avatarFile ? (
                                <img src={URL.createObjectURL(config.avatarFile)} className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${isAudioPlaying ? 'scale-105 blur-sm opacity-60' : 'grayscale opacity-20'}`} />
                            ) : (
                                <div className="absolute inset-0 bg-slate-900" />
                            )}
                            
                            {/* Radial Glow */}
                            {isAudioPlaying && (
                                <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/40 via-transparent to-transparent animate-pulse"></div>
                            )}

                            {/* Central Visualizer / Avatar */}
                            <div className="relative z-10 flex flex-col items-center gap-6 p-6 w-full text-center">
                                <div className={`relative w-24 h-24 md:w-32 md:h-32 rounded-full border-4 overflow-hidden shadow-2xl transition-all duration-300 ${isAudioPlaying ? 'border-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.5)] scale-110 ring-4 ring-cyan-500/20' : 'border-slate-700 grayscale'}`}>
                                     {config.avatarFile ? (
                                         <img src={URL.createObjectURL(config.avatarFile)} className="w-full h-full object-cover" />
                                     ) : (
                                         <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                             <svg className="w-12 h-12 text-slate-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                                         </div>
                                     )}
                                </div>
                                
                                <div className="space-y-4 max-w-md mx-auto">
                                    <p className="text-slate-300 text-sm font-medium italic leading-relaxed line-clamp-3">
                                        "{result.spoken_commentary}"
                                    </p>
                                    
                                    <div className="flex justify-center">
                                        <Button 
                                            onClick={handlePlayFeedback} 
                                            isLoading={isLoadingAudio}
                                            variant={isAudioPlaying ? 'danger' : 'secondary'}
                                            className={isAudioPlaying ? 'animate-pulse' : 'bg-white/10 hover:bg-white/20 backdrop-blur-md border-white/20 text-white'}
                                        >
                                            {isAudioPlaying ? (
                                                <>
                                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-ping mr-2"></span>
                                                    Stop Audio Feedback
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                    Play Audio Feedback
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column: Analysis Results */}
            <div className="space-y-6">
                {!result ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 border-2 border-dashed border-slate-800 rounded-xl p-12">
                        <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center animate-pulse">
                            <svg className="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <p className="font-mono text-sm uppercase tracking-wide">Awaiting Video Input...</p>
                    </div>
                ) : (
                    <div className="animate-fade-in space-y-6">
                        
                        {/* Scores */}
                        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                             <h4 className="text-xs font-mono uppercase text-slate-500 mb-6 tracking-widest">Performance Metrics</h4>
                             <div className="space-y-6">
                                {Object.entries(result.scores).map(([key, value]) => {
                                    const score = value as number;
                                    return (
                                    <div key={key}>
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{key}</span>
                                            <span className={`text-sm font-mono font-bold ${score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{score}/100</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/50 shadow-inner">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-1000 ease-out ${getScoreColor(score)}`} 
                                                style={{ width: '0%', animation: `growWidth 1s ease-out forwards` }}
                                            ></div>
                                            <style>{`@keyframes growWidth { from { width: 0% } to { width: ${score}% } }`}</style>
                                        </div>
                                    </div>
                                )})}
                             </div>
                        </div>

                        {/* Structure & Tone Analysis */}
                        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                 <div className="bg-slate-950 p-4 rounded-lg border border-slate-700">
                                     <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Your Structure</p>
                                     <p className="text-xs text-slate-300 leading-relaxed font-mono">{result.structure_analysis.current}</p>
                                 </div>
                                 <div className="bg-slate-950 p-4 rounded-lg border border-green-900/30">
                                     <p className="text-[10px] text-green-500 uppercase font-bold mb-1">Winning Structure</p>
                                     <p className="text-xs text-slate-300 leading-relaxed font-mono">{result.structure_analysis.ideal}</p>
                                 </div>
                             </div>
                        </div>

                        {/* Script Doctor (Diff View) */}
                        {result.script_enhancements && result.script_enhancements.length > 0 && (
                            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                                <h4 className="text-purple-400 text-sm font-bold mb-4 flex items-center gap-2 uppercase tracking-wide">
                                    Script Refinement
                                </h4>
                                <div className="space-y-3 font-mono text-xs">
                                    {result.script_enhancements.map((enhancement, i) => (
                                        <div key={i} className="rounded-lg overflow-hidden border border-slate-700">
                                            <div className="bg-red-900/10 p-3 border-b border-slate-800/50 flex gap-2">
                                                <span className="text-red-500 select-none">-</span>
                                                <span className="text-slate-400 opacity-80 line-through">{enhancement.context}</span>
                                            </div>
                                            <div className="bg-green-900/10 p-3 flex gap-2">
                                                <span className="text-green-500 select-none">+</span>
                                                <span className="text-green-200">{enhancement.suggested_line}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
          </div>
      </div>
    </div>
  );
};

export default PitchCritique;
