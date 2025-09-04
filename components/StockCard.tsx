import React from 'react';
import { SparklineChart } from './SparklineChart';
import { StatusIndicator } from './StatusIndicator';
import { ConnectionStatus } from '../types';
import type { StockState, SignalType } from '../types';

const getSignalColor = (type: SignalType | null | undefined): string => {
    switch (type) {
        case 'BUY': return 'text-green-400';
        case 'SELL': return 'text-red-400';
        case 'HOLD': return 'text-yellow-400';
        default: return 'text-slate-500';
    }
};

/**
 * A component that formats the AI's reasoning text for better readability
 * by creating a bulleted list and highlighting key financial terms.
 * It can parse both plain sentences and markdown-style lists.
 */
const FormattedReason: React.FC<{ text: string }> = ({ text }) => {
    const trimmedText = text.trim();

    // A list of common financial/technical terms to highlight
    const keywords = [
        'RSI', 'MACD', 'bullish', 'bearish', 'crossover', 'overbought',
        'oversold', 'momentum', 'sentiment', 'volume', 'EMA', 'news', 'headlines'
    ];
    // Create a case-insensitive regex to find whole words
    const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');

    /**
     * Splits a sentence string by the keyword regex and wraps the keywords in <strong> tags.
     */
    const highlightKeywords = (sentence: string) => {
        const parts = sentence.split(keywordRegex);
        return parts.map((part, index) =>
            index % 2 === 1 ?
                <strong key={index} className="font-semibold text-indigo-300">{part}</strong> :
                <React.Fragment key={index}>{part}</React.Fragment>
        );
    };

    // Check if the text looks like a pre-formatted list (e.g., starts with '-' or '*')
    const isListFormatted = trimmedText.startsWith('- ') || trimmedText.startsWith('* ');

    let items: string[];

    if (isListFormatted) {
        // If it's a list, split by newline and clean up list markers (like '-' or '*')
        items = trimmedText.split('\n')
            .map(line => line.trim().replace(/^[*-]\s*/, ''))
            .filter(Boolean);
    } else {
        // Otherwise, split the text into distinct sentences for bullet points.
        // This regex handles multiple sentence terminators.
        items = trimmedText.match(/[^.!?]+[.!?]*/g) || [trimmedText];
    }

    return (
        <ul className="space-y-1.5 list-disc list-inside text-left">
            {items.filter(s => s.trim()).map((item, index) => (
                <li key={index}>
                    {highlightKeywords(item.trim())}
                </li>
            ))}
        </ul>
    );
};

interface StockCardProps {
    stockState: StockState;
    onAskAi: (symbol: string) => void;
}


export const StockCard: React.FC<StockCardProps> = ({ stockState, onAskAi }) => {
    const { symbol, status, countdown, signal, candles, error } = stockState;

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 flex flex-col gap-3 shadow-lg hover:border-slate-600 transition-all duration-300 min-h-[410px]">
            <header className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-200">{symbol}</h2>
                    <StatusIndicator status={status} />
                </div>
                <div className="text-sm text-slate-400 font-mono bg-slate-700/50 px-2 py-1 rounded">
                    {countdown.toString().padStart(2, '0')}s
                </div>
            </header>
            
            <div className="min-h-[28px] flex items-center justify-between">
                {signal && !error ? (
                    <div className="relative inline-block group" aria-describedby={`tooltip-${symbol}`}>
                        <p className={`text-xl font-semibold ${getSignalColor(signal.type)} cursor-help`}>{signal.type}</p>
                        <div
                            id={`tooltip-${symbol}`}
                            role="tooltip"
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 max-h-48 overflow-y-auto p-3 bg-slate-700 border border-slate-600 rounded-lg shadow-xl text-xs text-slate-300 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-300 delay-0 group-hover:delay-300 z-10 pointer-events-none"
                        >
                            <span className="font-bold block mb-2 text-slate-100">AI Analysis:</span>
                            <FormattedReason text={signal.reason} />
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-slate-700"></div>
                        </div>
                    </div>
                ) : (
                     status !== ConnectionStatus.OFFLINE && <div className="animate-pulse">
                        <div className="h-5 bg-slate-700 rounded w-16"></div>
                    </div>
                )}
                 <button 
                    onClick={() => onAskAi(symbol)}
                    className="text-xs bg-indigo-600/50 text-indigo-200 px-3 py-1 rounded-full hover:bg-indigo-600/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!signal || !!error}
                    title={!signal ? "Wait for signal before asking AI" : `Ask AI about ${symbol}`}
                 >
                    Ask AI
                 </button>
            </div>
            
            {/* News Feed Section */}
            <div className="border-t border-slate-700 pt-3 mt-1 min-h-[76px]">
                {status === ConnectionStatus.OFFLINE && error ? (
                    <div className="text-red-400 text-xs p-2 bg-red-900/30 border border-red-500/30 rounded-md h-full flex flex-col justify-center">
                        <p className="font-bold text-red-300 mb-1">Data Unavailable</p>
                        <p>{error}</p>
                    </div>
                ) : signal && signal.news && signal.news.length > 0 ? (
                    <ul className="space-y-2">
                        {signal.news.slice(0, 3).map((item, index) => (
                            <li key={index}>
                                <a 
                                  href={item.uri} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-xs text-slate-400 hover:text-indigo-400 transition-colors line-clamp-2 leading-snug"
                                  title={item.title}
                                >
                                    {item.title}
                                </a>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="space-y-2">
                        {signal === null && status !== ConnectionStatus.OFFLINE ? (
                            /* Loading Skeleton */
                            <div className="animate-pulse space-y-2">
                                <div className="h-3 bg-slate-700 rounded w-full"></div>
                                <div className="h-3 bg-slate-700 rounded w-5/6"></div>
                                <div className="h-3 bg-slate-700 rounded w-3/4"></div>
                            </div>
                        ) : (
                            /* No News Message */
                             signal && <p className="text-xs text-slate-500 italic">No recent news found.</p>
                        )}
                    </div>
                )}
            </div>

            <div className="mt-auto">
              <SparklineChart candles={candles} signalType={signal?.type ?? null} />
            </div>
        </div>
    );
};