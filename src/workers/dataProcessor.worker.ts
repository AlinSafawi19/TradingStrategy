// Web Worker for data processing
// This moves heavy calculations off the main thread

interface WorkerMessage {
  type: 'PROCESS_DATA' | 'CALCULATE_INDICATORS' | 'FILTER_DATA';
  data: any;
  id: string;
}

interface WorkerResponse {
  type: string;
  data: any;
  id: string;
  error?: string;
}

// SSL Channel calculation
const calculateSSLChannel = (data: any[]): 'BUY' | 'SELL' | 'NEUTRAL' => {
  if (data.length < 200) {
    return 'NEUTRAL';
  }

  const currentPrice = data[data.length - 1].close;
  const recentData = data.slice(-200);
  const highSMA = recentData.reduce((sum: number, p: any) => sum + p.high, 0) / recentData.length;
  const lowSMA = recentData.reduce((sum: number, p: any) => sum + p.low, 0) / recentData.length;

  if (currentPrice > highSMA) {
    return 'BUY';
  } else if (currentPrice < lowSMA) {
    return 'SELL';
  } else {
    return 'NEUTRAL';
  }
};

// Trend Fusion calculation
const calculateTrendFusion = (data: any[]): 'GREEN' | 'RED' | 'NEUTRAL' => {
  if (data.length < 50) {
    return 'NEUTRAL';
  }

  const shortPeriod = 14;
  const longPeriod = 50;

  const calculateEMA = (data: any[], period: number): number => {
    const multiplier = 2 / (period + 1);
    let ema = data[0].close;

    for (let i = 1; i < data.length; i++) {
      ema = (data[i].close * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  };

  const shortEMA = calculateEMA(data, shortPeriod);
  const longEMA = calculateEMA(data, longPeriod);

  if (shortEMA > longEMA) {
    return 'GREEN';
  } else if (shortEMA < longEMA) {
    return 'RED';
  } else {
    return 'NEUTRAL';
  }
};

// Binary search for efficient date filtering
const findStartIndex = (data: any[], targetDate: Date): number => {
  let left = 0;
  let right = data.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midDate = new Date(data[mid].timestamp);
    
    if (midDate >= targetDate) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  
  return left;
};

// Process data based on time range
const processTimeRangeData = (data: any[], timeRange: string): any[] => {
  if (data.length === 0) return [];

  const dataEnd = new Date(data[data.length - 1].timestamp);
  let filteredData: any[] = [];

  switch (timeRange) {
    case '1H':
      const oneHourAgo = new Date(dataEnd.getTime() - 60 * 60 * 1000);
      const startIndex1H = findStartIndex(data, oneHourAgo);
      filteredData = data.slice(startIndex1H);
      break;
    case '1D':
      const oneDayAgo = new Date(dataEnd.getTime() - 24 * 60 * 60 * 1000);
      const startIndex1D = findStartIndex(data, oneDayAgo);
      filteredData = data.slice(startIndex1D);
      break;
    case '5D':
      const fiveDaysAgo = new Date(dataEnd.getTime() - 5 * 24 * 60 * 60 * 1000);
      const startIndex5D = findStartIndex(data, fiveDaysAgo);
      filteredData = data.slice(startIndex5D);
      break;
    case '1M':
      const oneMonthAgo = new Date(dataEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startIndex1M = findStartIndex(data, oneMonthAgo);
      filteredData = data.slice(startIndex1M);
      break;
    case '3M':
      const threeMonthsAgo = new Date(dataEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
      const startIndex3M = findStartIndex(data, threeMonthsAgo);
      filteredData = data.slice(startIndex3M);
      break;
    case '6M':
      const sixMonthsAgo = new Date(dataEnd.getTime() - 180 * 24 * 60 * 60 * 1000);
      const startIndex6M = findStartIndex(data, sixMonthsAgo);
      filteredData = data.slice(startIndex6M);
      break;
    case 'YTD':
      const startOfYearUTC = new Date(Date.UTC(dataEnd.getUTCFullYear(), 0, 1));
      const startIndexYTD = findStartIndex(data, startOfYearUTC);
      filteredData = data.slice(startIndexYTD);
      break;
    case '1Y':
      const oneYearAgo = new Date(dataEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
      const startIndex1Y = findStartIndex(data, oneYearAgo);
      filteredData = data.slice(startIndex1Y);
      break;
    case '5Y':
      const fiveYearsAgo = new Date(dataEnd.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
      const startIndex5Y = findStartIndex(data, fiveYearsAgo);
      filteredData = data.slice(startIndex5Y);
      break;
    case 'All':
      filteredData = data;
      break;
    default:
      const defaultAgo = new Date(dataEnd.getTime() - 24 * 60 * 60 * 1000);
      const startIndexDefault = findStartIndex(data, defaultAgo);
      filteredData = data.slice(startIndexDefault);
      break;
  }

  return filteredData;
};

// Handle worker messages
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { type, data, id } = event.data;
  let response: WorkerResponse;

  try {
    switch (type) {
      case 'PROCESS_DATA':
        const processedData = processTimeRangeData(data.data, data.timeRange);
        response = {
          type: 'PROCESS_DATA_COMPLETE',
          data: processedData,
          id
        };
        break;

      case 'CALCULATE_INDICATORS':
        const sslSignal = calculateSSLChannel(data);
        const trendSignal = calculateTrendFusion(data);
        response = {
          type: 'INDICATORS_COMPLETE',
          data: { sslSignal, trendSignal },
          id
        };
        break;

      case 'FILTER_DATA':
        const filteredData = data.data.filter((item: any) => {
          const itemDate = new Date(item.timestamp);
          return itemDate >= data.fromDate && itemDate <= data.toDate;
        });
        response = {
          type: 'FILTER_COMPLETE',
          data: filteredData,
          id
        };
        break;

      default:
        response = {
          type: 'ERROR',
          data: null,
          id,
          error: `Unknown message type: ${type}`
        };
    }
  } catch (error) {
    response = {
      type: 'ERROR',
      data: null,
      id,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  self.postMessage(response);
});

export {}; 