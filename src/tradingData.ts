// Trading Data Types
export interface PriceData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TradingSignal {
  type: 'BUY' | 'SELL' | 'NEUTRAL';
  timestamp: Date;
  price: number;
}

export interface TradingStrategy {
  priceData: PriceData[];
  signal: TradingSignal;
}

// Import the corrected strategy logic
import { calculateTradingSignal } from './strategyLogic';

// Efficient data loading with lazy loading and memoization
let cachedData: PriceData[] | null = null;
let cachedRanges: Map<string, PriceData[]> = new Map();
let isLoading = false;
let loadProgress = 0;

// Virtual scrolling support
export interface ViewportData {
  visibleData: PriceData[];
  startIndex: number;
  endIndex: number;
  totalPoints: number;
}

// Get loading state
export const getLoadingState = () => ({ isLoading, loadProgress });

// Get the full available data range (not filtered by time range)
export const getFullDataRange = async (): Promise<{ from: Date; to: Date } | null> => {
  // If we don't have the full dataset yet, load it
  if (!cachedData) {
    await loadDefaultData();
  }

  if (!cachedData || cachedData.length === 0) {
    return null;
  }

  return {
    from: cachedData[0].timestamp,
    to: cachedData[cachedData.length - 1].timestamp
  };
};

// Optimized data loading with streaming and better error handling
const loadDefaultData = async (): Promise<PriceData[]> => {
  if (cachedData) {
    return cachedData;
  }

  if (isLoading) {
    // Wait for existing load to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return cachedData || [];
  }

  isLoading = true;
  loadProgress = 0;

  try {
    console.log('Loading default trading data (1D)...');

    // Load data from public/data/trading-data.json
    const response = await fetch('/data/trading-data.json');
    if (!response.ok) {
      throw new Error(`Failed to load data: ${response.status}`);
    }

    loadProgress = 30;

    let rawData;
    try {
      rawData = await response.json();
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      throw new Error('Invalid JSON data - file may be corrupted');
    }
    loadProgress = 60;

    console.log(`Processing ${rawData.length} data points...`);

    // Optimized data conversion with batching and memory management
    const allPriceData: PriceData[] = new Array(rawData.length);
    const batchSize = Math.max(1, Math.floor(rawData.length / 20));

    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i];
      allPriceData[i] = {
        timestamp: new Date(item.timestamp),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
      };

      // Update progress every batch
      if (i % batchSize === 0) {
        loadProgress = 60 + Math.floor((i / rawData.length) * 30);
        // Use requestAnimationFrame for smoother UI updates
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    }

    loadProgress = 90;

    // Store the full dataset for future use
    cachedData = allPriceData;
    
    loadProgress = 100;
    console.log(`Loaded full dataset: ${allPriceData.length} points`);

    return allPriceData;
  } catch (error) {
    console.error('Error loading data from file:', error);
    console.log('No trading data available. Please run "npm run generate-data" to create data.');

    cachedData = [];
    return [];
  } finally {
    isLoading = false;
    loadProgress = 0;
  }
};

