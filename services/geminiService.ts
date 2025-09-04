import { GoogleGenAI } from "@google/genai";
import type { Signal, Candle, ChatMessage, SignalType } from '../types';

/**
 * Custom error class for AI-related operations.
 */
export class AIError extends Error {
  constructor(message: string, public userFriendlyMessage: string) {
    super(message);
    this.name = 'AIError';
  }
}


/**
 * Calculates the Exponential Moving Average (EMA).
 * @param prices - Array of numbers.
 * @param period - The lookback period.
 * @returns An array of EMA values.
 */
const calculateEMA = (prices: number[], period: number): number[] => {
    if (prices.length < period) return [];
    const k = 2 / (period + 1);
    const emaArray: number[] = [];
    
    // First EMA is a simple moving average
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += prices[i];
    }
    emaArray.push(sum / period);
    
    // Subsequent EMAs
    for (let i = period; i < prices.length; i++) {
        const newEma = (prices[i] * k) + (emaArray[emaArray.length - 1] * (1 - k));
        emaArray.push(newEma);
    }
    return emaArray;
};

interface MACDResult {
    macdLine: number;
    signalLine: number;
    histogram: number;
}

/**
 * Calculates the Moving Average Convergence Divergence (MACD).
 * @param candles - An array of candle data.
 * @returns An object with the latest MACD line, signal line, and histogram, or null.
 */
const calculateMACD = (candles: Candle[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MACDResult | null => {
    const prices = candles.map(c => c.close);
    if (prices.length < slowPeriod + signalPeriod) {
        return null;
    }

    const emaFast = calculateEMA(prices, fastPeriod);
    const emaSlow = calculateEMA(prices, slowPeriod);

    // Align arrays and calculate MACD line
    const macdLineValues = emaFast.slice(slowPeriod - fastPeriod).map((val, index) => val - emaSlow[index]);
    
    if (macdLineValues.length < signalPeriod) {
        return null;
    }

    const signalLineValues = calculateEMA(macdLineValues, signalPeriod);
    
    const lastMacdLine = macdLineValues[macdLineValues.length - 1];
    const lastSignalLine = signalLineValues[signalLineValues.length - 1];

    if (lastMacdLine === undefined || lastSignalLine === undefined) return null;
    
    const histogram = lastMacdLine - lastSignalLine;

    return {
        macdLine: parseFloat(lastMacdLine.toFixed(2)),
        signalLine: parseFloat(lastSignalLine.toFixed(2)),
        histogram: parseFloat(histogram.toFixed(2)),
    };
};


/**
 * Calculates the Relative Strength Index (RSI) for a given set of candles.
 * @param candles - An array of candle data.
 * @param period - The lookback period for RSI calculation (default is 14).
 * @returns The RSI value, or null if there's not enough data.
 */
const calculateRSI = (candles: Candle[], period: number = 14): number | null => {
    if (candles.length <= period) {
        return null;
    }

    const prices = candles.map(c => c.close);
    let gains = 0;
    let losses = 0;

    // Calculate initial average gain and loss
    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) {
            gains += change;
        } else {
            losses -= change; // losses are positive values
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Smooth the averages for the rest of the data
    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        let currentGain = change > 0 ? change : 0;
        let currentLoss = change < 0 ? -change : 0;
        
        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    }

    if (avgLoss === 0) {
        return 100; // RSI is 100 if average loss is zero
    }
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return parseFloat(rsi.toFixed(2));
};

// Initialize the Gemini client.
// The API key is assumed to be available in the execution environment via process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const handleApiError = (error: any, context: string): never => {
    console.error(`Error in ${context}:`, error);
    const message = error.message?.toLowerCase() || '';

    if (message.includes('api key not valid')) {
        throw new AIError(error.message, 'Invalid API Key. Please ensure it is set correctly.');
    }
    if (message.includes('429') || message.includes('resource_exhausted')) {
        throw new AIError(error.message, 'API rate limit reached. Please wait and try again.');
    }
    if (error instanceof TypeError) { // Often indicates a network error
        throw new AIError(error.message, 'Network error. Please check your internet connection.');
    }
    
    throw new AIError(error.message, `An unexpected error occurred with the AI service.`);
};

