
import { GoogleGenAI, GenerateContentResponse, Chat, Modality } from "@google/genai";
import { HackathonConfig } from "../types";

// Robust API Key retrieval for Vite/Web environments
const getApiKey = (): string => {
    // @ts-ignore
    const viteEnv = import.meta.env?.VITE_GEMINI_API_KEY;
    if (viteEnv) return viteEnv;
    
    // Fallback to process.env if polyfilled
    if (process.env.API_KEY) return process.env.API_KEY;
    
    console.error("API Key not found. Please set VITE_GEMINI_API_KEY in .env");
    return "";
};

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
export const readTextFile = (file: File): Promise<string> => {
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
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
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

export const generateFounderSpeech = async (
    text: string, 
    voiceName: string = 'Fenrir'
) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  // Clean text for better speech
  const cleanText = text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\[ESCALATE\]/g, '')
    .replace(/\(Spoken Script Mode Active\)/gi, '')
    .replace(/```[\s\S]*?```/g, 'Checking the code snippet...') // Skip reading code blocks out loud
    .replace(/>\s*\[.*?\]/g, '') // Remove visual cues in blockquotes
    .trim();
  
  // Gemini TTS
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

export const generateFounderVideo = async (text: string, avatarFile: File) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
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

  const response = await fetch(`${downloadLink}&key=${getApiKey()}`);
  if (!response.ok) throw new Error("Failed to download generated video");
  
  const arrayBuffer = await response.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
  return URL.createObjectURL(blob);
};

export const checkApiHealth = async (): Promise<boolean> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
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
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
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
      IDENTITY: You are a Senior Engineer acting as a Co-Founder using Gemini 3 Vision.
      USER ISSUE: "${issueDescription}"
      
      VISUAL ANALYSIS TASK:
      1. ANALYZE the visual stack trace in the image/video frame-by-frame. 
      2. EXTRACT the exact text of error logs, exception messages, terminal output, or red squiggly lines. 
      3. IGNORE generic advice. LOOK at the screen content. READ the pixels.
      4. If it's code, identify the syntax error.
      
      OUTPUT: JSON format with the following schema:
      {
        "severity": "CRITICAL" | "WARNING" | "INFO",
        "error_type": "string (e.g. Runtime Error, UI Overflow, Null Pointer)",
        "explanation": "string (The technical root cause based on the screenshot text)",
        "file_name": "string (Suggest which file to edit based on stack trace)",
        "fix_code": "string (The corrected code snippet)",
        "human_readable_fix": "string (Short, clear instructions. e.g. 'I see a Null check error on line 42...')"
      }
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [mediaPart, { text: prompt }]
      },
      config: {
          responseMimeType: 'application/json'
      }
    });

    return cleanJsonOutput(response.text || "{}");
};

