
import { GoogleGenAI, GenerateContentResponse, Chat, Modality } from "@google/genai";
import { HackathonConfig } from "../types";

// Helper to convert File to Base64
export const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      }
    };
    reader.readAsDataURL(file);
  });
  
  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type,
    },
  };
};

// Helper to read text files for RAG context
const readTextFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

// Helper to convert Blob to Generative Part (for Voice/Video recordings)
export const blobToGenerativePart = async (blob: Blob, mimeType: string) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      }
    };
    reader.readAsDataURL(blob);
  });
  
  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: mimeType,
    },
  };
};

// --- NEW HELPER: JSON CLEANER ---
const cleanJsonOutput = (text: string): string => {
  let cleaned = text.trim();
  // Remove markdown code blocks if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?/, '').replace(/```$/, '');
  }
  return cleaned.trim();
};

export const createHackathonChat = async (config: HackathonConfig): Promise<Chat> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const linksContext = config.youtubeLinks.length > 0 
    ? `\n\nEXTERNAL REFERENCE LINKS (The user may ask about these):\n${config.youtubeLinks.map(l => `- ${l}`).join('\n')}`
    : '';

  const systemInstruction = `
    IDENTITY: You are the Founder & Technical Lead for "${config.name}".
    You are NOT a generic AI. You are a human co-founder in "Founder Mode".

    YOUR MISSION: "${config.vision}"

    PERSONALITY PROTOCOLS:
    1. **Empathetic & Real**: Hackathons are chaotic. Acknowledge the user's stress. Use phrases like "I know this is tricky," "We're crunching for time," or "That error is a pain."
    2. **Socratic & Clarifying**: Do NOT just dump code. First, ASK CLARIFYING QUESTIONS to understand their setup. 
       - Bad: "Here is how to deploy to GCP..."
       - Good: "Deploying to GCP is a beast. Are you using Cloud Run with Docker, or just trying to push static files to Firebase? Let me know so I can give you the right commands."
    3. **First Person**: Use "I", "We", "My vision". You are part of the team.
    4. **Direct & Punchy**: Keep responses concise unless explaining a complex bug.

    MULTIMODAL RAG BEHAVIOR:
    - I have injected your "Knowledge Base" files (Docs, PDFs, Code) into this session context.
    - If a user asks a question covered by these files, ANSWER BASED ON THE FILE and cite it. Example: "As listed in the 'Tech_Stack.md', we are using Flutter..."
    - If you are unsure, ask!

    CONTEXT:
    Hackathon Name: "${config.name}"
    ${linksContext}
  `;

  // Construct Multimodal History to "Ground" the model in the Founder's actual data
  const initialUserParts: any[] = [];
  
  // 1. Add System Text
  initialUserParts.push({ text: systemInstruction });

  // 2. RAG: Ingest Text and PDF Files
  for (const file of config.files) {
      if (file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.json') || file.name.endsWith('.dart') || file.name.endsWith('.ts')) {
          try {
              const textContent = await readTextFile(file);
              initialUserParts.push({ text: `[KNOWLEDGE BASE - FILE: ${file.name}]\n${textContent}\n[END FILE]` });
          } catch (e) { console.error(`Failed to ingest text file ${file.name}`, e); }
      } 
      else if (file.type === 'application/pdf') {
          try {
             const pdfPart = await fileToGenerativePart(file);
             initialUserParts.push(pdfPart);
             initialUserParts.push({ text: `[KNOWLEDGE BASE - FILE: ${file.name} (See PDF attached above)]` });
          } catch(e) { console.error(`Failed to ingest PDF ${file.name}`, e); }
      }
  }

  // 3. Add Founder Avatar (Visual Context)
  if (config.avatarFile) {
      try {
        const avatarPart = await fileToGenerativePart(config.avatarFile);
        initialUserParts.push(avatarPart);
        initialUserParts.push({ text: " [SYSTEM] Attached above is YOUR photo. This is your digital avatar. Be consistent with this identity." });
      } catch (e) { console.error("Failed to attach avatar", e); }
  }

  // 4. Add Briefing Video (Audio/Visual Context)
  const briefingVideo = config.files.find(f => f.name.includes('briefing') || f.type.startsWith('video/'));
  if (briefingVideo) {
      try {
        // Only attach if reasonable size for a demo (skip huge files to prevent browser crash)
        if (briefingVideo.size < 50 * 1024 * 1024) { 
            const videoPart = await fileToGenerativePart(briefingVideo);
            initialUserParts.push(videoPart);
            initialUserParts.push({ text: " [SYSTEM] Attached above is YOUR Keynote/Briefing. LISTEN to your own voice, tone, and gestures in this video. MIMIC this personality exactly in your text responses." });
        }
      } catch (e) { console.error("Failed to attach briefing video", e); }
  } else {
      initialUserParts.push({ text: " [SYSTEM] No video briefing found. Rely strictly on the text vision statement." });
  }

  const history = [
      {
          role: 'user',
          parts: initialUserParts
      },
      {
          role: 'model',
          parts: [{ text: "I'm online. I've read the briefing and the technical docs. What's the status? Are we stuck or shipping?" }]
      }
  ];
  
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    history: history,
  });
};

