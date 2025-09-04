import React, { useState, useEffect, useRef } from 'react';
import type { StockState, ChatMessage } from '../types';

const TypingIndicator: React.FC = () => (
    <div className="flex items-center space-x-1">
        <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce"></span>
    </div>
);

const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isUser = message.role === 'user';
    const isError = message.error === true;

    let bubbleClasses = "p-3 rounded-lg max-w-sm md:max-w-md ";

    if (isUser) {
        bubbleClasses += "bg-indigo-600 self-end rounded-br-none";
    } else if (isError) {
        bubbleClasses += "bg-red-900/50 border border-red-500/50 text-red-300 self-start rounded-bl-none";
    } else {
        bubbleClasses += "bg-slate-700 self-start rounded-bl-none";
    }

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={bubbleClasses}>
                {message.isLoading ? (
                    <TypingIndicator />
                ) : (
                    <p className="text-sm">{message.text}</p>
                )}
            </div>
        </div>
    );
};


interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    stockState: StockState;
    onSendMessage: (symbol: string, message: string) => void;
    isLoading: boolean;
}

export const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, stockState, onSendMessage, isLoading }) => {
    const [input, setInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [stockState.chatHistory]);


    if (!isOpen) {
        return null;
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSendMessage(stockState.symbol, input.trim());
            setInput('');
        }
    };

    return (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" 
          onClick={onClose} 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="chat-modal-title"
        >
            <div 
              className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-2xl h-full max-h-[80vh] flex flex-col transform animate-slide-up" 
              onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 id="chat-modal-title" className="text-xl font-bold text-slate-200">
                        Chat with AI about <span className="text-indigo-400">{stockState.symbol}</span>
                    </h2>
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-white transition-colors"
                        aria-label="Close chat modal"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {stockState.chatHistory.map((msg, index) => (
                        <ChatBubble key={index} message={msg} />
                    ))}
                    <div ref={chatEndRef} />
                </div>
                
                <footer className="p-4 border-t border-slate-700">
                    <form onSubmit={handleSubmit} className="flex items-center gap-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask a follow-up question..."
                            className="flex-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 disabled:bg-indigo-500/50 disabled:cursor-not-allowed transition-all"
                        >
                            {isLoading ? 'Sending...' : 'Send'}
                        </button>
                    </form>
                </footer>
            </div>
            <style>
            {`
              @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
              
              @keyframes slide-up {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
              .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
            `}
            </style>
        </div>
    );
};