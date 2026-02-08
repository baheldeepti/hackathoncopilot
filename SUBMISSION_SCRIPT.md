# Hackathon Copilot - Submission Narrative

## 💡 The Inspiration
Hackathons are fueled by adrenaline, but they often suffer from a "Mentorship Gap." Founders and organizers have a clear vision, but they can't be everywhere at once to guide hundreds of participants. Participants often get stuck on technical setup, misunderstand the judging criteria, or fail to polish their pitch until it's too late.

We asked: **"What if we could clone the Founder?"**

Not just a chatbot, but a multimodal, visually present, and vocally active digital twin that knows every rule, document, and goal of the hackathon.

## 🤖 What It Does
**Hackathon Copilot** is a dual-interface platform:

1.  **The Founder Control Deck**:
    -   Allows organizers to upload "Knowledge" (PDFs, Docs, Code).
    -   Uses **Veo 3.1** to generate a video avatar from a single photo.
    -   Analyzes the founder's voice sample to match the perfect AI voice or create a Neural Clone.

2.  **The Participant Terminal**:
    -   **Context-Aware Chat**: Answers questions citing the specific uploaded docs.
    -   **Multimodal Debugger**: Participants can record their screen inside the app. The AI watches the video, reads the error logs, and provides a fix.
    -   **Pitch Simulator**: Participants upload their demo video. The AI acts as a judge, providing a scored rubric and a **spoken video critique** from the Founder Avatar.
    -   **Gemini Live Call**: A low-latency video call where participants can speak naturally to the AI Founder to brainstorm ideas or vent frustrations.

## ⚙️ How We Built It

### 1. The Brain: Gemini 3 Pro
We used `gemini-3-pro-preview` for its massive context window. When a participant joins, the app hydrates the chat session with the Founder's uploaded files (RAG) and Vision Statement. This ensures every answer is grounded in reality, not hallucination.

### 2. The Face: Veo & Generative Video
Using `veo-3.1-fast-generate-preview`, we create dynamic video responses. When the AI "Coaches" a pitch, it doesn't just output text—it generates a video of the Founder speaking the feedback, making the mentorship feel personal.

### 3. The Voice: Native Audio Streaming
For the "Live Call" feature, we utilized the **Gemini Live API**.
-   **Input**: We stream raw PCM audio from the browser's microphone and video frames from the webcam via WebSockets.
-   **Output**: The model returns raw audio PCM chunks, which we decode and play directly through the Web Audio API for ultra-low latency interaction.

### 4. The Eyes: Multimodal Reasoning
The Debugger uses the vision capabilities of Gemini. By taking a `Blob` from the `MediaRecorder` API (Screen Share) and sending it as an inline data part, Gemini can "see" the IDE error codes that a user might struggle to copy-paste.

## 🚧 Challenges We Ran Into
-   **Audio Latency**: Implementing the raw PCM audio stream for the Live API was tricky. Browsers handle sample rates differently (44.1kHz vs 48kHz), while Gemini expects 16kHz input and 24kHz output. We wrote custom audio buffer resampling logic to bridge this gap.
-   **Asset Persistence**: We wanted the "Founder Persona" to persist even if the user refreshed the page. Since video blobs are too large for `localStorage`, we implemented an **IndexedDB** adapter to store the Avatar and Briefing videos locally in the browser.

## 🏆 Accomplishments We're Proud Of
-   **Real-time Screen Sharing**: The ability to click "Share Screen" during a live AI call and have the model understand what it's looking at is a game-changer for debugging.
-   **Seamless Persona**: The combination of Veo for visuals and ElevenLabs/Gemini TTS for audio creates a convincing "Digital Twin" experience.

## 🔮 What's Next?
-   **Multi-Agent Teams**: Allowing the Founder AI to spawn "Specialist Agents" (e.g., a Database Expert or UI/UX Critic) into the group chat.
-   **Live Code Collaboration**: Integrating directly with GitHub Codespaces to let the AI edit code in real-time.