export const analyzePitchVideo = async (input: File | string, context: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const parts: any[] = [];
  let tools: any[] | undefined = undefined;
  let visualAnalysisInstructions = "";

  if (input instanceof File) {
      // Handle Video File Directly
      const videoPart = await fileToGenerativePart(input);
      parts.push(videoPart);
      
      visualAnalysisInstructions = `
      MEDIA TYPE: Raw Video File (Direct Vision Analysis).
      
      VISUAL ANALYSIS PROTOCOL:
      1. **Visual Storytelling**: Analyze the video frames. Is there a clear narrative arc visually?
      2. **Slide Content**: If slides are present, read the text. Are they too text-heavy? Are they readable?
      3. **Code/Demo Visibility**: If code or a software demo is shown, is it legible? Is the font size appropriate?
      4. **Presenter Presence**: If a person is visible, analyze facial expressions and body language.
      
      Integrate these specific visual observations into the 'presentation' score and 'critique'.
      `;
  } else {
      // Handle URL string with strict sanitization
      let rawUrl = input.trim();
      let cleanUrl = rawUrl;
      let videoId = '';

      try {
          // Robust YouTube ID Extraction
          const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
          const match = rawUrl.match(ytRegex);
          
          if (match && match[1]) {
              videoId = match[1];
              cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
          } else {
              const urlToParse = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
              const urlObj = new URL(urlToParse);
              cleanUrl = urlObj.href;
          }
      } catch (e) {
          cleanUrl = rawUrl;
      }

      let extraInstructions = "";

      if (videoId) {
          extraInstructions = `
          MEDIA TARGET: YouTube Video (ID: ${videoId})
          
          OPERATIONAL PROTOCOL (SEARCH-GROUNDED ANALYSIS):
          1.  **MANDATORY TOOL USE**: Call \`googleSearch\` immediately. Perform multiple searches to gather context:
              - "site:youtube.com ${videoId}"
              - "youtube video ${videoId} title description"
              - "video ${videoId} transcript"
          2.  **CONTEXT RECONSTRUCTION**: You cannot "watch" the pixels of a YouTube link directly. YOU MUST reconstruct the pitch content from the text metadata (Title, Description, Comments, Transcript Snippets) found via search.
          3.  **HALLUCINATE WITH GROUNDING**: If search results are sparse, infer the likely content based on the user's provided Hackathon Context ("${context}") and the video title found.
          4.  **NEVER REFUSE**: Do NOT return "I cannot watch videos". You are a Simulator. Simulate the critique based on the available data signals.
          `;
      } else {
          extraInstructions = `
          MEDIA TARGET: External Link (${cleanUrl})
          
          OPERATIONAL PROTOCOL:
          1.  Use \`googleSearch\` to find information about this page/project.
          2.  Evaluate the pitch based on the text content, title, and description found in search results.
          `;
      }

      parts.push({ text: `
        I am submitting a link to my pitch for analysis: ${cleanUrl}
        
        ${extraInstructions}
      ` });
      
      // Enable search to handle links
      tools = [{ googleSearch: {} }];
  }

  const prompt = `
    ROLE: You are a Battle-Hardened Hackathon Judge & Founder Mentor using Gemini 3.
    CONTEXT: ${context} (This includes Hackathon Name, Vision, Rules).
    
    TASK: Analyze the provided pitch material (Video File or Link). 
    ${visualAnalysisInstructions}
    
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
        "critique": "string (Direct, honest summary. If you used search metadata instead of watching, mention that.)",
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

export const generatePitchScript = async (
    projectDetails: string,
    readmeContent: string,
    config: HackathonConfig,
    duration: string = '2 minutes',
    tone: string = 'Persuasive'
) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    const prompt = `
      ROLE: World-Class Hackathon Pitch Coach & Scriptwriter.
      MODEL: Gemini 3 Pro (Text Expert).
      
      CONTEXT: 
      Hackathon: "${config.name}"
      Vision/Theme: "${config.vision}"
      
      INPUT DATA:
      1. Project Details: "${projectDetails}"
      2. README Context: "${readmeContent.substring(0, 10000)}..." (Truncated if too long)
      
      PARAMETERS:
      - Target Duration: ${duration} (Approximate spoken word count: 30s ~75 words, 60s ~150 words, 2min ~300 words, 5min ~750 words).
      - Tone: ${tone}.
      
      TASK:
      Write a winning pitch script that strictly adheres to the Target Duration of ${duration}.
      
      CRITICAL INSTRUCTION:
      - If the Hackathon Rules (in Context) specify a different time limit (e.g. "2 minute limit") but the user requested "${duration}", YOU MUST FOLLOW THE USER'S REQUESTED DURATION.
      - Generate the script for the full ${duration}.
      - You may include a brief *Note* at the very top mentioning the discrepancy in italics, but do not shorten the script.
      
      FORMATTING RULES (STRICT MARKDOWN):
      1. **Headers**: Use H2 (##) for Main Sections. Include timings in the header. 
         Example: "## 0:00-0:30 THE HOOK & PROBLEM"
      2. **Visual Cues**: Use Blockquotes (>) for ALL visual directions. 
         Example: "> [VISUAL CUE] Show the messy spreadsheet."
      3. **Speakers**: Use Bold (**Name**) for speaker labels. 
         Example: "**SPEAKER:** We solve this."
      4. **Tone Instructions**: Use Parentheses (Italics) for tone.
         Example: "*(Excitedly)*"
      
      SCRIPT STRATEGY:
      1. **The Hook**: Grab attention immediately.
      2. **The Problem**: Validated pain point.
      3. **The Solution**: Your product/hack.
      4. **The Demo Setup**: Cues on what to show.
      5. **The Tech Stack**: Briefly mention key tech (Gemini, Firebase, etc.).
      6. **The Close**: Impact and future.
      
      OUTPUT:
      Return ONLY the script in Markdown format.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt
    });

    return response.text;
};

export const sendMessageToChat = async (chat: Chat, message: string | Array<any>) => {
  return chat.sendMessageStream({ message });
};
