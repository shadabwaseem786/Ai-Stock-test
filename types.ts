
export enum ConnectionStatus {
  ONLINE,
  REFRESHING,
  OFFLINE,
}

export type SignalType = 'BUY' | 'SELL' | 'HOLD';

export interface NewsItem {
  title: string;
  uri: string;
}

export interface Signal {
  type: SignalType;
  reason: string;
  news?: NewsItem[];
}

export interface Candle {
  time: number; // unix timestamp for recharts
  close: number;
  volume: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
  error?: boolean;
}

export interface StockState {
  symbol: string;
  candles: Candle[];
  signal: Signal | null;
  countdown: number;
  status: ConnectionStatus;
  chatHistory: ChatMessage[];
  error: string | null;
}