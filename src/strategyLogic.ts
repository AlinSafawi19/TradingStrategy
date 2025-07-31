// Accurate Trading Strategy Logic
// Based on the provided Pine Script indicators

export interface PriceData {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: Date;
}

export interface TradingSignal {
  type: 'BUY' | 'SELL' | 'NEUTRAL';
  timestamp: Date;
  price: number;
}

export interface SSLChannelData {
  sslUp: number;
  sslDown: number;
  hlv: number;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  color: string;
  buySignal: boolean;
  sellSignal: boolean;
}

export interface TrendFusionData {
  trendDirection: 'GREEN' | 'RED' | 'NEUTRAL';
  shortEMA: number;
  longEMA: number;
  momentum: number;
  rsiValue: number;
  rsiBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  color: string;
  rsiBiasLine: number;
  rsiBiasColor: string;
}

// Simplified Moving Average calculation - only SMA and EMA
function calculateMA(source: number[], length: number, type: 'SMA' | 'EMA'): number {
  if (source.length < length) return 0;
  
  switch (type) {
    case 'SMA':
      return source.slice(-length).reduce((sum, val) => sum + val, 0) / length;
    
    case 'EMA':
      const multiplier = 2 / (length + 1);
      let ema = source[0];
      for (let i = 1; i < source.length; i++) {
        ema = (source[i] * multiplier) + (ema * (1 - multiplier));
      }
      return ema;
    
    default:
      return source.slice(-length).reduce((sum, val) => sum + val, 0) / length;
  }
}

// Simplified SSL Channel Indicator
export function calculateSSLChannel(
  priceData: PriceData[], 
  wicks: boolean = false,
  settings?: {
    maPeriod?: number;
    maType?: 'SMA' | 'EMA';
  }
): SSLChannelData {
  const maPeriod = settings?.maPeriod || 200;
  const maType = settings?.maType || 'SMA';

  if (priceData.length < maPeriod) {
    return {
      sslUp: 0,
      sslDown: 0,
      hlv: 0,
      signal: 'NEUTRAL',
      color: '#6B7280',
      buySignal: false,
      sellSignal: false
    };
  }

  const recentData = priceData.slice(-maPeriod);
  const currentPrice = recentData[recentData.length - 1].close;
  
  // Calculate MA for high and low using same period
  const highValues = recentData.map(p => p.high);
  const lowValues = recentData.map(p => p.low);
  
  const ma1 = calculateMA(highValues, maPeriod, maType); // MA High
  const ma2 = calculateMA(lowValues, maPeriod, maType);  // MA Low
  
  // Determine Hlv (High Low Value) with state persistence
  let hlv = 0;
  const priceToCompare = wicks ? recentData[recentData.length - 1].high : currentPrice;
  const lowPriceToCompare = wicks ? recentData[recentData.length - 1].low : currentPrice;
  
  if (priceToCompare > ma1) {
    hlv = 1;
  } else if (lowPriceToCompare < ma2) {
    hlv = -1;
  } else {
    // State persistence - use previous Hlv if available
    if (recentData.length > 1) {
      const prevPrice = wicks ? recentData[recentData.length - 2].high : recentData[recentData.length - 2].close;
      const prevLowPrice = wicks ? recentData[recentData.length - 2].low : recentData[recentData.length - 2].close;
      
      if (prevPrice > ma1) {
        hlv = 1;
      } else if (prevLowPrice < ma2) {
        hlv = -1;
      } else {
        hlv = 0; // Neutral
      }
    } else {
      hlv = 0;
    }
  }
  
  // Calculate SSL Up and Down based on Hlv
  const sslUp = hlv < 0 ? ma2 : ma1;
  const sslDown = hlv < 0 ? ma1 : ma2;
  
  // Determine signal and color
  let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let signalColor = '#6B7280'; // Gray for neutral
  let buySignal = false;
  let sellSignal = false;
  
  if (hlv === 1) {
    signal = 'BUY';
    signalColor = '#EAB308'; // Yellow for BUY signal
  } else if (hlv === -1) {
    signal = 'SELL';
    signalColor = '#EAB308'; // Yellow for SELL signal
  }
  
  // Check for signal changes (crossover conditions)
  if (recentData.length > 1) {
    const prevData = priceData.slice(-(maPeriod + 1), -1);
    const prevSSL = calculateSSLChannel(prevData, wicks, settings);
    
    // Buy signal: Hlv changed from -1 to 1
    if (hlv === 1 && prevSSL.hlv === -1) {
      buySignal = true;
    }
    // Sell signal: Hlv changed from 1 to -1
    else if (hlv === -1 && prevSSL.hlv === 1) {
      sellSignal = true;
    }
  }
  
  return {
    sslUp,
    sslDown,
    hlv,
    signal,
    color: signalColor,
    buySignal,
    sellSignal
  };
}

