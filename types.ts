
export enum AppView {
  SPLASH = 'SPLASH',
  FOUNDER = 'FOUNDER',
  PARTICIPANT = 'PARTICIPANT',
}

export interface HackathonConfig {
  name: string;
  vision: string;
  files: File[];
  avatarFile: File | null;
  youtubeLinks: string[];
  isPublished: boolean;
  founderVoice: string; // 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isEscalated?: boolean;
  videoUrl?: string;
  isVideoGenerating?: boolean;
  videoError?: string;
}
