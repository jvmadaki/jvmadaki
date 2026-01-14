export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

export interface AudioVisualizerProps {
  isPlaying: boolean;
  volume: number; // 0 to 1
  barColor?: string;
}