export const createElevenLabsVoice = async (apiKey: string, name: string, audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('name', `${name} (Hackathon Copilot Clone)`);
    // Ensure we send a file with a name and correct type
    formData.append('files', new File([audioBlob], 'sample.webm', { type: 'audio/webm' }));
    formData.append('description', 'Cloned via Hackathon Copilot');

    try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                // Note: Do NOT set Content-Type header when sending FormData, fetch sets it automatically with boundary
            },
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail?.message || "Failed to create voice clone");
        }

        const data = await response.json();
        return data.voice_id; // Returns the new Voice ID
    } catch (e) {
        console.error("ElevenLabs Creation Error", e);
        throw e;
    }
};

export const generateFounderSpeech = async (
    text: string, 
    voiceName: string = 'Fenrir',
    elevenLabs?: { apiKey: string, voiceId: string }
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Clean text for better speech
  const cleanText = text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\[ESCALATE\]/g, '')
    .replace(/\(Spoken Script Mode Active\)/gi, '')
    .replace(/```[\s\S]*?```/g, 'Checking the code snippet...') // Skip reading code blocks out loud
    .trim();
  
  // 1. Check for ElevenLabs override
  if (elevenLabs && elevenLabs.apiKey && elevenLabs.voiceId) {
      try {
          const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabs.voiceId}`, {
              method: 'POST',
              headers: {
                  'xi-api-key': elevenLabs.apiKey,
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  text: cleanText,
                  model_id: "eleven_monolingual_v1",
                  voice_settings: {
                      stability: 0.5,
                      similarity_boost: 0.75
                  }
              })
          });

          if (!response.ok) {
              const err = await response.text();
              console.error("ElevenLabs Error", err);
              throw new Error("ElevenLabs API Error");
          }
          
          const arrayBuffer = await response.arrayBuffer();
          // Convert ArrayBuffer to Base64
          let binary = '';
          const bytes = new Uint8Array(arrayBuffer);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
              binary += String.fromCharCode(bytes[i]);
          }
          return btoa(binary);
      } catch (e) {
          console.warn("ElevenLabs failed, falling back to Gemini TTS", e);
          // Fallback proceeds to Gemini code below
      }
  }

  // 2. Default: Gemini TTS
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: cleanText }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

export const validateAudioForCloning = async (audioBlob: Blob): Promise<{score: number, issues: string[], suitable: boolean}> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const audioPart = await blobToGenerativePart(audioBlob, 'audio/webm');
        const prompt = `
        You are an Audio Engineer specializing in Voice Cloning datasets.
        
        TASK: Analyze the audio quality of this file for ElevenLabs voice cloning suitability.
        CHECK FOR:
        1. Background Noise (Must be low)
        2. Clarity/Articulation (Must be high)
        3. Volume/Clipping (Must be balanced)
        4. Duration (Ideally >30s)

        OUTPUT: STRICT JSON ONLY. No Markdown.
        {
            "score": number (0-100),
            "issues": ["string", "string"], (List specific problems e.g. "Too much echo", "Background chatter detected")
            "suitable": boolean (true if score > 70)
        }
        `;

        // Switch to Flash 3 Preview for robust multimodal analysis and JSON support
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [audioPart, { text: prompt }] },
            config: {
                responseMimeType: "application/json"
            }
        });

        const json = cleanJsonOutput(response.text || "{}");
        return JSON.parse(json);
    } catch (e) {
        console.error("Audio validation error", e);
        return { score: 0, issues: ["Analysis Failed"], suitable: false };
    }
};

export const analyzeVoiceMatch = async (audioFile: File | Blob): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let part;
    if (audioFile instanceof File) {
        part = await fileToGenerativePart(audioFile);
    } else {
        part = await blobToGenerativePart(audioFile, 'video/webm'); // Assuming input is from recorder
    }

    const prompt = `
      You are an Audio Engineer.
      Task: Listen to the speaker in this audio. Analyze their gender, pitch (High, Medium, Deep), and tone (Energetic, Calm, Authoritative).
      
      Match them to the CLOSEST Prebuilt Voice Profile from this list:
      1. 'Puck' (Male, Deep, Neutral)
      2. 'Charon' (Male, Deep, Authoritative)
      3. 'Kore' (Female, Calm, Soothing)
      4. 'Fenrir' (Male, Energetic, Higher Pitch)
      5. 'Zephyr' (Female, Energetic, Professional)

      OUTPUT ONLY THE NAME OF THE MATCHING VOICE (e.g. "Puck"). Do not add markdown.
    `;

    // Switch to Flash 3 Preview for robust multimodal analysis
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [part, { text: prompt }]
        }
    });

    const match = response.text?.trim() || 'Fenrir';
    // Sanitize
    const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const cleanMatch = validVoices.find(v => match.includes(v)) || 'Fenrir';
    return cleanMatch;
};

export const generateFounderVideo = async (text: string, avatarFile: File) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const avatarPart = await fileToGenerativePart(avatarFile);
  
  const prompt = `A cinematic, realistic video of this person talking to the camera. 
  Expression: Encouraging, friendly, slightly animated. 
  Action: Speaking naturally.
  The person is saying: "${text.substring(0, 150)}..."`;

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    image: {
      imageBytes: avatarPart.inlineData.data,
      mimeType: avatarPart.inlineData.mimeType,
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  // Long-polling
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed to return a URI");

  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!response.ok) throw new Error("Failed to download generated video");
  
  const arrayBuffer = await response.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
  return URL.createObjectURL(blob);
};

export const checkApiHealth = async (): Promise<boolean> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'ping',
        });
        return !!response.text;
    } catch (e) {
        console.error("Health check failed", e);
        return false;
    }
};

export const analyzeScreenRecording = async (mediaFile: File | Blob, issueDescription: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let mediaPart;
    
    // Determine mime type if possible
    let mimeType = 'video/webm'; // default
    if (mediaFile instanceof File) {
        mimeType = mediaFile.type;
        mediaPart = await fileToGenerativePart(mediaFile);
    } else {
        // Use blob type if available, otherwise default to webm
        mimeType = mediaFile.type || 'video/webm';
        mediaPart = await blobToGenerativePart(mediaFile, mimeType);
    }
    
    const prompt = `
      IDENTITY: You are a Senior Engineer acting as a Co-Founder.
      USER ISSUE: "${issueDescription}"
      TASK: 
      1. Analyze the screen recording or screenshot provided.
      2. **IDENTIFY THE ERROR**: Look for red text, error logs, or UI bugs.
      3. **IF THE INPUT IS UNCLEAR**: Explicitly ask the user: "I can't read the error message..."
      4. **IF THE ERROR IS VISIBLE**: Provide the specific code fix immediately.
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [mediaPart, { text: prompt }]
      }
    });

    return response.text;
};

