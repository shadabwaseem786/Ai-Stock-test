import React, { useRef, useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Filler,
    ScriptableContext,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import type { Candle, SignalType } from '../types';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Filler,
    zoomPlugin
);


interface SparklineChartProps {
  candles: Candle[];
  signalType: SignalType | null;
}

/**
 * Calculates the Simple Moving Average (SMA).
 * @param data - Array of numbers.
 * @param period - The lookback period.
 * @returns An array of SMA values.
 */
const calculateSMA = (data: number[], period: number): number[] => {
    if (data.length < period) return [];
    const sma: number[] = [];
    for (let i = 0; i <= data.length - period; i++) {
        const slice = data.slice(i, i + period);
        const sum = slice.reduce((a, b) => a + b, 0);
        sma.push(sum / period);
    }
    return sma;
};


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


export const SparklineChart: React.FC<SparklineChartProps> = ({ candles, signalType }) => {
    const chartRef = useRef<ChartJS<'line', (number | null)[], number>>(null);
    const [isZoomed, setIsZoomed] = useState(false);

    const { buySignals, sellSignals, pointRadii, paddedEma12, paddedEma26 } = useMemo(() => {
        if (candles.length < 35) { 
            return { buySignals: [], sellSignals: [], pointRadii: [], paddedEma12: [], paddedEma26: [] };
        }
        
        const prices = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        
        // --- EMA Calculation for display ---
        const ema12 = calculateEMA(prices, 12);
        const ema26 = calculateEMA(prices, 26);
        const paddedEma12 = [...Array(11).fill(null), ...ema12];
        const paddedEma26 = [...Array(25).fill(null), ...ema26];
        
        // --- MACD Calculation for signals ---
        const macdLine = ema12.slice(26 - 12).map((val, index) => val - ema26[index]);
        if (macdLine.length < 9) return { buySignals: [], sellSignals: [], pointRadii: [], paddedEma12, paddedEma26 };
        const signalLine = calculateEMA(macdLine, 9);
        const alignedMacdLine = macdLine.slice(8);

        const buySignals: (number | null)[] = Array(prices.length).fill(null);
        const sellSignals: (number | null)[] = Array(prices.length).fill(null);
        const offset = 33; 
        
        for (let i = 1; i < signalLine.length; i++) {
            const prevMacd = alignedMacdLine[i - 1];
            const currMacd = alignedMacdLine[i];
            const prevSignal = signalLine[i - 1];
            const currSignal = signalLine[i];
            const originalIndex = offset + i;

            if (prevMacd <= prevSignal && currMacd > currSignal) buySignals[originalIndex] = prices[originalIndex];
            if (prevMacd >= prevSignal && currMacd < currSignal) sellSignals[originalIndex] = prices[originalIndex];
        }

        // --- High Volume Calculation ---
        const volumeSma = calculateSMA(volumes, 20);
        const pointRadii = candles.map((candle, index) => {
            const smaIndex = index - 19;
            if (smaIndex >= 0 && candle.volume > volumeSma[smaIndex] * 1.75) {
                return 2.5; // Highlight high-volume points
            }
            return 0;
        });
        
        return { buySignals, sellSignals, pointRadii, paddedEma12, paddedEma26 };
    }, [candles]);

    const handleResetZoom = () => {
        if (chartRef.current) {
            chartRef.current.resetZoom();
            setIsZoomed(false);
        }
    };

    if (candles.length < 2) {
        return <div className="h-24 w-full flex items-center justify-center text-slate-600 animate-pulse">Loading Chart...</div>;
    }

    let strokeColor = '#64748b'; // Slate (HOLD)
    let gradientStartColor = 'rgba(100, 116, 139, 0.4)';
    let gradientEndColor = 'rgba(100, 116, 139, 0)';

    if (signalType === 'BUY') {
        strokeColor = '#22c55e'; // Green
        gradientStartColor = 'rgba(34, 197, 94, 0.4)';
        gradientEndColor = 'rgba(34, 197, 94, 0)';
    }
    if (signalType === 'SELL') {
        strokeColor = '#ef4444'; // Red
        gradientStartColor = 'rgba(239, 68, 68, 0.4)';
        gradientEndColor = 'rgba(239, 68, 68, 0)';
    }

    const chartData = {
        labels: candles.map(c => c.time),
        datasets: [
            {
                type: 'line' as const,
                label: 'Price',
                data: candles.map(c => c.close),
                borderWidth: 2,
                pointRadius: pointRadii,
                pointBackgroundColor: strokeColor,
                tension: 0.4,
                fill: true,
                order: 2, 
                borderColor: strokeColor,
                backgroundColor: (context: ScriptableContext<"line">) => {
                    const ctx = context.chart.ctx;
                    if (!ctx) return 'transparent';
                    const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height);
                    gradient.addColorStop(0, gradientStartColor);
                    gradient.addColorStop(1, gradientEndColor);
                    return gradient;
                },
            },
            {
                type: 'line' as const,
                label: 'EMA 12',
                data: paddedEma12,
                borderColor: '#f97316', // Orange-500
                borderWidth: 1,
                pointRadius: 0,
                tension: 0.4,
                order: 1,
            },
            {
                type: 'line' as const,
                label: 'EMA 26',
                data: paddedEma26,
                borderColor: '#06b6d4', // Cyan-500
                borderWidth: 1,
                pointRadius: 0,
                tension: 0.4,
                order: 1,
            },
            {
                type: 'bar' as const,
                label: 'Volume',
                data: candles.map(c => c.volume),
                backgroundColor: 'rgba(100, 116, 139, 0.2)',
                borderColor: 'transparent',
                yAxisID: 'y1',
                order: 3, // Render volume behind everything else
            },
            {
                type: 'line' as const,
                label: 'MACD Buy Signal',
                data: buySignals,
                pointStyle: 'triangle',
                pointRadius: 6,
                pointRotation: 0,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: 'rgba(255, 255, 255, 0.7)',
                pointBorderWidth: 1,
                showLine: false,
                order: 0, // Render signals on top
            },
            {
                type: 'line' as const,
                label: 'MACD Sell Signal',
                data: sellSignals,
                pointStyle: 'triangle',
                pointRadius: 6,
                pointRotation: 180,
                pointBackgroundColor: '#a855f7',
                pointBorderColor: 'rgba(255, 255, 255, 0.7)',
                pointBorderWidth: 1,
                showLine: false,
                order: 0, // Render signals on top
            }
        ],
    };

    const options: any = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { display: false, type: 'category' as const },
            y: { display: false, beginAtZero: false },
            y1: { display: false, type: 'linear' as const, position: 'right', grid: { drawOnChartArea: false } }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: true,
                mode: 'index' as const,
                intersect: false,
                backgroundColor: 'rgb(30 41 59)',
                borderColor: 'rgb(51 65 85)',
                borderWidth: 1,
                padding: 10,
                titleFont: { weight: 'bold' as const },
                bodyFont: { size: 12 },
                caretSize: 6,
                cornerRadius: 6,
                displayColors: true,
                filter: (tooltipItem: any) => {
                    const label = tooltipItem.dataset.label;
                    return label === 'Price' || label === 'EMA 12' || label === 'EMA 26';
                },
                callbacks: {
                    title: (tooltipItems: any[]) => new Date(parseInt(tooltipItems[0].label)).toLocaleString(),
                    label: (context: any) => {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                             if (context.dataset.label === 'Price') {
                                label += `₹${context.parsed.y.toFixed(2)}`;
                            } else {
                                label += context.parsed.y.toFixed(2);
                            }
                        }
                        return label;
                    },
                    footer: (tooltipItems: any[]) => {
                        const index = tooltipItems[0].dataIndex;
                        const volume = candles[index]?.volume;
                        return volume !== undefined ? `Volume: ${volume.toLocaleString()}` : '';
                    }
                }
            },
            zoom: {
                pan: { enabled: true, mode: 'x' as const, onPanComplete: ({ chart }: { chart: ChartJS }) => setIsZoomed(chart.isZoomedOrPanned()) },
                zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' as const, onZoomComplete: ({ chart }: { chart: ChartJS }) => setIsZoomed(chart.isZoomedOrPanned()) }
            },
        },
    };

    return (
        <div className="h-24 w-full relative group">
            <Line ref={chartRef} options={options} data={chartData as any} />
            <button
                onClick={handleResetZoom}
                className={`absolute top-1 right-1 bg-slate-700/50 hover:bg-slate-600/70 text-white text-xs px-2 py-0.5 rounded-md backdrop-blur-sm transition-all duration-300 z-10 ${isZoomed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                aria-label="Reset zoom"
                disabled={!isZoomed}
            >
                Reset
            </button>
            <div className="absolute bottom-1 left-2 text-xs text-slate-600 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Scroll to zoom, Drag to pan
            </div>
        </div>
    );
};