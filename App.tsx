import React, { useState, useEffect, useCallback, useRef } from 'react';
import { STOCKS, REFRESH_INTERVAL_SECONDS } from './constants';
import { ConnectionStatus } from './types';
import type { StockState, ChatMessage, SignalType } from './types';
import { getStockSignal, getChatResponse, getMarketSentiment, AIError } from './services/geminiService';
import { generateCandles } from './utils/mockData';
import { StockCard } from './components/StockCard';
import { ChatModal } from './components/ChatModal';
import { scheduleApiCall } from './utils/apiRateLimiter';

const App: React.FC = () => {
    const [stockData, setStockData] = useState<Record<string, StockState>>(() => {
        const initialState: Record<string, StockState> = {};
        for (const symbol of STOCKS) {
            initialState[symbol] = {
                symbol,
                candles: [],
                signal: null,
                countdown: REFRESH_INTERVAL_SECONDS,
                status: ConnectionStatus.OFFLINE,
                chatHistory: [],
                error: null,
            };
        }
        return initialState;
    });
    
    const [chatModalSymbol, setChatModalSymbol] = useState<string | null>(null);
    const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
    const [marketSentiment, setMarketSentiment] = useState<string>('');
    const [isSentimentLoading, setIsSentimentLoading] = useState<boolean>(true);

    const sentimentDebounceTimer = useRef<NodeJS.Timeout | null>(null);

    const isRefreshingAll = Object.values(stockData).some(s => s.status === ConnectionStatus.REFRESHING);

    const fetchSignal = useCallback(async (symbol: string) => {
        setStockData(prev => ({
            ...prev,
            [symbol]: { ...prev[symbol], status: ConnectionStatus.REFRESHING, error: null }
        }));
        
        try {
            const newCandles = generateCandles();
            const signal = await getStockSignal(symbol, newCandles);
            setStockData(prev => ({
                ...prev,
                [symbol]: {
                    ...prev[symbol],
                    candles: newCandles,
                    signal: signal,
                    status: ConnectionStatus.ONLINE,
                    countdown: REFRESH_INTERVAL_SECONDS,
                    error: null,
                }
            }));
        } catch (error: any) {
            console.error(`Failed to fetch signal for ${symbol}:`, error);
            const userMessage = error instanceof AIError ? error.userFriendlyMessage : "An unknown error occurred.";
            setStockData(prev => ({
                ...prev,
                [symbol]: { 
                    ...prev[symbol], 
                    status: ConnectionStatus.OFFLINE, 
                    countdown: REFRESH_INTERVAL_SECONDS,
                    error: userMessage,
                }
            }));
        }
    }, []);

    const handleRefreshAll = useCallback(async () => {
      STOCKS.forEach(symbol => 
          scheduleApiCall(() => fetchSignal(symbol))
      );
    }, [fetchSignal]);

    const handleOpenChat = (symbol: string) => setChatModalSymbol(symbol);
    const handleCloseChat = () => setChatModalSymbol(null);

    const handleSendMessage = async (symbol: string, message: string) => {
      if (isChatLoading) return;
      setIsChatLoading(true);

      const userMessage: ChatMessage = { role: 'user', text: message };
      const loadingMessage: ChatMessage = { role: 'model', text: '', isLoading: true };

      const currentHistory = [...stockData[symbol].chatHistory, userMessage];

      setStockData(prev => ({
        ...prev,
        [symbol]: {
          ...prev[symbol],
          chatHistory: [...currentHistory, loadingMessage]
        }
      }));

      try {
        const responseText = await getChatResponse(symbol, stockData[symbol].candles, currentHistory);
        const modelMessage: ChatMessage = { role: 'model', text: responseText };
        setStockData(prev => ({
          ...prev,
          [symbol]: {
            ...prev[symbol],
            chatHistory: [...currentHistory, modelMessage]
          }
        }));
      } catch (error: any) {
        console.error(`Error in chat for ${symbol}:`, error);
        const userMessage = error instanceof AIError ? error.userFriendlyMessage : "An unknown error occurred.";
        const errorMessage: ChatMessage = { role: 'model', text: userMessage, error: true };
         setStockData(prev => ({
          ...prev,
          [symbol]: {
            ...prev[symbol],
            chatHistory: [...currentHistory, errorMessage]
          }
        }));
      } finally {
        setIsChatLoading(false);
      }
    };

    useEffect(() => {
        handleRefreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            const symbolsToFetch: string[] = [];
            
            setStockData(prevData => {
                const newData = { ...prevData };
                for (const symbol in newData) {
                    if (newData[symbol].status === ConnectionStatus.ONLINE) {
                        const newCountdown = newData[symbol].countdown - 1;
                        if (newCountdown <= 0) {
                            symbolsToFetch.push(symbol);
                            newData[symbol] = { ...newData[symbol], status: ConnectionStatus.REFRESHING, countdown: 0 };
                        } else {
                            newData[symbol] = { ...newData[symbol], countdown: newCountdown };
                        }
                    }
                }
                return newData;
            });
            
            if (symbolsToFetch.length > 0) {
                symbolsToFetch.forEach(symbol => {
                    scheduleApiCall(() => fetchSignal(symbol));
                });
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [fetchSignal]);

    // Effect for fetching market sentiment
    useEffect(() => {
        if (sentimentDebounceTimer.current) {
            clearTimeout(sentimentDebounceTimer.current);
        }

        sentimentDebounceTimer.current = setTimeout(async () => {
            const signalsForSentiment = Object.values(stockData)
                .filter(s => s.signal && s.status === ConnectionStatus.ONLINE)
                .reduce((acc, s) => {
                    acc[s.symbol] = s.signal!.type;
                    return acc;
                }, {} as Record<string, SignalType>);
            
            // Only fetch sentiment if we have a reasonable number of signals
            if (Object.keys(signalsForSentiment).length > STOCKS.length / 2) {
                setIsSentimentLoading(true);
                try {
                    const sentiment = await scheduleApiCall(() => getMarketSentiment(signalsForSentiment));
                    setMarketSentiment(sentiment);
                } catch (error: any) {
                    console.error("Failed to fetch market sentiment:", error);
                    const userMessage = error instanceof AIError ? error.userFriendlyMessage : "Could not fetch market sentiment.";
                    setMarketSentiment(userMessage);
                } finally {
                    setIsSentimentLoading(false);
                }
            }
        }, 2000); // Debounce for 2 seconds

        return () => {
            if (sentimentDebounceTimer.current) {
                clearTimeout(sentimentDebounceTimer.current);
            }
        };
    }, [stockData]);


    const activeChatStock = chatModalSymbol ? stockData[chatModalSymbol] : null;

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8">
            <main className="max-w-7xl mx-auto">
                <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                    <div className="text-center sm:text-left">
                        <h1 className="text-4xl font-extrabold tracking-tight text-white">AI Stock Signal</h1>
                        <p className="mt-2 text-lg text-slate-400">Real-time trading signals powered by Gemini AI</p>
                    </div>
                    <div className="flex items-center gap-4">
                         <button
                            onClick={handleRefreshAll}
                            disabled={isRefreshingAll}
                            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 disabled:bg-indigo-500/50 disabled:cursor-not-allowed transition-all"
                        >
                            {isRefreshingAll ? 'Refreshing...' : 'Refresh All'}
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {STOCKS.map(symbol => 
                        <StockCard 
                            key={symbol} 
                            stockState={stockData[symbol]}
                            onAskAi={handleOpenChat}
                        />
                    )}
                </div>

                <section className="mt-12 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6 shadow-lg">
                    <h2 className="text-2xl font-bold text-slate-200 mb-4">Overall Market Sentiment</h2>
                    {isSentimentLoading ? (
                        <div className="animate-pulse space-y-3">
                            <div className="h-4 bg-slate-700 rounded w-full"></div>
                            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                        </div>
                    ) : (
                        <p className="text-slate-300 leading-relaxed">{marketSentiment}</p>
                    )}
                </section>


                <footer className="text-center mt-12 text-slate-500 text-sm">
                  <p>This is a demo application. Stock data is randomly generated and signals are for illustrative purposes only.</p>
                  <p>This is not financial advice.</p>
                </footer>
            </main>

            {activeChatStock && (
              <ChatModal 
                isOpen={!!chatModalSymbol}
                onClose={handleCloseChat}
                stockState={activeChatStock}
                onSendMessage={handleSendMessage}
                isLoading={isChatLoading}
              />
            )}
        </div>
    );
};

export default App;