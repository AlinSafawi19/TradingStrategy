// Performance monitoring utilities
import { useRef, useEffect } from 'react';

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  dataPoints: number;
  visiblePoints: number;
  cacheHits: number;
  cacheMisses: number;
  fps: number;
  frameTime: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    renderTime: 0,
    memoryUsage: 0,
    dataPoints: 0,
    visiblePoints: 0,
    cacheHits: 0,
    cacheMisses: 0,
    fps: 0,
    frameTime: 0
  };

  private renderStartTime: number = 0;
  private cacheStats = { hits: 0, misses: 0 };
  private frameCount = 0;
  private lastFrameTime = 0;
  private fpsUpdateInterval: number | null = null;

  constructor() {
    this.startFPSMonitoring();
  }

  private startFPSMonitoring() {
    this.fpsUpdateInterval = window.setInterval(() => {
      this.updateFPS();
    }, 1000);
  }

  private updateFPS() {
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      this.metrics.fps = Math.round(1000 / (now - this.lastFrameTime));
      this.metrics.frameTime = now - this.lastFrameTime;
    }
    this.lastFrameTime = now;
  }

  startRender() {
    this.renderStartTime = performance.now();
    this.frameCount++;
  }

  endRender() {
    if (this.renderStartTime > 0) {
      this.metrics.renderTime = performance.now() - this.renderStartTime;
      this.renderStartTime = 0;
    }
  }

  updateDataMetrics(totalPoints: number, visiblePoints: number) {
    this.metrics.dataPoints = totalPoints;
    this.metrics.visiblePoints = visiblePoints;
  }

  updateMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
    }
  }

  recordCacheHit() {
    this.cacheStats.hits++;
    this.metrics.cacheHits = this.cacheStats.hits;
  }

  recordCacheMiss() {
    this.cacheStats.misses++;
    this.metrics.cacheMisses = this.cacheStats.misses;
  }

  getMetrics(): PerformanceMetrics {
    this.updateMemoryUsage();
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      renderTime: 0,
      memoryUsage: 0,
      dataPoints: 0,
      visiblePoints: 0,
      cacheHits: 0,
      cacheMisses: 0,
      fps: 0,
      frameTime: 0
    };
  }

  destroy() {
    if (this.fpsUpdateInterval) {
      clearInterval(this.fpsUpdateInterval);
      this.fpsUpdateInterval = null;
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Enhanced debounce with better performance
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const later = () => {
    timeout = null;
    if (!immediate) func();
  };

  return (...args: Parameters<T>) => {
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
};

// Enhanced throttle with better performance
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  let lastFunc: ReturnType<typeof setTimeout>;
  let lastRan: number;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      if (options.leading !== false) {
        func(...args);
      }
      lastRan = Date.now();
      inThrottle = true;
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          if (options.trailing !== false) {
            func(...args);
          }
          lastRan = Date.now();
        }
      }, Math.max(limit - (Date.now() - lastRan), 0));
    }
  };
};

// Improved RequestAnimationFrame based throttling for smooth animations
export const rafThrottle = <T extends (...args: any[]) => any>(
  func: T
): ((...args: Parameters<T>) => void) => {
  let ticking = false;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    lastArgs = args;

    if (!ticking) {
      requestAnimationFrame(() => {
        if (lastArgs) {
          func(...lastArgs);
          lastArgs = null;
        }
        ticking = false;
      });
      ticking = true;
    }
  };
};

// Enhanced memory cleanup
export const cleanupMemory = () => {
  // Force garbage collection if available
  if ('gc' in window) {
    (window as any).gc();
  }
  
  // Clear any cached data
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
  
  console.log('Memory cleanup completed');
};

// LRU Cache implementation for better memory management
export class LRUCache<K, V> {
  private capacity: number;
  private cache = new Map<K, V>();

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      const value = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return undefined;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else   if (this.cache.size >= this.capacity) {
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
    }
  }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Enhanced performance logging
export const logPerformance = (component: string, metrics: Partial<PerformanceMetrics>) => {
    console.log(`[${component}] Performance:`, {
      renderTime: metrics.renderTime?.toFixed(2) + 'ms',
      memoryUsage: metrics.memoryUsage?.toFixed(2) + 'MB',
      fps: metrics.fps,
      dataPoints: metrics.dataPoints,
      visiblePoints: metrics.visiblePoints
    });
};

// Batch DOM updates for better performance
export const batchDOMUpdates = (updates: (() => void)[]) => {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
};

// Optimized event listener management
export const addOptimizedEventListener = (
  element: EventTarget,
  event: string,
  handler: EventListener,
  options: AddEventListenerOptions = {}
) => {
  const optimizedHandler = (e: Event) => {
    e.preventDefault();
    handler(e);
  };

  element.addEventListener(event, optimizedHandler, {
    passive: false,
    ...options
  });

  return () => {
    element.removeEventListener(event, optimizedHandler);
  };
};

// Enhanced resize handler with better performance
export const createResizeHandler = (callback: () => void, delay = 250) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(callback, delay);
  };
};

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const renderCount = useRef(0);
  const startTime = useRef(0);

  useEffect(() => {
    renderCount.current++;
    startTime.current = performance.now();

    return () => {
      const renderTime = performance.now() - startTime.current;
      logPerformance(componentName, { renderTime });
    };
  });
};

// Memory leak detection
export const detectMemoryLeaks = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    const used = memory.usedJSHeapSize / 1024 / 1024;
    const total = memory.totalJSHeapSize / 1024 / 1024;
    const limit = memory.jsHeapSizeLimit / 1024 / 1024;
    
    console.log(`Memory Usage: ${used.toFixed(2)}MB / ${total.toFixed(2)}MB (Limit: ${limit.toFixed(2)}MB)`);
    
    if (used / limit > 0.8) {
      console.warn('High memory usage detected!');
      cleanupMemory();
    }
  }
};

// Enhanced viewport calculation cache
export class ViewportCache {
  private cache = new Map<string, any>();
  private maxSize = 50;

  get(key: string): any | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: any): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const viewportCache = new ViewportCache();

// Enhanced event throttling for better performance
export const createEventThrottler = (delay: number = 16) => {
  let lastCall = 0;
  return (callback: () => void) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      callback();
    }
  };
};

// Optimized data processing utilities
export const processDataInChunks = <T>(
  data: T[],
  chunkSize: number,
  processor: (chunk: T[]) => void
) => {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    requestAnimationFrame(() => processor(chunk));
  }
};

// Enhanced canvas rendering utilities
export const optimizeCanvasRendering = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
  // Enable hardware acceleration
  ctx.imageSmoothingEnabled = false;
  
  // Set canvas size for high DPI displays
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  
  ctx.scale(dpr, dpr);
  
  return ctx;
}; 