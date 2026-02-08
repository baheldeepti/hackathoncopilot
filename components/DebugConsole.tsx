
import React, { useState } from 'react';
import { Button } from './ui/Button';
import { analyzeScreenRecording } from '../services/geminiService';
import { Input } from './ui/Input';

interface DebugResult {
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    error_type: string;
    explanation: string;
    file_name: string;
    fix_code: string;
    human_readable_fix: string;
}

const DebugConsole: React.FC = () => {
  const [mediaFile, setMediaFile] = useState<File | Blob | null>(null);
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<DebugResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMediaFile(e.target.files[0]);
      setResult(null);
    }
  };

  const takeScreenshot = async () => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
            video: true,
            audio: false 
        });
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        await video.play();

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0);
            
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], "screenshot.png", { type: 'image/png' });
                    setMediaFile(file);
                    setResult(null);
                }
                
                stream.getTracks().forEach(t => t.stop());
                video.remove();
            }, 'image/png');
        }
    } catch (err) {
        console.error("Screenshot failed", err);
        alert("Could not capture screenshot. Check permissions.");
    }
  };

  const handleDebug = async () => {
    if (!mediaFile) return;
    setIsAnalyzing(true);
    setResult(null);
    try {
        const jsonStr = await analyzeScreenRecording(mediaFile, description || "Identify the bug in this image.");
        const parsed: DebugResult = JSON.parse(jsonStr);
        setResult(parsed);
    } catch (err) {
        console.error(err);
        alert("Diagnostics Failed. Please try a clearer image.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const copyCode = () => {
      if(result?.fix_code) {
          navigator.clipboard.writeText(result.fix_code);
          alert("Code copied to clipboard!");
      }
  };

  return (
    <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-6 h-full flex flex-col relative overflow-hidden shadow-2xl">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

      <div className="mb-6 z-10">
        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
            <div className="p-2 bg-yellow-900/30 rounded border border-yellow-500/50">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
            </div>
            <span>VISUAL STACK TRACE</span>
        </h3>
        <p className="text-sm text-slate-400">
            Upload a screenshot of your <span className="text-cyan-400 font-mono">Terminal</span>, <span className="text-pink-400 font-mono">IDE</span>, or <span className="text-yellow-400 font-mono">Browser Console</span>.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar z-10 space-y-6">
          {!result && !isAnalyzing ? (
              <div className="flex flex-col gap-6 animate-fade-in">
                 
                 {/* Drag & Drop Area */}
                 <div className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 relative group ${mediaFile ? 'border-yellow-500 bg-yellow-900/5' : 'border-slate-700 bg-slate-900/50 hover:border-cyan-500 hover:bg-slate-800'}`}>
                    {!mediaFile ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex gap-4 mb-2">
                                <div className="w-12 h-16 bg-slate-800 rounded border border-slate-600 flex items-center justify-center text-[8px] font-mono text-slate-400">LOGS</div>
                                <div className="w-16 h-12 bg-slate-800 rounded border border-slate-600 flex items-center justify-center text-[8px] font-mono text-slate-400 mt-4">UI</div>
                                <div className="w-12 h-16 bg-slate-800 rounded border border-slate-600 flex items-center justify-center text-[8px] font-mono text-slate-400">CODE</div>
                            </div>
                            <p className="text-sm text-slate-300 font-bold">Drop Diagnostic Evidence Here</p>
                            <div className="flex gap-2 mt-2">
                                <label className="cursor-pointer px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded shadow-lg transition-all">
                                    Upload Screenshot
                                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                </label>
                                <button onClick={takeScreenshot} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded shadow-lg transition-all">
                                    Capture Screen
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center animate-fade-in">
                            <img 
                                src={URL.createObjectURL(mediaFile)} 
                                className="h-40 object-contain rounded border border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.2)] mb-4" 
                            />
                            <div className="flex items-center gap-2">
                                <span className="text-yellow-400 font-mono text-xs">{mediaFile instanceof File ? mediaFile.name : "Capture.png"}</span>
                                <button onClick={() => setMediaFile(null)} className="text-slate-500 hover:text-white px-2">×</button>
                            </div>
                        </div>
                    )}
                 </div>

                 {/* Context Input */}
                 <div>
                     <label className="text-xs font-mono text-slate-500 uppercase font-bold mb-2 block">Optional Context</label>
                     <Input 
                        placeholder="e.g. 'I'm getting a 403 error when deploying to Firebase...'" 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="bg-slate-950 border-slate-800 focus:border-yellow-500"
                     />
                 </div>

                 <Button 
                    onClick={handleDebug} 
                    disabled={!mediaFile}
                    className="w-full bg-yellow-600 hover:bg-yellow-500 text-white border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)] h-12 text-sm uppercase tracking-widest"
                >
                    Run Visual Diagnostics
                </Button>
              </div>
          ) : isAnalyzing ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 animate-fade-in">
                  <div className="relative w-24 h-24">
                      <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-yellow-500 rounded-full border-t-transparent animate-spin"></div>
                      <div className="absolute inset-4 bg-slate-800 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-yellow-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </div>
                  </div>
                  <div className="text-center">
                      <h4 className="text-white font-bold text-lg">Analyzing Visual Data</h4>
                      <p className="text-slate-400 text-xs font-mono mt-1">GEMINI 3 PRO IS PARSING PIXELS...</p>
                  </div>
                  <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 animate-[progress_2s_ease-in-out_infinite] w-full origin-left transform scale-x-0"></div>
                  </div>
              </div>
          ) : result && (
              <div className="animate-fade-in space-y-6 pb-6">
                  {/* Result Header */}
                  <div className={`p-4 rounded-lg border flex items-center justify-between ${result.severity === 'CRITICAL' ? 'bg-red-900/20 border-red-500/50' : 'bg-yellow-900/20 border-yellow-500/50'}`}>
                      <div>
                          <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${result.severity === 'CRITICAL' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'}`}>
                                  {result.severity}
                              </span>
                              <span className="text-xs font-mono text-slate-300 uppercase">{result.error_type}</span>
                          </div>
                          <h2 className="text-white font-bold text-lg">Diagnostic Report</h2>
                      </div>
                      <button onClick={() => { setMediaFile(null); setResult(null); }} className="text-xs text-slate-500 hover:text-white underline">
                          New Scan
                      </button>
                  </div>

                  {/* Root Cause */}
                  <div className="space-y-2">
                      <h4 className="text-xs font-mono text-slate-500 uppercase font-bold">Root Cause Analysis</h4>
                      <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-3 rounded border border-slate-800">
                          {result.explanation}
                      </p>
                  </div>

                  {/* Fix Code Block */}
                  <div className="space-y-2">
                      <div className="flex justify-between items-end">
                         <h4 className="text-xs font-mono text-cyan-500 uppercase font-bold">
                             Recommended Patch <span className="text-slate-500 ml-2">// {result.file_name}</span>
                         </h4>
                         <button onClick={copyCode} className="text-[10px] text-cyan-400 hover:text-white flex items-center gap-1">
                             <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                             COPY
                         </button>
                      </div>
                      
                      <div className="bg-[#0d1117] rounded-lg border border-slate-700 overflow-hidden font-mono text-xs relative group">
                          <div className="flex gap-1.5 p-3 border-b border-slate-800 bg-[#161b22]">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
                              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20"></div>
                              <div className="w-2.5 h-2.5 rounded-full bg-green-500/20"></div>
                          </div>
                          <div className="p-4 overflow-x-auto text-green-400 leading-5">
                              <pre>{result.fix_code}</pre>
                          </div>
                      </div>
                  </div>

                  {/* Human Readable */}
                  <div className="flex items-start gap-3 bg-slate-800/50 p-3 rounded border border-slate-700">
                      <div className="p-1 bg-green-900/30 rounded text-green-400 mt-0.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      </div>
                      <div>
                          <h5 className="text-xs font-bold text-white mb-1">Action Plan</h5>
                          <p className="text-xs text-slate-400">{result.human_readable_fix}</p>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default DebugConsole;
