// Worker Manager for handling Web Worker communication
import type { PriceData } from '../tradingData';

interface WorkerTask {
  id: string;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

class WorkerManager {
  private worker: Worker | null = null;
  private tasks = new Map<string, WorkerTask>();
  private taskId = 0;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      // Create worker with proper error handling
      this.worker = new Worker(
        new URL('./dataProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
        this.handleWorkerError(error);
      };
    } catch (error) {
      console.warn('Web Worker not supported, falling back to main thread processing');
      this.worker = null;
    }
  }

  private handleWorkerMessage(response: any) {
    const task = this.tasks.get(response.id);
    if (task) {
      clearTimeout(task.timeout);
      this.tasks.delete(response.id);

      if (response.error) {
        task.reject(new Error(response.error));
      } else {
        task.resolve(response.data);
      }
    }
  }

  private handleWorkerError(error: ErrorEvent) {
    // Clear all pending tasks on worker error
    this.tasks.forEach((task) => {
      task.reject(new Error(`Worker error: ${error.message}`));
    });
    this.tasks.clear();
  }

  private createTask(): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `task_${++this.taskId}`;
      const timeout = setTimeout(() => {
        this.tasks.delete(id);
        reject(new Error('Worker task timeout'));
      }, 30000); // 30 second timeout

      this.tasks.set(id, { id, resolve, reject, timeout });
    });
  }

  private sendMessage(type: string, data: any): Promise<any> {
    if (!this.worker) {
      // Fallback to main thread processing
      return this.fallbackProcessing(type, data);
    }

    return new Promise((resolve, reject) => {
      const task = this.createTask();
      task.then(resolve).catch(reject);

      const taskId = Array.from(this.tasks.keys()).pop()!;
      this.worker!.postMessage({
        type,
        data,
        id: taskId
      });
    });
  }

  // Fallback processing for when Web Workers are not available
  private fallbackProcessing(type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        switch (type) {
          case 'PROCESS_DATA':
            // Simple filtering fallback
            const filteredData = this.filterDataByTimeRange(data.data, data.timeRange);
            resolve(filteredData);
            break;
          case 'CALCULATE_INDICATORS':
            // Simple indicator calculation fallback
            const indicators = this.calculateIndicatorsFallback(data);
            resolve(indicators);
            break;
          default:
            reject(new Error(`Unknown task type: ${type}`));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  // Fallback data filtering
  private filterDataByTimeRange(data: PriceData[], timeRange: string): PriceData[] {
    if (data.length === 0) return [];

    const dataEnd = data[data.length - 1].timestamp;
    let filteredData: PriceData[] = [];

    switch (timeRange) {
      case '1H':
        const oneHourAgo = new Date(dataEnd.getTime() - 60 * 60 * 1000);
        filteredData = data.filter(item => item.timestamp >= oneHourAgo);
        break;
      case '1D':
        const oneDayAgo = new Date(dataEnd.getTime() - 24 * 60 * 60 * 1000);
        filteredData = data.filter(item => item.timestamp >= oneDayAgo);
        break;
      case '5D':
        const fiveDaysAgo = new Date(dataEnd.getTime() - 5 * 24 * 60 * 60 * 1000);
        filteredData = data.filter(item => item.timestamp >= fiveDaysAgo);
        break;
      case '1M':
        const oneMonthAgo = new Date(dataEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredData = data.filter(item => item.timestamp >= oneMonthAgo);
        break;
      case '3M':
        const threeMonthsAgo = new Date(dataEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
        filteredData = data.filter(item => item.timestamp >= threeMonthsAgo);
        break;
      case '6M':
        const sixMonthsAgo = new Date(dataEnd.getTime() - 180 * 24 * 60 * 60 * 1000);
        filteredData = data.filter(item => item.timestamp >= sixMonthsAgo);
        break;
      case 'YTD':
        const startOfYearUTC = new Date(Date.UTC(dataEnd.getUTCFullYear(), 0, 1));
        filteredData = data.filter(item => item.timestamp >= startOfYearUTC);
        break;
      case '1Y':
        const oneYearAgo = new Date(dataEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
        filteredData = data.filter(item => item.timestamp >= oneYearAgo);
        break;
      case '5Y':
        const fiveYearsAgo = new Date(dataEnd.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
        filteredData = data.filter(item => item.timestamp >= fiveYearsAgo);
        break;
      case 'All':
        filteredData = data;
        break;
      default:
        const defaultAgo = new Date(dataEnd.getTime() - 24 * 60 * 60 * 1000);
        filteredData = data.filter(item => item.timestamp >= defaultAgo);
        break;
    }

    return filteredData;
  }

  // Fallback indicator calculation
  private calculateIndicatorsFallback(data: PriceData[]): { sslSignal: string; trendSignal: string } {
    // Simple SSL calculation
    let sslSignal = 'NEUTRAL';
    if (data.length >= 200) {
      const currentPrice = data[data.length - 1].close;
      const recentData = data.slice(-200);
      const highSMA = recentData.reduce((sum, p) => sum + p.high, 0) / recentData.length;
      const lowSMA = recentData.reduce((sum, p) => sum + p.low, 0) / recentData.length;

      if (currentPrice > highSMA) {
        sslSignal = 'BUY';
      } else if (currentPrice < lowSMA) {
        sslSignal = 'SELL';
      }
    }

    // Simple trend calculation
    let trendSignal = 'NEUTRAL';
    if (data.length >= 50) {
      const shortPeriod = 14;
      const longPeriod = 50;

      const calculateEMA = (data: PriceData[], period: number): number => {
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
        trendSignal = 'GREEN';
      } else if (shortEMA < longEMA) {
        trendSignal = 'RED';
      }
    }

    return { sslSignal, trendSignal };
  }

  // Public API methods
  async processData(data: PriceData[], timeRange: string): Promise<PriceData[]> {
    return this.sendMessage('PROCESS_DATA', { data, timeRange });
  }

  async calculateIndicators(data: PriceData[]): Promise<{ sslSignal: string; trendSignal: string }> {
    return this.sendMessage('CALCULATE_INDICATORS', data);
  }

  async filterData(data: PriceData[], fromDate: Date, toDate: Date): Promise<PriceData[]> {
    return this.sendMessage('FILTER_DATA', { data, fromDate, toDate });
  }

  // Cleanup
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.tasks.clear();
  }
}

// Export singleton instance
export const workerManager = new WorkerManager(); 