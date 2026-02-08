
# 🚀 Hackathon Copilot

![Status](https://img.shields.io/badge/Status-Operational-green)
![Tech](https://img.shields.io/badge/Stack-Gemini_3_Pro_%7C_Veo_3.1_%7C_Live_API-cyan)
![SDK](https://img.shields.io/badge/SDK-@google/genai-blue)

**Hackathon Copilot** is a "Hackathon Operating System" designed to bridge the *Mentorship Gap*. It digitizes the hackathon organizer into an AI Founder that can mentor, debug, judge, and write scripts for hundreds of participants simultaneously using the complete **Gemini 3** model family.

---

## 💎 Gemini 3 Integration & Model Usage

We utilize the full spectrum of the `@google/genai` SDK to power specific features:

| Feature | Model / Tool | Implementation Details |
| :--- | :--- | :--- |
| **Architect & Build (Chat)** | `gemini-3-pro-preview` | Uses the massive context window to ingest uploaded documentation (PDFs, Markdown, Code) for RAG-grounded technical answers. |
| **Visual Debugger** | `gemini-3-pro-preview` (Vision) | Analyzes screenshots of terminal logs or UI bugs. It performs pixel-level OCR to extract stack traces and suggest code fixes. |
| **Live Mentorship Call** | `gemini-2.5-flash-native-audio` | Powers the **Live API** connection. We stream raw PCM audio (16kHz) and video frames (Webcam or Screen Share) via WebSockets for <500ms latency interaction. |
| **Founder Avatar Video** | `veo-3.1-fast-generate-preview` | Generates lifelike video responses from the Founder's static avatar image, making chat responses feel personal and human. |
| **Pitch Video Analysis** | `gemini-3-pro-preview` (Vision) | **Direct File Upload**: Analyzes video frames for visual storytelling, slide density, and body language. |
| **Pitch Link Analysis** | `googleSearch` Tool | **Link Paste**: Uses Search Grounding to reconstruct context/metadata from YouTube/Loom links when direct pixel access is restricted. |
| **Script Generator** | `gemini-3-pro-preview` | Synthesizes a project's `README.md` into a perfectly timed 30s, 60s, or 2min pitch script using advanced reasoning. |

---

## 🧠 End-to-End Workflow

### 1. 🏛️ For Organizers: The Founder Control Deck
The organizer sets the "Soul" of the hackathon.
*   **Persona Digitization**: Upload a selfie to train the **Veo** video model. Select a voice profile (e.g., Fenrir, Kore) for TTS and Live Audio.
*   **Knowledge Ingestion**: Drag-and-drop technical documentation, judging rubrics, and rulebooks. The AI "reads" these instantly to ground its answers.
*   **Health Dashboard**: Visual status of the Neural Clone and Knowledge Base assets.

### 2. 🛠️ For Participants: The Neural Workspace
Participants access a dashboard pre-loaded with the Organizer's context.

#### A. 💬 Context-Aware Chat (RAG + Veo)
*   **RAG**: Answers questions citing the specific files uploaded by the organizer.
*   **Veo Clones**: If "Founder Mode" is enabled, the AI generates a **video response** of the organizer speaking the answer, using the uploaded avatar image.

#### B. 📞 Live Uplink (Gemini Live API)
*   **Real-time Voice**: Speak naturally to the AI Founder. It handles interruptions and emotional tone.
*   **Screen Share Vision**: Participants can click **"Share Screen"** inside the call. The app captures the screen stream, converts frames to Base64, and sends them to the model in real-time, allowing the AI to "see" code and debug live.
*   **Holographic HUD**: Immersive UI with real-time latency metrics and recording status.

#### C. 🐞 Visual Stack Trace
*   **Input**: Upload a screenshot of an error or click "Capture Screen".
*   **Analysis**: Gemini 3 Pro analyzes the pixels, extracts the error text, identifies the file, and provides a copy-paste code fix.

#### D. 🎤 Pitch Simulator (Dual-Mode)
*   **File Mode**: Upload a `.mp4` file. Gemini Vision analyzes the actual frames (slides, body language).
*   **Link Mode**: Paste a YouTube link. Gemini uses `googleSearch` to find the video title, description, and transcript to grade the content.
*   **Feedback**: Generates a scored rubric and **spoken audio commentary** from the Founder persona.

#### E. 📝 Neural Scriptwriter
*   **Input**: Upload your project's `README.md`.
*   **Output**: The AI reasons over your project details and generates a persuasive script formatted for specific time limits (30s/60s/2min).
*   **Rehearsal**: Click "Read Aloud" to hear the Founder voice read the script to you for timing checks.

---

## 🏗️ Technical Architecture

*   **Frontend**: React 19, TypeScript, Vite.
*   **Audio Pipeline**: Custom `AudioContext` processing to convert browser audio (Float32) to Gemini-compatible PCM16 (Int16) and back.
*   **Persistence**: Uses **IndexedDB** to store large assets (Avatar images, Video blobs) locally, ensuring the "Founder Persona" persists across reloads without a backend database.
*   **Live Streaming**: Custom `LiveSessionManager` class handles WebSocket handshakes and synchronized Audio/Video frame buffer management.

---

## 🚀 Getting Started

### 1. Prerequisites
*   **Node.js** (v18+)
*   **Google AI Studio API Key** (Must be Pay-as-you-go/Paid tier to use **Veo** and **Live API**).

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/hackathon-copilot.git

# Enter directory
cd hackathon-copilot

# Install dependencies
npm install
```

### 3. Configuration
Create a `.env` file in the root directory:
```env
VITE_GEMINI_API_KEY=your_actual_api_key_here
```

### 4. Run Locally
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Demo Walkthrough (How to Judge)

1.  **Splash Screen**: Click **"Launch Demo Account"** under the **Founder** card.
2.  **Founder Dashboard**:
    *   Observe the pre-loaded "Tech Stack" and "Rules" documents.
    *   Upload a photo of yourself (or use the default generated one) as the Avatar.
    *   Click **"Publish Knowledge"** to hydrate the context.
3.  **Switch Roles**: Log out and click **"Launch Demo Account"** under the **Participant** card.
4.  **Test Live Call**:
    *   Go to **Chat** -> Click **"LIVE UPLINK"**.
    *   Speak to the AI. Click **"Share Screen"** to show your code window. The AI will comment on what it sees.
5.  **Test Pitch**:
    *   Go to the **PITCH** tab.
    *   Paste a YouTube link OR upload a video file.
    *   Review the JSON score and listen to the audio feedback.
6.  **Test Script Gen**:
    *   Go to the **SCRIPT** tab.
    *   Upload a sample `README.md`.
    *   Click "Generate Pitch Script" and then "Read Aloud".

---

*Built for the Gemini 3 Global Hackathon.*