export const analyzePitchVideo = async (input: File | string, context: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [];
  let tools: any[] | undefined = undefined;

  if (input instanceof File) {
      // Handle Video File
      const videoPart = await fileToGenerativePart(input);
      parts.push(videoPart);
  } else {
      // Handle URL string
      let cleanUrl = input.trim();
      let extraInstructions = "";

      // YouTube Specific Logic
      if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
          extraInstructions = `
          NOTE: This is a YouTube link. 
          1. Use the 'googleSearch' tool to search for the specific VIDEO ID found in the URL.
          2. Try to find the transcript, title, and description from the search results.
          3. If the direct video content is inaccessible, base your analysis on the text metadata (Title, Description, Reviews/Transcript) found via search.
          `;
      }

      parts.push({ text: `
        I am providing a link to my pitch video: ${cleanUrl}.
        ${extraInstructions}
        Please search for it using Google Search to find metadata, length, or content if available.
        If you absolutely cannot access the content, return a JSON with "critique": "Error: Video content not accessible. Please upload the file directly."
      ` });
      
      // Enable search to handle links
      tools = [{ googleSearch: {} }];
  }

  const prompt = `
    ROLE: You are a Battle-Hardened Hackathon Judge & Founder Mentor.
    CONTEXT: ${context} (This includes Hackathon Name, Vision, Rules).
    
    TASK: Analyze the provided pitch (video or link). 
    
    CRITERIA FOR SCORING (Typical Hackathon Standards):
    1. Innovation (Is it novel?)
    2. Impact (Does it solve the stated problem?)
    3. Tech Implementation (Is it real code or just slides?)
    4. Presentation (Clarity, pacing, tone).

    ANALYSIS REQUIRED:
    1. **Structure Breakdown**: Compare their current time allocation vs an ideal winning structure.
    2. **Tone Analysis**: Check confidence, energy, and speed.
    3. **Maximizing Points**: Actionable advice to hit the judging criteria.

    OUTPUT FORMAT: JSON ONLY (No Markdown).
    Structure:
    {
        "scores": {
            "innovation": number (0-100),
            "impact": number (0-100),
            "technology": number (0-100),
            "presentation": number (0-100)
        },
        "critique": "string (Direct, honest summary)",
        "structure_analysis": {
             "current": "string (e.g., '0:00-0:40 Intro, 0:40-1:00 Demo')",
             "ideal": "string (e.g., '0:00-0:15 Hook, 0:15-1:15 Demo, 1:15-2:00 Tech Stack')",
             "advice": "string (Comparison feedback, e.g., 'Cut the intro, show the demo sooner.')"
        },
        "tone_analysis": "string (e.g., 'Monotonous and slow. Need more energy to keep judges awake.')",
        "improvements": ["string", "string", "string"],
        "spoken_commentary": "string (A short, encouraging 2-3 sentence speech as a mentor to the user, to be spoken by TTS. Be user-friendly.)",
        "script_enhancements": [
            { "context": "When you said...", "suggested_line": "Better phrasing..." }
        ]
    }
  `;
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
          responseMimeType: 'application/json',
          tools: tools
      }
  });

  return cleanJsonOutput(response.text || "{}");
};

export const sendMessageToChat = async (chat: Chat, message: string | Array<any>) => {
  return chat.sendMessageStream({ message });
};
