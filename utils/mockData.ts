import type { Candle } from '../types';

export const generateCandles = (count: number = 100, initialPrice: number = Math.random() * 2500 + 500): Candle[] => {
    const candles: Candle[] = [];
    let currentPrice = initialPrice;
    const now = Date.now();

    for (let i = 0; i < count; i++) {
        // Create a more realistic random walk with some drift
        const volatility = 0.03; // ~3% volatility
        const drift = (Math.random() - 0.49) * 0.005; // slight drift up or down
        const changePercent = (Math.random() - 0.5) * volatility + drift;
        const changeAmount = currentPrice * changePercent;
        
        currentPrice += changeAmount;
        if (currentPrice < 50) currentPrice = 50; // floor price, increased for INR

        const volume = Math.floor(Math.random() * 500000) + 100000 + (Math.abs(changePercent) > (volatility * 0.7) ? Math.random() * 700000 : 0);

        candles.push({
            time: now - (count - i - 1) * 15 * 60 * 1000, // 15-minute intervals
            close: parseFloat(currentPrice.toFixed(2)),
            volume: Math.floor(volume),
        });
    }
    return candles;
};