import React, { useState, useRef, useEffect } from 'react';

interface Message {
  sender: string;
  content: string;
  timestamp: string;
}

interface Props {
  messages: Message[];
  onSend: (content: string) => void;
  onClose: () => void;
}

export function ConversationPanel({ messages, onSend, onClose }: Props) {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <span className="text-sm font-medium text-gray-700">Conversación activa</span>
        <button
          onClick={onClose}
          className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"
        >
          Cerrar conversación
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[70%] px-3 py-2 rounded-xl text-sm ${
                msg.sender === 'agent'
                  ? 'bg-redegal text-white rounded-br-sm'
                  : msg.sender === 'visitor'
                  ? 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                  : 'bg-gray-100 text-gray-500 italic'
              }`}
            >
              <span className="text-[10px] opacity-60 block mb-0.5">
                {msg.sender === 'visitor' ? 'Visitante' : msg.sender === 'bot' ? 'Bot' : msg.sender === 'agent' ? 'Tú' : 'Sistema'}
              </span>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-gray-200 bg-white">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu respuesta..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          autoFocus
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-4 py-2 bg-redegal text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