export const getStockSignal = async (symbol: string, candles: Candle[]): Promise<Signal> => {
    try {
        const candleDataString = candles.slice(-50).map(c => c.close.toFixed(2)).join(', ');
        const rsiValue = calculateRSI(candles);
        const macdResult = calculateMACD(candles);

        const prompt = `
            You are a sophisticated AI financial analyst. Your task is to analyze a sequence of recent closing prices and key technical indicators for the stock ${symbol}, and combine this with recent news to generate a trading signal.
            The prices are sequential, with the last price being the most recent.
            
            Price data: [${candleDataString}]
            Current 14-period RSI: ${rsiValue !== null ? rsiValue : 'N/A'}
            Current MACD (12, 26, 9): 
            - MACD Line: ${macdResult ? macdResult.macdLine : 'N/A'}
            - Signal Line: ${macdResult ? macdResult.signalLine : 'N/A'}
            - Histogram: ${macdResult ? macdResult.histogram : 'N/A'}

            Analysis Instructions:
            1. Analyze the technical data. Consider RSI for overbought/oversold conditions (RSI > 70 is overbought, RSI < 30 is oversold). Consider the MACD for momentum: a bullish crossover occurs when the MACD Line crosses above the Signal Line, which is a potential buy signal. A bearish crossover is the opposite, a potential sell signal. The histogram reflects the distance between the MACD and Signal lines; a growing positive histogram indicates strengthening bullish momentum, while a growing negative histogram indicates strengthening bearish momentum.
            2. Use your search tool to find 2-3 recent, relevant news headlines for the stock symbol: ${symbol}.
            3. Synthesize the technical analysis with the sentiment from the news headlines to form a coherent trading signal and a concise reason.

            Your response MUST be a single, valid JSON object and nothing else. Do not wrap it in markdown or any other text. The JSON object must have the following structure:
            {
              "type": "BUY" | "SELL" | "HOLD",
              "reason": "A 2-3 sentence explanation for the signal, incorporating both technicals (RSI, MACD) and news sentiment.",
              "news": [
                { "title": "The full news headline", "uri": "The direct URL to the news article" }
              ]
            }
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
            },
        });

        let jsonText = response.text.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.substring(7, jsonText.length - 3).trim();
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.substring(3, jsonText.length - 3).trim();
        }
        
        const parsedJson = JSON.parse(jsonText);
        
        if (parsedJson.type && parsedJson.reason && Array.isArray(parsedJson.news)) {
            return parsedJson as Signal;
        } else {
            throw new Error("Invalid JSON structure received from AI.");
        }

    } catch (error: any) {
        if (error instanceof SyntaxError) {
             throw new AIError(error.message, 'AI returned an invalid response format. Please try refreshing.');
        }
        handleApiError(error, `getStockSignal for ${symbol}`);
    }
};

export const getChatResponse = async (symbol: string, candles: Candle[], history: ChatMessage[]): Promise<string> => {
    try {
        const rsiValue = calculateRSI(candles);
        const macdResult = calculateMACD(candles);
        const latestPrice = candles.length > 0 ? candles[candles.length - 1].close.toFixed(2) : 'N/A';

        const contents = history.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }));

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents,
            config: {
                systemInstruction: `You are a helpful and concise AI financial analyst. 
                Your purpose is to answer user questions about the stock: ${symbol}. 
                You have the following real-time technical data. Use it to inform your answers. Do not mention that you have this data unless it's relevant to the user's question.
                - Current Price: ₹${latestPrice}
                - 14-period RSI: ${rsiValue !== null ? rsiValue : 'N/A'}
                - MACD (12, 26, 9) -- MACD Line: ${macdResult?.macdLine}, Signal Line: ${macdResult?.signalLine}, Histogram: ${macdResult?.histogram}
                
                Keep your answers brief and to the point.
                `,
            }
        });

        return response.text;

    } catch (error) {
        handleApiError(error, `getChatResponse for ${symbol}`);
    }
};


export const getMarketSentiment = async (signals: Record<string, SignalType>): Promise<string> => {
    try {
        const signalSummary = Object.entries(signals)
            .map(([symbol, type]) => `${symbol}: ${type}`)
            .join(', ');
        
        if (!signalSummary) {
            return "Awaiting sufficient data to determine market sentiment.";
        }
        
        const prompt = `
            You are an expert AI financial market analyst for the Indian stock market (NSE).
            Based on the following list of real-time trading signals for key stocks, provide a concise, one or two-sentence summary of the overall market sentiment.
            Do not just list the counts of BUY/SELL signals. Instead, synthesize the information into a coherent narrative. For example, mention if a particular sector seems strong or weak if you can infer it.

            Signals: ${signalSummary}
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        handleApiError(error, `getMarketSentiment`);
    }
};