// RSI calculation function
function calculateRSI(prices: number[], length: number = 14): number {
  if (prices.length < length + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  // Calculate initial average gain and loss
  for (let i = 1; i <= length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }
  
  let avgGain = gains / length;
  let avgLoss = losses / length;
  
  // Calculate RSI for the most recent value
  for (let i = length + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (length - 1) + change) / length;
      avgLoss = (avgLoss * (length - 1)) / length;
    } else {
      avgGain = (avgGain * (length - 1)) / length;
      avgLoss = (avgLoss * (length - 1) + Math.abs(change)) / length;
    }
  }
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Simplified Trend Fusion Indicator
export function calculateTrendFusion(
  priceData: PriceData[],
  settings?: {
    shortEMAPeriod?: number;
    longEMAPeriod?: number;
    rsiPeriod?: number;
    topLevel?: number;
    bottomLevel?: number;
  }
): TrendFusionData {
  const shortPeriod = settings?.shortEMAPeriod || 14;
  const longPeriod = settings?.longEMAPeriod || 50;
  const rsiLength = settings?.rsiPeriod || 14;
  const topLevel = settings?.topLevel || 60;
  const bottomLevel = settings?.bottomLevel || 40;

  if (priceData.length < Math.max(shortPeriod, longPeriod, rsiLength)) {
    return {
      trendDirection: 'NEUTRAL',
      shortEMA: 0,
      longEMA: 0,
      momentum: 0,
      rsiValue: 50,
      rsiBias: 'NEUTRAL',
      color: '#6B7280',
      rsiBiasLine: 50,
      rsiBiasColor: '#6B7280'
    };
  }
  
  // Calculate EMAs
  const closePrices = priceData.map(p => p.close);
  const shortEMA = calculateMA(closePrices, shortPeriod, 'EMA');
  const longEMA = calculateMA(closePrices, longPeriod, 'EMA');
  
  // Calculate momentum using same RSI period
  const momentum = calculateRSI(closePrices, rsiLength) - 50;
  
  // Calculate RSI
  const rsiValue = calculateRSI(closePrices, rsiLength);
  
  // Determine RSI bias based on crossover logic
  let rsiBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let rsiBiasLine = 50;
  let rsiBiasColor = '#6B7280';
  
  // Check for crossover conditions
  if (priceData.length > 1) {
    const prevRsi = calculateRSI(closePrices.slice(0, -1), rsiLength);
    
    // Crossover above top level
    if (prevRsi <= topLevel && rsiValue > topLevel) {
      rsiBias = 'BULLISH';
      rsiBiasLine = bottomLevel;
      rsiBiasColor = '#EC4899'; // Pink for RSI bias
    }
    // Crossunder below bottom level
    else if (prevRsi >= bottomLevel && rsiValue < bottomLevel) {
      rsiBias = 'BEARISH';
      rsiBiasLine = topLevel;
      rsiBiasColor = '#EC4899'; // Pink for RSI bias
    }
  }
  
  // Determine trend direction based on EMA crossover
  let trendDirection: 'GREEN' | 'RED' | 'NEUTRAL' = 'NEUTRAL';
  let trendColor = '#6B7280'; // Gray for neutral
  
  if (shortEMA > longEMA) {
    trendDirection = 'GREEN';
    if (momentum > 0) {
      trendColor = '#10B981'; // Green for positive momentum
    } else {
      trendColor = '#10B981'; // Green
    }
  } else if (shortEMA < longEMA) {
    trendDirection = 'RED';
    if (momentum > 0) {
      trendColor = '#991B1B'; // Maroon for positive momentum
    } else {
      trendColor = '#EF4444'; // Red
    }
  }
  
  return {
    trendDirection,
    shortEMA,
    longEMA,
    momentum,
    rsiValue,
    rsiBias,
    color: trendColor,
    rsiBiasLine,
    rsiBiasColor: rsiBiasColor
  };
}

// Main trading signal based on exact conditions specified
export function calculateTradingSignal(priceData: PriceData[]): TradingSignal {
  if (priceData.length < 200) {
    return {
      type: 'NEUTRAL',
      timestamp: new Date(),
      price: priceData.length > 0 ? priceData[priceData.length - 1].close : 0
    };
  }

  const currentPrice = priceData[priceData.length - 1].close;
  
  // Calculate SSL Channel signal
  const sslChannel = calculateSSLChannel(priceData);
  
  // Calculate Trend Fusion signal
  const trendFusion = calculateTrendFusion(priceData);
  
  // Trading conditions as specified:
  // Buy conditions: 
  // 1) signal men l channel (buy) - SSL Channel BUY
  // 2) trend fusion green - Trend Fusion GREEN
  // 
  // Sell conditions:
  // 1) signal men l channel sell - SSL Channel SELL  
  // 2) trend fusion red - Trend Fusion RED
  
  let signalType: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  
  // Check for BUY signal: SSL Channel BUY AND Trend Fusion GREEN
  if (sslChannel.signal === 'BUY' && trendFusion.trendDirection === 'GREEN') {
    signalType = 'BUY';
  } 
  // Check for SELL signal: SSL Channel SELL AND Trend Fusion RED
  else if (sslChannel.signal === 'SELL' && trendFusion.trendDirection === 'RED') {
    signalType = 'SELL';
  }
  // Otherwise, NEUTRAL

  return {
    type: signalType,
    timestamp: priceData[priceData.length - 1].timestamp,
    price: currentPrice
  };
} 