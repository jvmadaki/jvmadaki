import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  status: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, status }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-gray-900/50 rounded-2xl mx-2 mb-2 border border-gray-800">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60">
          <p className="text-center italic">"How far? I dey here for you."</p>
          <p className="text-xs mt-2">Start talking to Padimi</p>
        </div>
      )}
      
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg ${
              msg.role === 'user'
                ? 'bg-green-600 text-white rounded-br-none'
                : 'bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700'
            } ${!msg.isFinal ? 'opacity-80 animate-pulse' : ''}`}
          >
             {msg.role === 'model' && (
                <span className="block text-xs font-bold text-green-400 mb-1 tracking-wide">Padimi</span>
             )}
            {msg.text}
          </div>
        </div>
      ))}
      <div ref={scrollRef} />
    </div>
  );
};