// Optimized time range data loading with binary search and caching
const loadTimeRangeData = async (timeRange: string): Promise<PriceData[]> => {
  // Check if we already have this range cached
  if (cachedRanges.has(timeRange)) {
    return cachedRanges.get(timeRange)!;
  }

  // If we don't have the full dataset yet, load it
  if (!cachedData) {
    await loadDefaultData();
  }

  if (!cachedData || cachedData.length === 0) {
    return [];
  }

  const dataEnd = cachedData[cachedData.length - 1].timestamp;
  let filteredData: PriceData[] = [];

  // Binary search for efficient date filtering
  const findStartIndex = (targetDate: Date): number => {
    let left = 0;
    let right = cachedData!.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midDate = cachedData![mid].timestamp;
      
      if (midDate >= targetDate) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    
    return left;
  };

  switch (timeRange) {
    case '1H':
      const oneHourAgo = new Date(dataEnd.getTime() - 60 * 60 * 1000);
      const startIndex1H = findStartIndex(oneHourAgo);
      filteredData = cachedData!.slice(startIndex1H);
      break;
    case '1D':
      const oneDayAgo = new Date(dataEnd.getTime() - 24 * 60 * 60 * 1000);
      const startIndex1D = findStartIndex(oneDayAgo);
      filteredData = cachedData!.slice(startIndex1D);
      break;
    case '5D':
      const fiveDaysAgo = new Date(dataEnd.getTime() - 5 * 24 * 60 * 60 * 1000);
      const startIndex5D = findStartIndex(fiveDaysAgo);
      filteredData = cachedData!.slice(startIndex5D);
      break;
    case '1M':
      const oneMonthAgo = new Date(dataEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startIndex1M = findStartIndex(oneMonthAgo);
      filteredData = cachedData!.slice(startIndex1M);
      break;
    case '3M':
      const threeMonthsAgo = new Date(dataEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
      const startIndex3M = findStartIndex(threeMonthsAgo);
      filteredData = cachedData!.slice(startIndex3M);
      break;
    case '6M':
      const sixMonthsAgo = new Date(dataEnd.getTime() - 180 * 24 * 60 * 60 * 1000);
      const startIndex6M = findStartIndex(sixMonthsAgo);
      filteredData = cachedData!.slice(startIndex6M);
      break;
    case 'YTD':
      const startOfYearUTC = new Date(Date.UTC(dataEnd.getUTCFullYear(), 0, 1));
      const startIndexYTD = findStartIndex(startOfYearUTC);
      filteredData = cachedData!.slice(startIndexYTD);
      break;
    case '1Y':
      const oneYearAgo = new Date(dataEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
      const startIndex1Y = findStartIndex(oneYearAgo);
      filteredData = cachedData!.slice(startIndex1Y);
      break;
    case '5Y':
      const fiveYearsAgo = new Date(dataEnd.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
      const startIndex5Y = findStartIndex(fiveYearsAgo);
      filteredData = cachedData!.slice(startIndex5Y);
      break;
    case '10Y':
      const tenYearsAgo = new Date(dataEnd.getTime() - 10 * 365 * 24 * 60 * 60 * 1000);
      const startIndex10Y = findStartIndex(tenYearsAgo);
      filteredData = cachedData!.slice(startIndex10Y);
      break;
    case 'All':
      filteredData = cachedData || [];
      break;
    default:
      const defaultAgo = new Date(dataEnd.getTime() - 24 * 60 * 60 * 1000);
      const startIndexDefault = findStartIndex(defaultAgo);
      filteredData = cachedData!.slice(startIndexDefault);
      break;
  }

  // Cache and return all data points
  cachedRanges.set(timeRange, filteredData);
  console.log(`Loaded ${timeRange} data: ${filteredData.length} points`);
  return filteredData;
};

// Enhanced virtual scrolling support for large datasets with better sampling
export const getViewportData = (
  data: PriceData[],
  viewport: { startIndex: number; endIndex: number },
  maxVisiblePoints: number = 1000
): ViewportData => {
  if (data.length === 0) {
    return { visibleData: [], startIndex: 0, endIndex: 0, totalPoints: 0 };
  }

  const startIdx = Math.max(0, Math.floor(viewport.startIndex));
  const endIdx = Math.min(data.length - 1, Math.ceil(viewport.endIndex));
  const visibleCount = endIdx - startIdx + 1;

  // If we have too many points to render efficiently, use intelligent sampling
  if (visibleCount > maxVisiblePoints) {
    const step = Math.ceil(visibleCount / maxVisiblePoints);
    const sampledData: PriceData[] = [];
    
    // Use weighted sampling to preserve important data points
    for (let i = startIdx; i <= endIdx; i += step) {
      sampledData.push(data[i]);
    }
    
    return {
      visibleData: sampledData,
      startIndex: startIdx,
      endIndex: endIdx,
      totalPoints: data.length
    };
  }

  return {
    visibleData: data.slice(startIdx, endIdx + 1),
    startIndex: startIdx,
    endIndex: endIdx,
    totalPoints: data.length
  };
};

// Function to get trading data for specific time range with enhanced caching
export const getTradingDataForRange = async (timeRange: string): Promise<TradingStrategy> => {
  // Always use the same path for all time ranges
  const filteredData = await loadTimeRangeData(timeRange);

  if (filteredData.length === 0) {
    return {
      priceData: [],
      signal: {
        type: 'NEUTRAL',
        timestamp: new Date(),
        price: 0
      }
    };
  }

  const signal = calculateTradingSignal(filteredData);

  return {
    priceData: filteredData,
    signal
  };
};

// Memory management function to clear caches
export const clearCaches = () => {
  cachedRanges.clear();
  console.log('Trading data caches cleared');
};

// Legacy functions for backward compatibility
export const getTradingData = async (): Promise<TradingStrategy> => {
  return getTradingDataForRange('1D');
};

export const updateTradingData = (newData: PriceData[]): TradingStrategy => {
  const signal = calculateTradingSignal(newData);

  return {
    priceData: newData,
    signal
  };
};

export const comprehensiveTradingData = async (): Promise<PriceData[]> => {
  if (!cachedData) {
    await loadDefaultData();
  }
  return cachedData || [];
}; 