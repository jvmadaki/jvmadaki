import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Settings, AlertCircle, Loader2 } from 'lucide-react';
import { ConnectionStatus, ChatMessage } from './types';
import { GeminiLiveService } from './services/geminiLiveService';
import { Visualizer } from './components/Visualizer';
import { ChatInterface } from './components/ChatInterface';

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const liveServiceRef = useRef<GeminiLiveService | null>(null);

  // Initialize Service
  useEffect(() => {
    // Per guidelines, assume process.env.API_KEY is available and do not manage/check it in UI.
    liveServiceRef.current = new GeminiLiveService();

    return () => {
      liveServiceRef.current?.disconnect();
    };
  }, []);

  const handleTranscript = useCallback((text: string, isUser: boolean, isFinal: boolean) => {
    setMessages(prev => {
      const role = isUser ? 'user' : 'model';
      // If the last message is from the same role and is NOT final, update it.
      // If it IS final, we might still update it if we are refining the same turn.
      // However, to simplify, if we receive a non-final update, we check if the last message is pending.
      
      const lastMsg = prev[prev.length - 1];
      
      if (lastMsg && lastMsg.role === role && !lastMsg.isFinal) {
        // Update existing pending message
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...lastMsg,
          text: text,
          isFinal: isFinal
        };
        return updated;
      } else {
        // Create new message
        const newMsg: ChatMessage = {
          id: Date.now().toString() + Math.random().toString(),
          role,
          text,
          timestamp: new Date(),
          isFinal
        };
        return [...prev, newMsg];
      }
    });
  }, []);

  const toggleConnection = async () => {
    if (status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING) {
      liveServiceRef.current?.disconnect();
      setStatus(ConnectionStatus.DISCONNECTED);
      setVolume(0);
    } else {
      setError(null);
      await liveServiceRef.current?.connect(
        (newStatus) => setStatus(newStatus),
        handleTranscript,
        (vol) => setVolume(vol)
      );
    }
  };

  const isConnected = status === ConnectionStatus.CONNECTED;
  const isConnecting = status === ConnectionStatus.CONNECTING;

  return (
    <div className="flex flex-col h-screen bg-black text-gray-100 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 z-10">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-green-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-green-900/20">
              <span className="text-xl font-bold text-white">P</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Padimi</h1>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                <span className="text-xs text-gray-400 font-medium">
                  {status === ConnectionStatus.CONNECTED ? 'Live & Listening' : 'Offline'}
                </span>
              </div>
            </div>
        </div>
        {/* Placeholder for settings if needed */}
        <button className="p-2 text-gray-400 hover:text-white transition-colors">
          <Settings size={20} />
        </button>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative max-w-2xl w-full mx-auto">
        <ChatInterface messages={messages} status={status} />

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mb-4 p-3 bg-red-900/50 border border-red-800 rounded-lg flex items-center gap-3 text-red-200 text-sm">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="p-6 pt-0 flex flex-col items-center justify-center gap-6">
          
          {/* Visualizer Area */}
          <div className={`transition-all duration-500 ${isConnected ? 'opacity-100 scale-100' : 'opacity-50 scale-95 grayscale'}`}>
             <Visualizer isPlaying={isConnected} volume={volume} />
          </div>

          {/* Main Action Button */}
          <button
            onClick={toggleConnection}
            disabled={isConnecting}
            className={`
              relative group flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-xl
              ${isConnected 
                ? 'bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500 text-red-500' 
                : 'bg-gradient-to-br from-green-500 to-emerald-600 hover:scale-105 hover:shadow-green-500/25 text-white border-0'
              }
              ${isConnecting ? 'cursor-not-allowed opacity-80' : ''}
            `}
          >
            {isConnecting ? (
              <Loader2 className="animate-spin w-8 h-8" />
            ) : isConnected ? (
              <MicOff className="w-8 h-8" />
            ) : (
              <Mic className="w-8 h-8 fill-current" />
            )}
            
            {/* Ripple Effect when live */}
            {isConnected && (
               <span className="absolute inset-0 rounded-full border border-red-500 animate-ping opacity-20"></span>
            )}
          </button>

          <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">
            {isConnected ? 'Tap to End Call' : 'Tap to Start Chat'}
          </p>
        </div>
      </main>
    </div>
  );
};

export default App;