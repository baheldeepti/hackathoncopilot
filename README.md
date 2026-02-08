
# 🚀 Hackathon Copilot

![Status](https://img.shields.io/badge/Status-Functional_Beta-green)
![Tech](https://img.shields.io/badge/Built_With-Gemini_3_Pro_%7C_Veo_3.1_%7C_Live_API-cyan)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**Hackathon Copilot** is a "Hackathon Operating System" designed to scale mentorship. It digitizes the hackathon organizer into an AI Founder that can mentor, debug, and judge hundreds of participants simultaneously using the new **Gemini 3** model family.

---

## 💎 Gemini 3 Integration (Judging Criteria)

This project extensively uses the Google GenAI SDK (`@google/genai`) to implement the following models:

| Feature | Model Used | Implementation Details |
| :--- | :--- | :--- |
| **The Brain (Reasoning)** | `gemini-3-pro-preview` | Ingests PDF rules, markdown docs, and codebases into the context window to answer complex queries with RAG. |
| **The Face (Video)** | `veo-3.1-fast-generate-preview` | Generates lifelike video responses from the Founder's avatar image, making mentorship feel personal. |
| **The Voice (Real-time)** | `gemini-2.5-flash-native-audio` | Powers the **Live Call** feature. We stream raw PCM audio and video frames via WebSockets for <500ms latency. |
| **The Eyes (Vision)** | `gemini-3-pro-preview` | Used in the **Multimodal Debugger** to analyze screenshots of terminal errors and UI bugs. |
| **Search Grounding** | `googleSearch` Tool | Verifies and analyzes YouTube pitch links when direct video file access is restricted. |

---

## ✨ Core Functionality

### 🏛️ For Organizers: Founder Control Deck
*   **Persona Digitization**: Upload a selfie and a 30s voice briefing. The app trains a "Digital Twin" using **Veo** (for video) and **Gemini TTS/ElevenLabs** (for voice).
*   **Knowledge Ingestion**: Drag-and-drop technical documentation, judging rubrics, and rulebooks. The AI "reads" these instantly to ground its answers.
*   **Health Dashboard**: Visual status of the Neural Clone and Knowledge Base.

### 🛠️ For Participants: The Workspace
*   **💬 Context-Aware Chat**: Ask questions like *"Is this allowed under the specific rules?"* and get answers cited from the uploaded PDFs.
*   **🐞 Multimodal Debugger**: Don't copy-paste logs. Take a screenshot or record your screen directly in the app. Gemini 3 identifies the bug visually.
*   **📹 Pitch Simulator**: Upload your demo video. The AI watches it, scores it against the rubric, and generates a **video response** of the Founder giving you feedback.
*   **📞 Live Mentorship Call**: A real-time video call interface. You can speak naturally, interrupt the AI, and even **Share Screen** for live pair programming.

---

## 🏗️ Technical Architecture

*   **Frontend**: React 19, TypeScript, Vite.
*   **Styling**: Tailwind CSS (Glassmorphism/Cyberpunk aesthetic).
*   **State Management**: React Hooks + IndexedDB (for persisting large video assets).
*   **Audio Pipeline**: Custom Web Audio API processors for PCM encoding/decoding (16kHz Input / 24kHz Output).

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

## 🧪 How to Test (Demo Flow)

1.  **Splash Screen**: Click **"Launch Demo Account"** under "Founder".
2.  **Founder Dashboard**:
    *   Notice the pre-loaded "Tech Stack" and "Rules" documents.
    *   Click **"Rec Briefing"** to record a 5s voice sample (or use the default).
    *   Click **"Publish Knowledge"**.
3.  **Switch Roles**: Log out and join as a **Participant** (Launch Demo).
4.  **Chat**: Ask *"What is the tech stack?"* (It will answer based on the Founder's docs).
5.  **Pitch**: Go to the **PITCH** tab. Paste a YouTube link or upload an MP4. Watch the AI generate a video critique.
6.  **Live Call**: Click **"LIVE VIDEO CALL"**. Speak to the AI. Try **Share Screen** to show it code.

---

## 🔮 Future Roadmap
*   **Multi-Agent Swarm**: Spawning specialized agents (Designer, Backend Dev) into the chat.
*   **IDE Plugin**: Direct integration into VS Code.
*   **Post-Event Analytics**: Aggregated report of common participant struggles.

---

*Built for the Gemini 3 Global Hackathon.*
