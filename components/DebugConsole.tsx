
import React, { useState } from 'react';
import { Button } from './ui/Button';
import { analyzeScreenRecording } from '../services/geminiService';
import { Input } from './ui/Input';

const DebugConsole: React.FC = () => {
  const [mediaFile, setMediaFile] = useState<File | Blob | null>(null);
  const [description, setDescription] = useState('');
  const [fix, setFix] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMediaFile(e.target.files[0]);
    }
  };

  const takeScreenshot = async () => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
            video: true,
            audio: false 
        });
        
        // Create a video element to play the stream
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        await video.play();

        // Create canvas and draw the frame
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
                }
                
                // Cleanup
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
    try {
        const result = await analyzeScreenRecording(mediaFile, description || "Identify the bug in this image.");
        setFix(result || 'No solution found.');
    } catch (err) {
        setFix('Error analyzing image. Please ensure format is valid.');
        console.error(err);
    } finally {
        setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Multimodal Debugger
        </h3>
        <p className="text-sm text-slate-400 mb-4">
            Stuck? <span className="text-cyan-400 font-semibold">Gemini 3 Pro</span> can see what you see. Upload a screenshot of your code, terminal, or UI glitch.
        </p>

        <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-700/50 text-xs text-slate-400 space-y-2 font-mono">
            <p className="font-bold text-slate-300 uppercase tracking-wider mb-2">Instructions:</p>
            <ol className="list-decimal pl-4 space-y-1">
                <li>Capture a screenshot of the error log, terminal output, or broken UI.</li>
                <li>Upload the image using the buttons below.</li>
                <li>(Optional) Add a text description of what you expected to happen.</li>
                <li>Click <strong>Run Diagnostics</strong> to let Gemini analyze the visual stack trace against the Hackathon RAG context.</li>
            </ol>
        </div>
      </div>

      {!fix ? (
          <div className="flex flex-col gap-4">
             <Input 
                placeholder="Describe the issue (e.g. 'Build failed on step 3')..." 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-slate-950/50"
             />

            <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${mediaFile ? 'border-yellow-500 bg-yellow-900/10' : 'border-slate-700 bg-slate-950 hover:border-slate-500'}`}>
                {/* Upload or Record UI */}
                {!mediaFile && (
                    <div className="w-full flex flex-col items-center gap-4">
                        <div className="flex flex-wrap w-full gap-4 justify-center">
                            
                            <Button onClick={takeScreenshot} variant="secondary" className="flex-1 min-w-[140px]">
                                <svg className="w-4 h-4 mr-2 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                Take Screenshot
                            </Button>

                            <div className="flex-1 min-w-[140px] relative">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleFileChange} 
                                    className="hidden" 
                                    id="debug-upload" 
                                />
                                <label htmlFor="debug-upload" className="block w-full h-full">
                                    <div className="h-full px-4 py-3 rounded-lg font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 hover:border-cyan-400/50 cursor-pointer">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                        Upload Image
                                        <div className="absolute inset-0 rounded-lg ring-1 ring-white/10 group-hover:ring-white/30 pointer-events-none" />
                                    </div>
                                </label>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">SUPPORTS PNG, JPG, WEBP</p>
                    </div>
                )}

                {mediaFile && (
                     <div className="flex flex-col items-center">
                        <img 
                            src={URL.createObjectURL(mediaFile)} 
                            alt="Screenshot Preview" 
                            className="h-48 object-contain mb-2 border border-slate-600 rounded shadow-lg" 
                            onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                        />
                         <span className="text-white font-medium break-all">
                             {mediaFile instanceof File ? mediaFile.name : "Screenshot.png"}
                         </span>
                         <button 
                            onClick={() => setMediaFile(null)}
                            className="text-xs text-red-400 hover:text-red-300 mt-2 underline"
                         >
                             Remove & Retake
                         </button>
                    </div>
                )}
            </div>
            
            <Button 
                onClick={handleDebug} 
                disabled={!mediaFile || isAnalyzing}
                isLoading={isAnalyzing}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]"
            >
                {isAnalyzing ? 'Analyzing Visual Data...' : 'Run Diagnostics'}
            </Button>
          </div>
      ) : (
          <div className="animate-fade-in">
              <div className="bg-slate-950 rounded-lg p-6 border border-slate-700 max-h-[400px] overflow-y-auto custom-scrollbar">
                  <div className="flex justify-between items-start mb-4">
                      <h4 className="font-mono text-yellow-500 text-sm uppercase">Debug Solution</h4>
                      <button onClick={() => { setFix(''); setMediaFile(null); setDescription(''); }} className="text-xs text-slate-500 hover:text-white underline">New Scan</button>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-slate-300 leading-relaxed text-sm">
                      {fix}
                  </pre>
              </div>
          </div>
      )}
    </div>
  );
};

export default DebugConsole;
