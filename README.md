
# 🚀 Hackathon Copilot

![Status](https://img.shields.io/badge/Status-Functional_Beta-green)
![Tech](https://img.shields.io/badge/Built_With-Gemini_3_Pro_%7C_Veo_3.1_%7C_Live_API-cyan)
![SDK](https://img.shields.io/badge/SDK-@google/genai-blue)

**Hackathon Copilot** is a "Hackathon Operating System" designed to solve the *Mentorship Gap*. It digitizes the hackathon organizer into an AI Founder that can mentor, debug, judge, and write scripts for hundreds of participants simultaneously using the new **Gemini 3** model family.

---

## 💎 Gemini 3 Integration & Model Usage

We utilize the full spectrum of the `@google/genai` SDK to power specific features:

| Feature | Model / Tool | Implementation Details |
| :--- | :--- | :--- |
| **Architect & Build (Chat)** | `gemini-3-pro-preview` | Uses the massive context window to ingest uploaded documentation (PDFs, Markdown, Code) for RAG-grounded technical answers. |
| **Visual Debugger** | `gemini-3-pro-preview` (Vision) | Analyzes screenshots of terminal logs or UI bugs. It performs pixel-level OCR to extract stack traces and suggest code fixes. |
| **Live Mentorship Call** | `gemini-2.5-flash-native-audio` | Powers the **Live API** connection. We stream raw PCM audio (16kHz) and video frames (screen share) via WebSockets for <500ms latency interaction. |
| **Founder Avatar Video** | `veo-3.1-fast-generate-preview` | Generates lifelike video responses from the Founder's static avatar image, making pitch critiques feel personal and human. |
| **Pitch Link Analysis** | `googleSearch` Tool | Used when analyzing YouTube links to find metadata, transcripts, and context when direct video access is restricted. |
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

#### A. 💬 Context-Aware Chat (RAG)
*   Ask questions like *"Is this tech stack allowed?"* or *"How do I implement X feature?"*.
*   The model answers citing the specific files uploaded by the organizer.

#### B. 📞 Live Video Call (Gemini Live API)
*   **Real-time Voice**: Speak naturally to the AI Founder. It handles interruptions and emotional tone.
*   **Screen Share Vision**: Participants can toggle "Share Screen". The app sends video frames to the model, allowing the AI to "see" code and debug in real-time.
*   **Dynamic Resolution**: The video stream quality automatically scales up when sharing code to ensure text legibility.

#### C. 🐞 Visual Stack Trace
*   Upload a screenshot of an error.
*   Gemini 3 Pro analyzes the pixels, extracts the error text, identifies the file, and provides a copy-paste code fix.

#### D. 🎤 Pitch Simulator (Veo & Search)
*   **Input**: Upload a demo video file or paste a YouTube link.
*   **Analysis**: The AI uses `googleSearch` (for links) or Vision (for files) to grade the pitch against the rubric.
*   **Veo Response**: The system generates a **video of the Founder** delivering the feedback verbally.

#### E. 📝 Neural Scriptwriter
*   **Input**: Upload your project's `README.md`.
*   **Output**: The AI reasons over your project details and generates a persuasive script formatted for specific time limits (30s/60s/2min).

---

## 🏗️ Technical Architecture

*   **Frontend**: React 19, TypeScript, Vite.
*   **Audio Pipeline**: Custom `AudioContext` processing to convert browser audio (Float32) to Gemini-compatible PCM16 (Int16) and back.
*   **Persistence**: Uses **IndexedDB** to store large assets (Avatar images, Video blobs) locally, ensuring the "Founder Persona" persists across reloads without a backend database.
*   **Styling**: Tailwind CSS with a "Cyber-Glass" aesthetic.

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
4.  **Test Script Gen**:
    *   Go to the **SCRIPT** tab.
    *   Upload a sample `README.md` (or type "AI that helps dogs find homes").
    *   Click "Generate".
5.  **Test Live Call**:
    *   Click the **"LIVE UPLINK"** button in the Chat tab.
    *   Speak to the AI. Click "Share Screen" and show it some code.
6.  **Test Pitch**:
    *   Go to the **PITCH** tab.
    *   Paste a YouTube link (e.g., a past hackathon winner).
    *   Watch the analysis and the **Veo-generated video response**.

---

## 🔮 Future Roadmap
*   **Multi-Agent Swarm**: Spawning specialized agents (Designer, Backend Dev) into the chat.
*   **IDE Plugin**: Direct integration into VS Code.
*   **Post-Event Analytics**: Aggregated report of common participant struggles for organizers.

---

*Built for the Gemini 3 Global Hackathon.*
