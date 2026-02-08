
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { HackathonConfig } from "../types";

export class LiveSessionManager {
    private client: GoogleGenAI | null = null;
    private session: any = null;
    private inputContext: AudioContext | null = null;
    private outputContext: AudioContext | null = null;
    private inputSource: MediaStreamAudioSourceNode | null = null;
    private processor: ScriptProcessorNode | null = null;
    private audioQueue: Array<{ buffer: AudioBuffer, time: number }> = [];
    private nextStartTime: number = 0;
    private isConnected: boolean = false;
    private videoInterval: number | null = null;

    constructor() {}

    async connect(config: HackathonConfig, onAudioData: (isPlaying: boolean) => void, onError: (err: string) => void) {
        try {
            this.client = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            // 1. Audio Contexts
            this.inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            this.outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            // 2. Stream Setup (Mic)
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // 3. Connect to Gemini Live
            const sessionPromise = this.client.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
                    },
                    systemInstruction: `You are the Founder & Mentor for ${config.name}. 
                    Vision: ${config.vision}. 
                    You are in a live video call with a participant. Be brief, encouraging, and helpful.`,
                },
                callbacks: {
                    onopen: async () => {
                        this.isConnected = true;
                        // Stream audio from the microphone to the model.
                        this.inputSource = this.inputContext!.createMediaStreamSource(stream);
                        this.processor = this.inputContext!.createScriptProcessor(4096, 1, 1);
                        
                        this.processor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const b64Data = this.pcmToB64(inputData);
                            
                            sessionPromise.then(session => {
                                session.sendRealtimeInput({
                                    media: {
                                        mimeType: 'audio/pcm;rate=16000',
                                        data: b64Data
                                    }
                                });
                            });
                        };

                        this.inputSource.connect(this.processor);
                        this.processor.connect(this.inputContext!.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData && this.outputContext) {
                            onAudioData(true);
                            await this.playAudioChunk(audioData);
                        }
                        
                        if (msg.serverContent?.turnComplete) {
                            onAudioData(false);
                        }
                    },
                    onclose: () => {
                        this.disconnect();
                    },
                    onerror: (e: any) => {
                        console.error("Live API Error", e);
                        onError("Connection interrupted.");
                        this.disconnect();
                    }
                }
            });
            
            this.session = await sessionPromise;
            return this.session;

        } catch (e: any) {
            console.error(e);
            onError(e.message || "Failed to connect to Live API");
            throw e;
        }
    }

    startVideoStreaming(videoElement: HTMLVideoElement) {
        if (!this.session) return;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const interval = 1000 / 2; // 2 FPS to save bandwidth/quota

        this.videoInterval = window.setInterval(async () => {
            if (!this.isConnected || !ctx) return;
            
            canvas.width = videoElement.videoWidth / 4; // Downscale
            canvas.height = videoElement.videoHeight / 4;
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            
            const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
            
            this.session.sendRealtimeInput({
                media: {
                    mimeType: 'image/jpeg',
                    data: base64
                }
            });

        }, interval);
    }

    async playAudioChunk(b64Data: string) {
        if (!this.outputContext) return;
        
        const binary = atob(b64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        
        const float32 = new Float32Array(bytes.length / 2);
        const dataView = new DataView(bytes.buffer);
        
        for (let i = 0; i < bytes.length / 2; i++) {
            float32[i] = dataView.getInt16(i * 2, true) / 32768.0;
        }

        const buffer = this.outputContext.createBuffer(1, float32.length, 24000);
        buffer.getChannelData(0).set(float32);
        
        const source = this.outputContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.outputContext.destination);
        
        const currentTime = this.outputContext.currentTime;
        const startTime = Math.max(currentTime, this.nextStartTime);
        
        source.start(startTime);
        this.nextStartTime = startTime + buffer.duration;
    }

    disconnect() {
        this.isConnected = false;
        if (this.inputSource) this.inputSource.disconnect();
        if (this.processor) this.processor.disconnect();
        if (this.inputContext) this.inputContext.close();
        if (this.outputContext) this.outputContext.close();
        if (this.videoInterval) clearInterval(this.videoInterval);
        
        this.inputContext = null;
        this.outputContext = null;
    }

    private pcmToB64(data: Float32Array): string {
        const pcm16 = new Int16Array(data.length);
        for (let i = 0; i < data.length; i++) {
            pcm16[i] = Math.max(-1, Math.min(1, data[i])) * 0x7FFF;
        }
        
        let binary = '';
        const bytes = new Uint8Array(pcm16.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}
