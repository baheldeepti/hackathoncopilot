
import React, { useState } from 'react';
import { Button } from './ui/Button';
import { TextArea, Input } from './ui/Input';
import { generatePitchScript, readTextFile, generateFounderSpeech } from '../services/geminiService';
import { HackathonConfig } from '../types';
import ReactMarkdown from 'react-markdown';

interface ScriptGeneratorProps {
    config: HackathonConfig;
}

const ScriptGenerator: React.FC<ScriptGeneratorProps> = ({ config }) => {
    const [projectDetails, setProjectDetails] = useState('');
    const [readmeContent, setReadmeContent] = useState('');
    const [readmeName, setReadmeName] = useState('');
    const [duration, setDuration] = useState('2 minutes');
    const [tone, setTone] = useState('Persuasive');
    const [generatedScript, setGeneratedScript] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Audio State
    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioContextRef = React.useRef<AudioContext | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            try {
                const text = await readTextFile(file);
                setReadmeContent(text);
                setReadmeName(file.name);
            } catch (err) {
                console.error("Failed to read file", err);
                alert("Could not read file. Ensure it is a text/markdown file.");
            }
        }
    };

    const handleGenerate = async () => {
        if (!projectDetails && !readmeContent) {
            alert("Please provide project details or upload a README.");
            return;
        }
        
        setIsGenerating(true);
        try {
            const script = await generatePitchScript(projectDetails, readmeContent, config, duration, tone);
            setGeneratedScript(script || "No script generated. Please try again.");
        } catch (e) {
            console.error(e);
            alert("Generation failed. Check API limits.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedScript);
        alert("Script copied to clipboard!");
    };

    const handleReadAloud = async () => {
        if (!generatedScript) return;
        setIsSpeaking(true);
        try {
            // Filter out cues for reading (Markdown blockquotes and cues in parens/brackets)
            const spokenText = generatedScript
                .replace(/>\s*\[.*?\]/g, '') // Remove blockquoted cues
                .replace(/\[.*?\]/g, '') // Remove inline brackets
                .replace(/\(.*?\)/g, '') // Remove tone cues
                .replace(/##.*?(\n|$)/g, '') // Remove headers
                .trim();
            
            const audioBase64 = await generateFounderSpeech(spokenText, config.founderVoice || 'Fenrir');
            if (audioBase64) {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                audioContextRef.current = ctx;
                
                const binaryString = atob(audioBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                
                const dataInt16 = new Int16Array(bytes.buffer);
                const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
                const channelData = buffer.getChannelData(0);
                for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
                
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.onended = () => setIsSpeaking(false);
                source.start(0);
            }
        } catch (e) {
            console.error("TTS Failed", e);
            setIsSpeaking(false);
        }
    };

    const handleStopAudio = () => {
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
            setIsSpeaking(false);
        }
    };

    return (
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl h-full flex flex-col">
            <div className="p-5 bg-slate-900 border-b border-slate-800">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-lg text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    </span>
                    SCRIPT GENERATOR
                </h3>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* INPUT COLUMN */}
                <div className="w-full md:w-1/3 p-6 border-b md:border-b-0 md:border-r border-slate-800 overflow-y-auto custom-scrollbar bg-slate-900/30">
                    <div className="space-y-6">
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">1. Project Context</label>
                            
                            <div className="mb-4">
                                <label className="block text-[10px] text-slate-500 mb-1">Upload README.md (Optional)</label>
                                <div className="relative group">
                                    <input 
                                        type="file" 
                                        accept=".md,.txt" 
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className={`p-3 rounded border border-dashed flex items-center gap-2 transition-all ${readmeContent ? 'bg-green-900/20 border-green-500' : 'bg-slate-950 border-slate-700 hover:border-green-500'}`}>
                                        <svg className={`w-4 h-4 ${readmeContent ? 'text-green-500' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                        <span className={`text-xs ${readmeContent ? 'text-green-300' : 'text-slate-400'}`}>
                                            {readmeName || "Drag & Drop README.md"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <TextArea 
                                label="Key Features / Elevator Pitch" 
                                placeholder="e.g. An AI app that helps grandmothers knit using AR. Key tech: Flutter & Gemini Vision."
                                value={projectDetails}
                                onChange={(e) => setProjectDetails(e.target.value)}
                                className="h-32 text-sm bg-slate-950"
                            />
                        </div>

                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">2. Script Settings</label>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="text-[10px] text-slate-500 mb-1 block">Duration</label>
                                    <select 
                                        value={duration} 
                                        onChange={(e) => setDuration(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:border-green-500 outline-none"
                                    >
                                        <option value="30 seconds">30s (Elevator)</option>
                                        <option value="60 seconds">60s (Demo)</option>
                                        <option value="2 minutes">2 min (Full Pitch)</option>
                                        <option value="5 minutes">5 min (Deep Dive)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 mb-1 block">Tone</label>
                                    <select 
                                        value={tone} 
                                        onChange={(e) => setTone(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:border-green-500 outline-none"
                                    >
                                        <option value="Persuasive">Persuasive</option>
                                        <option value="Exciting & High Energy">High Energy</option>
                                        <option value="Professional & Technical">Technical</option>
                                        <option value="Story-driven & Emotional">Story-driven</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <Button 
                            onClick={handleGenerate} 
                            disabled={isGenerating || (!projectDetails && !readmeContent)}
                            isLoading={isGenerating}
                            className="w-full bg-green-600 hover:bg-green-500 text-white border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                        >
                            {isGenerating ? 'Synthesizing Script...' : 'Generate Pitch Script'}
                        </Button>
                    </div>
                </div>

                {/* OUTPUT COLUMN */}
                <div className="w-full md:w-2/3 p-6 overflow-y-auto custom-scrollbar bg-slate-950 relative">
                    {generatedScript ? (
                        <div className="animate-fade-in max-w-3xl mx-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">Generated Script</h2>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={isSpeaking ? handleStopAudio : handleReadAloud}
                                        className={`px-3 py-1.5 rounded border text-xs font-bold uppercase flex items-center gap-2 transition-all ${isSpeaking ? 'bg-red-900/30 border-red-500 text-red-400 animate-pulse' : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-green-400 hover:text-white'}`}
                                    >
                                        {isSpeaking ? (
                                            <>
                                                <span className="w-2 h-2 bg-red-500 rounded-full"></span> Stop
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                                                Read Aloud
                                            </>
                                        )}
                                    </button>
                                    <button 
                                        onClick={handleCopy}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded text-xs font-bold uppercase"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                            
                            <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-inner">
                                <ReactMarkdown
                                    components={{
                                        // Custom H1 (Title)
                                        h1: ({node, ...props}) => <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300 mb-6 pb-2 border-b border-slate-700" {...props} />,
                                        // Custom H2 (Timing Sections)
                                        h2: ({node, ...props}) => <h2 className="text-lg font-bold text-cyan-400 mt-8 mb-4 flex items-center gap-2 border-l-4 border-cyan-500 pl-3 py-1 bg-cyan-900/10" {...props} />,
                                        // Custom Blockquote (Visual Cues)
                                        blockquote: ({node, ...props}) => (
                                            <div className="my-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg flex gap-3 items-start group hover:border-pink-500/50 transition-colors">
                                                 <div className="mt-1 p-1 bg-pink-500/20 rounded text-pink-400">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                                 </div>
                                                 <blockquote className="text-sm text-pink-200 italic font-medium" {...props} />
                                            </div>
                                        ),
                                        // Custom Strong (Speaker Names)
                                        strong: ({node, ...props}) => <span className="text-green-400 font-bold uppercase tracking-wider text-xs" {...props} />,
                                        // Custom Paragraph
                                        p: ({node, ...props}) => <p className="text-slate-300 mb-4 leading-relaxed text-sm" {...props} />,
                                        // Custom Emphasis (Tone instructions)
                                        em: ({node, ...props}) => <span className="text-slate-500 italic text-xs ml-1" {...props} />,
                                        // Custom List
                                        ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 mb-4 text-slate-400 text-sm pl-2" {...props} />,
                                    }}
                                >
                                    {generatedScript}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                            <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                                <svg className="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-slate-500">No Script Generated Yet</h3>
                                <p className="text-sm max-w-xs mx-auto mt-2">
                                    Fill out the details on the left or upload your README.md to generate a structured pitch script.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScriptGenerator;
