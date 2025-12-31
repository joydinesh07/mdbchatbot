import React, { useState, useRef, useEffect } from 'react';
import { Send, Database, Server, Clock, Activity, AlertCircle, Play } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

// Types
type Message = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolDetails?: {
    name: string;
    status: 'running' | 'complete' | 'error';
  };
  timestamp: Date;
};

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am your MongoDB DBA Assistant. I can help you analyze performance, check logs, and monitor replication status. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post('/api/chat', { message: userMsg.content });
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.error ? `Error: ${response.data.error}` : (response.data.response || "I didn't get a response."),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMsg]);
      
    } catch (error: any) {
      console.error("Chat Error:", error);
      let errorMessage = 'Error: Failed to connect to backend. Is the server running?';
      
      if (error.response?.data?.error) {
        errorMessage = `Error: ${error.response.data.error}`;
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-mongo-dark text-mongo-light overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-mongo-gray bg-mongo-dark/50 flex-shrink-0 hidden md:flex flex-col">
        <div className="p-4 border-b border-mongo-gray flex items-center gap-2">
            <Database className="text-mongo-green" />
            <span className="font-bold text-lg">DBA Copilot</span>
        </div>
        
        <div className="p-4 space-y-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quick Actions</div>
            <button onClick={() => setInput("Why is the DB slow?")} className="flex items-center gap-3 p-2 w-full hover:bg-mongo-gray/30 rounded text-sm text-left transition-colors">
                <Activity size={16} className="text-yellow-400" />
                <span>Slow Queries</span>
            </button>
            <button onClick={() => setInput("Show problematic queries from last 24h")} className="flex items-center gap-3 p-2 w-full hover:bg-mongo-gray/30 rounded text-sm text-left transition-colors">
                <Clock size={16} className="text-blue-400" />
                <span>History Analysis</span>
            </button>
            <button onClick={() => setInput("Check replication lag")} className="flex items-center gap-3 p-2 w-full hover:bg-mongo-gray/30 rounded text-sm text-left transition-colors">
                <Server size={16} className="text-purple-400" />
                <span>Replication Status</span>
            </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((msg) => (
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] rounded-lg p-4 ${
                  msg.role === 'user' 
                    ? 'bg-mongo-green text-mongo-dark font-medium' 
                    : 'bg-mongo-gray/30 border border-mongo-gray/50'
                }`}
              >
                {/* Tool Badge if applicable */}
                {msg.role === 'tool' && (
                    <div className="flex items-center gap-2 text-xs text-blue-300 mb-2 border-b border-blue-500/20 pb-1">
                        <Play size={12} /> Tool Output
                    </div>
                )}
                
                <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                    {msg.content}
                </div>
              </div>
            </motion.div>
          ))}
          
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                 <div className="bg-mongo-gray/30 p-4 rounded-lg flex items-center gap-3">
                    <div className="w-2 h-2 bg-mongo-green rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                    <div className="w-2 h-2 bg-mongo-green rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-mongo-green rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                 </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-mongo-gray bg-mongo-dark/80 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about DB performance, logs, or status..."
              className="w-full bg-mongo-dark border border-mongo-gray rounded-xl py-4 pl-6 pr-14 text-white placeholder-gray-500 focus:outline-none focus:border-mongo-green transition-colors shadow-lg"
            />
            <button 
                type="submit" 
                disabled={isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-mongo-green text-mongo-dark rounded-lg hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send size={20} />
            </button>
          </form>
          <div className="text-center mt-2 text-xs text-gray-500">
            Powered by MongoDB MCP Server & GPT-4o
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
