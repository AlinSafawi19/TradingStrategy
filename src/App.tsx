import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FiSun, FiMoon, FiLoader, FiZoomIn, FiZoomOut, FiRotateCcw, FiSettings } from 'react-icons/fi';
import { GiGoldBar } from 'react-icons/gi';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { format, isWithinInterval } from 'date-fns';
import 'react-day-picker/dist/style.css';
import {
  getTradingDataForRange,
  getLoadingState,
  getViewportData,
  getFullDataRange,
  type TradingStrategy
} from './tradingData';
import { calculateSSLChannel, calculateTrendFusion } from './strategyLogic';
import { rafThrottle } from './performanceUtils';
import './App.css';

// Indicator Settings Interface
interface IndicatorSettings {
  sslChannel: {
    maPeriod: number;
    maType: 'SMA' | 'EMA';
  };
  trendFusion: {
    shortEMAPeriod: number;
    longEMAPeriod: number;
    rsiPeriod: number;
    topLevel: number;
    bottomLevel: number;
  };
}

// Default indicator settings
const defaultIndicatorSettings: IndicatorSettings = {
  sslChannel: {
    maPeriod: 200,
    maType: 'SMA'
  },
  trendFusion: {
    shortEMAPeriod: 14,
    longEMAPeriod: 50,
    rsiPeriod: 14,
    topLevel: 60,
    bottomLevel: 40
  }
};

// Loading Spinner Component
const LoadingSpinner = ({ size = 'md', isDarkMode }: { size?: 'sm' | 'md' | 'lg'; isDarkMode: boolean }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className="flex items-center justify-center loading-spinner">
      <FiLoader
        className={`${sizeClasses[size]} animate-spin loading-spinner-icon ${isDarkMode ? 'text-gray-400' : 'text-blue-600'}`}
      />
    </div>
  );
};

// Indicator Settings Modal Component
const IndicatorSettingsModal = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  isDarkMode
}: {
  isOpen: boolean;
  onClose: () => void;
  settings: IndicatorSettings;
  onSettingsChange: (settings: IndicatorSettings) => void;
  isDarkMode: boolean;
}) => {
  const [localSettings, setLocalSettings] = useState<IndicatorSettings>(settings);
  const [activeTab, setActiveTab] = useState<'ssl' | 'trend'>('ssl');

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(defaultIndicatorSettings);
  };

  const updateSSLChannel = (updates: Partial<IndicatorSettings['sslChannel']>) => {
    setLocalSettings(prev => ({
      ...prev,
      sslChannel: { ...prev.sslChannel, ...updates }
    }));
  };

  const updateTrendFusion = (updates: Partial<IndicatorSettings['trendFusion']>) => {
    setLocalSettings(prev => ({
      ...prev,
      trendFusion: { ...prev.trendFusion, ...updates }
    }));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className={`relative p-4 rounded-lg shadow-xl border max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-2 right-2 p-1 rounded-full hover:bg-opacity-80 transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
          aria-label="Close settings"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col space-y-4">
          <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
            Indicator Settings
          </h3>

          {/* Tab Navigation */}
          <div className="flex border-gray-300">
            <button
              onClick={() => setActiveTab('ssl')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'ssl'
                ? isDarkMode
                  ? 'text-gray-200 border-b-2 border-gray-200'
                  : 'text-gray-800 border-b-2 border-gray-800'
                : isDarkMode
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              SSL Channel
            </button>
            <button
              onClick={() => setActiveTab('trend')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'trend'
                ? isDarkMode
                  ? 'text-gray-200 border-b-2 border-gray-200'
                  : 'text-gray-800 border-b-2 border-gray-800'
                : isDarkMode
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Trend Fusion
            </button>
          </div>

          {/* SSL Channel Settings */}
          {activeTab === 'ssl' && (
            <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-500' : 'bg-gray-50 border-gray-200'}`}>
              <div className="mb-3">
                <h4 className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  SSL Channel Indicator
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ma-period" className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    MA Period
                  </label>
                  <input
                    id="ma-period"
                    type="number"
                    min="1"
                    max="500"
                    value={localSettings.sslChannel.maPeriod}
                    onChange={(e) => updateSSLChannel({ maPeriod: parseInt(e.target.value) || 200 })}
                    className={`w-full px-2 py-1 text-sm rounded border ${isDarkMode ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder="200"
                  />
                </div>

                <div className="col-span-2">
                  <label htmlFor="ma-type" className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    MA Type
                  </label>
                  <select
                    id="ma-type"
                    value={localSettings.sslChannel.maType}
                    onChange={(e) => updateSSLChannel({ maType: e.target.value as any })}
                    className={`w-full px-2 py-1 text-sm rounded border ${isDarkMode ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                    title="Moving Average Type"
                  >
                    <option value="SMA">Simple Moving Average (SMA)</option>
                    <option value="EMA">Exponential Moving Average (EMA)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Trend Fusion Settings */}
          {activeTab === 'trend' && (
            <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-500' : 'bg-gray-50 border-gray-200'}`}>
              <div className="mb-3">
                <h4 className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Trend Fusion Indicator
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="short-ema-period" className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Short EMA
                  </label>
                  <input
                    id="short-ema-period"
                    type="number"
                    min="1"
                    max="100"
                    value={localSettings.trendFusion.shortEMAPeriod}
                    onChange={(e) => updateTrendFusion({ shortEMAPeriod: parseInt(e.target.value) || 14 })}
                    className={`w-full px-2 py-1 text-sm rounded border ${isDarkMode ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder="14"
                  />
                </div>

                <div>
                  <label htmlFor="long-ema-period" className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Long EMA
                  </label>
                  <input
                    id="long-ema-period"
                    type="number"
                    min="1"
                    max="200"
                    value={localSettings.trendFusion.longEMAPeriod}
                    onChange={(e) => updateTrendFusion({ longEMAPeriod: parseInt(e.target.value) || 50 })}
                    className={`w-full px-2 py-1 text-sm rounded border ${isDarkMode ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder="50"
                  />
                </div>

                <div>
                  <label htmlFor="rsi-period" className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    RSI Period
                  </label>
                  <input
                    id="rsi-period"
                    type="number"
                    min="1"
                    max="50"
                    value={localSettings.trendFusion.rsiPeriod}
                    onChange={(e) => updateTrendFusion({ rsiPeriod: parseInt(e.target.value) || 14 })}
                    className={`w-full px-2 py-1 text-sm rounded border ${isDarkMode ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder="14"
                  />
                </div>

                <div>
                  <label htmlFor="top-level" className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    RSI Top Level
                  </label>
                  <input
                    id="top-level"
                    type="number"
                    min="50"
                    max="100"
                    value={localSettings.trendFusion.topLevel}
                    onChange={(e) => updateTrendFusion({ topLevel: parseInt(e.target.value) || 60 })}
                    className={`w-full px-2 py-1 text-sm rounded border ${isDarkMode ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder="60"
                  />
                </div>

                <div>
                  <label htmlFor="bottom-level" className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    RSI Bottom Level
                  </label>
                  <input
                    id="bottom-level"
                    type="number"
                    min="0"
                    max="50"
                    value={localSettings.trendFusion.bottomLevel}
                    onChange={(e) => updateTrendFusion({ bottomLevel: parseInt(e.target.value) || 40 })}
                    className={`w-full px-2 py-1 text-sm rounded border ${isDarkMode ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder="40"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-3 border-gray-300">
            <button
              type="button"
              onClick={handleReset}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors border btn-optimized ${isDarkMode
                ? 'bg-gray-600 text-gray-300 hover:bg-gray-500 border-gray-500'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 border-gray-300'
                }`}
            >
              Reset to Defaults
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors btn-optimized ${isDarkMode
                  ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors border btn-optimized ${isDarkMode
                  ? 'bg-gray-600 border-gray-500 text-gray-200 hover:bg-gray-500'
                  : 'bg-gray-200 border-gray-300 text-gray-800 hover:bg-gray-300'
                  }`}
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Canvas-based Chart Renderer for better performance
const CanvasChart = React.memo(({
  data,
  viewport,
  priceInfo,
  isDarkMode,
  width,
  height,
  indicatorSettings
}: {
  data: any[];
  viewport: any;
  priceInfo: any;
  isDarkMode: boolean;
  width: number;
  height: number;
  indicatorSettings: IndicatorSettings;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const renderChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set canvas size for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Draw grid lines
    ctx.strokeStyle = isDarkMode ? '#374151' : '#E5E7EB';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.6;

    // Horizontal grid lines
    const numGridLines = 6;
    for (let i = 0; i <= numGridLines; i++) {
      const y = (height * i) / numGridLines;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 0; i <= numGridLines; i++) {
      const x = (width * i) / numGridLines;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw candlesticks
    ctx.globalAlpha = 1;
    const candleWidth = Math.max(1, Math.min(6, width / Math.max(data.length, 1) * 0.8));
    const spacing = width / Math.max(data.length, 1);

    data.forEach((candle, index) => {
      const x = index * spacing + spacing / 2;
      const openY = height - ((candle.open - priceInfo.minPrice) / priceInfo.priceRange) * height;
      const closeY = height - ((candle.close - priceInfo.minPrice) / priceInfo.priceRange) * height;
      const highY = height - ((candle.high - priceInfo.minPrice) / priceInfo.priceRange) * height;
      const lowY = height - ((candle.low - priceInfo.minPrice) / priceInfo.priceRange) * height;

      const isGreen = candle.close >= candle.open;
      ctx.strokeStyle = isGreen ? '#10B981' : '#EF4444';
      ctx.fillStyle = isGreen ? '#10B981' : '#EF4444';

      // Draw wick
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Draw body
      const bodyHeight = Math.abs(closeY - openY);
      const bodyY = Math.min(openY, closeY);
      ctx.fillRect(x - candleWidth / 2, bodyY, candleWidth, Math.max(bodyHeight, 1));
    });

    // Draw SSL Channel indicators with custom settings
    if (data.length >= Math.max(indicatorSettings.sslChannel.maPeriod, indicatorSettings.sslChannel.maPeriod)) {
      const sslData = calculateSSLChannel(data, false, {
        maPeriod: indicatorSettings.sslChannel.maPeriod,
        maType: indicatorSettings.sslChannel.maType,
      });

      if (sslData.sslUp > 0 && sslData.sslDown > 0) {
        const sslUpY = height - ((sslData.sslUp - priceInfo.minPrice) / priceInfo.priceRange) * height;
        const sslDownY = height - ((sslData.sslDown - priceInfo.minPrice) / priceInfo.priceRange) * height;

        // Draw SSL Up line (MA High) with custom color
        ctx.strokeStyle = '#EAB308';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, sslUpY);
        ctx.lineTo(width, sslUpY);
        ctx.stroke();

        // Draw SSL Down line (MA Low) with custom color
        ctx.strokeStyle = '#EAB308';
        ctx.beginPath();
        ctx.moveTo(0, sslDownY);
        ctx.lineTo(width, sslDownY);
        ctx.stroke();

        // Fill between SSL lines with blended color transparency
        const highColor = '#EAB308';
        const lowColor = '#EAB308';
        const highRgb = highColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        const lowRgb = lowColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        if (highRgb && lowRgb) {
          const r1 = parseInt(highRgb[1], 16);
          const g1 = parseInt(highRgb[2], 16);
          const b1 = parseInt(highRgb[3], 16);
          const r2 = parseInt(lowRgb[1], 16);
          const g2 = parseInt(lowRgb[2], 16);
          const b2 = parseInt(lowRgb[3], 16);
          // Blend the colors for the fill
          const r = Math.round((r1 + r2) / 2);
          const g = Math.round((g1 + g2) / 2);
          const b = Math.round((b1 + b2) / 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.1)`;
          ctx.fillRect(0, Math.min(sslUpY, sslDownY), width, Math.abs(sslUpY - sslDownY));
        }
      }
    }

    // Draw current price line
    if (data.length > 0) {
      const currentPrice = data[data.length - 1].close;
      const currentPriceY = height - ((currentPrice - priceInfo.minPrice) / priceInfo.priceRange) * height;

      // Draw horizontal price line
      ctx.strokeStyle = isDarkMode ? '#10B981' : '#059669';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); // Dashed line
      ctx.globalAlpha = 0.8;

      ctx.beginPath();
      ctx.moveTo(0, currentPriceY);
      ctx.lineTo(width, currentPriceY);
      ctx.stroke();

      // Reset line style
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }, [data, viewport, priceInfo, isDarkMode, width, height, indicatorSettings]);

  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(renderChart);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderChart]);

  return (
    <canvas
      ref={canvasRef}
      className="canvas-chart"
    />
  );
});

// Trend Fusion Subplot Component
const TrendFusionSubplot = React.memo(({
  data,
  isDarkMode,
  width,
  height,
  indicatorSettings
}: {
  data: any[];
  isDarkMode: boolean;
  width: number;
  height: number;
  indicatorSettings: IndicatorSettings;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const renderSubplot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set canvas size for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Calculate Trend Fusion data with custom settings
    const trendData = calculateTrendFusion(data, {
      shortEMAPeriod: indicatorSettings.trendFusion.shortEMAPeriod,
      longEMAPeriod: indicatorSettings.trendFusion.longEMAPeriod,
      rsiPeriod: indicatorSettings.trendFusion.rsiPeriod,
      topLevel: indicatorSettings.trendFusion.topLevel,
      bottomLevel: indicatorSettings.trendFusion.bottomLevel,
    });

    // Draw background
    ctx.fillStyle = isDarkMode ? '#1F2937' : '#F9FAFB';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = isDarkMode ? '#374151' : '#E5E7EB';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.6;

    // Horizontal grid lines
    const numGridLines = 4;
    for (let i = 0; i <= numGridLines; i++) {
      const y = (height * i) / numGridLines;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw momentum histogram
    const minDataPoints = Math.max(indicatorSettings.trendFusion.shortEMAPeriod, indicatorSettings.trendFusion.longEMAPeriod, indicatorSettings.trendFusion.rsiPeriod);
    if (data.length >= minDataPoints) {
      const momentum = trendData.momentum;
      const momentumY = height / 2 - (momentum / 50) * (height / 2); // Scale momentum to fit

      // Draw momentum bar with custom color
      ctx.fillStyle = momentum >= 0 ? '#10B981' : '#EF4444';
      ctx.globalAlpha = 0.7;
      ctx.fillRect(width / 2 - 20, momentumY, 40, Math.abs(momentum / 50) * height);

      // Draw zero line
      ctx.strokeStyle = isDarkMode ? '#6B7280' : '#9CA3AF';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    }

    // Draw RSI bias line
    if (trendData.rsiBias !== 'NEUTRAL') {
      const rsiBiasY = height - ((trendData.rsiBiasLine - 0) / 100) * height;

      ctx.strokeStyle = '#EC4899'; // Use custom RSI color
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, rsiBiasY);
      ctx.lineTo(width, rsiBiasY);
      ctx.stroke();
    }

    // Draw RSI value
    if (data.length >= minDataPoints) {
      const rsiY = height - ((trendData.rsiValue - 0) / 100) * height;

      ctx.strokeStyle = '#EC4899'; // Use custom RSI color
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, rsiY);
      ctx.lineTo(width, rsiY);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }, [data, isDarkMode, width, height, indicatorSettings]);

  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(renderSubplot);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderSubplot]);

  return (
    <canvas
      ref={canvasRef}
      className="trend-fusion-subplot"
    />
  );
});

// Optimized MainChart Component with Canvas rendering
// Removed unused props (selectedTimeRange, customDateRange)
const MainChart = ({ strategy, isDarkMode, indicatorSettings }: {
  strategy: TradingStrategy;
  isDarkMode: boolean;
  indicatorSettings: IndicatorSettings;
}) => {
  // Use refs for frequently updated values to prevent re-renders
  const chartRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef({ startIndex: 0, endIndex: 0, startPrice: 0, endPrice: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastViewportRef = useRef({ startIndex: 0, endIndex: 0, startPrice: 0, endPrice: 0 });
  const containerSizeRef = useRef({ width: 0, height: 0 });

  // State for viewport and UI
  const [viewport, setViewport] = useState({ startIndex: 0, endIndex: 0, startPrice: 0, endPrice: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [latestPrice, setLatestPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [priceChangePercent, setPriceChangePercent] = useState(0);

  // Memoized chart data with better caching
  const chartData = useMemo(() => {
    return strategy.priceData || [];
  }, [strategy.priceData]);

  // Memoized viewport data with intelligent sampling
  const viewportData = useMemo(() => {
    if (chartData.length === 0) {
      return { visibleData: [], startIndex: 0, endIndex: 0, totalPoints: 0 };
    }

    const startIdx = Math.max(0, Math.floor(viewport.startIndex));
    const endIdx = Math.min(chartData.length - 1, Math.ceil(viewport.endIndex));

    return getViewportData(chartData, { startIndex: startIdx, endIndex: endIdx }, 1000);
  }, [chartData, viewport.startIndex, viewport.endIndex]);

  // Initialize viewport when data changes
  useEffect(() => {
    if (chartData.length > 0) {
      const maxPrice = chartData.length > 0 ? Math.max(...chartData.map(p => p.high)) : 0;
      const minPrice = chartData.length > 0 ? Math.min(...chartData.map(p => p.low)) : 0;
      const priceRange = Math.max(maxPrice - minPrice, 0.01);

      const newViewport = {
        startIndex: 0,
        endIndex: chartData.length - 1,
        startPrice: minPrice - priceRange * 0.1,
        endPrice: maxPrice + priceRange * 0.1
      };

      setViewport(newViewport);
      viewportRef.current = newViewport;
    }
  }, [chartData]);

  // Update latest price and change
  useEffect(() => {
    if (chartData.length > 0) {
      const latest = chartData[chartData.length - 1];
      const previous = chartData[chartData.length - 2];

      setLatestPrice(latest.close);
      if (previous) {
        const change = latest.close - previous.close;
        const changePercent = (change / previous.close) * 100;
        setPriceChange(change);
        setPriceChangePercent(changePercent);
      }
    }
  }, [chartData]);

  // Memoized price calculations
  const priceInfo = useMemo(() => {
    if (viewportData.visibleData.length === 0) {
      return { maxPrice: 0, minPrice: 0, priceRange: 0.01 };
    }

    const maxPrice = Math.max(...viewportData.visibleData.map(p => p.high));
    const minPrice = Math.min(...viewportData.visibleData.map(p => p.low));
    const priceRange = Math.max(maxPrice - minPrice, 0.01);

    return { maxPrice, minPrice, priceRange };
  }, [viewportData.visibleData]);

  // Update container size and add wheel event listener
  useEffect(() => {
    const updateSize = () => {
      if (chartRef.current) {
        const rect = chartRef.current.getBoundingClientRect();
        containerSizeRef.current = { width: rect.width, height: rect.height };
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    // Add wheel event listener with proper passive handling
    const chartElement = chartRef.current;
    if (chartElement) {
      const wheelHandler = (e: WheelEvent) => {
        e.preventDefault();

        const rect = chartElement.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomCenterX = mouseX / rect.width;
        const zoomCenterY = mouseY / rect.height;

        const zoomFactor = e.deltaY > 0 ? 1.15 : 0.87;

        const dataRange = viewportRef.current.endIndex - viewportRef.current.startIndex;
        const priceRange = viewportRef.current.endPrice - viewportRef.current.startPrice;

        const newDataRange = dataRange * zoomFactor;
        const newPriceRange = priceRange * zoomFactor;

        const zoomCenterIndex = viewportRef.current.startIndex + zoomCenterX * dataRange;
        const zoomCenterPrice = viewportRef.current.startPrice + (1 - zoomCenterY) * priceRange;

        const newStartIndex = Math.max(0, zoomCenterIndex - zoomCenterX * newDataRange);
        const newEndIndex = Math.min(chartData.length - 1, zoomCenterIndex + (1 - zoomCenterX) * newDataRange);
        const newStartPrice = zoomCenterPrice - (1 - zoomCenterY) * newPriceRange;
        const newEndPrice = zoomCenterPrice + zoomCenterY * newPriceRange;

        const newViewport = {
          startIndex: newStartIndex,
          endIndex: newEndIndex,
          startPrice: newStartPrice,
          endPrice: newEndPrice
        };

        setViewport(newViewport);
        viewportRef.current = newViewport;
      };

      chartElement.addEventListener('wheel', wheelHandler, { passive: false });

      return () => {
        window.removeEventListener('resize', updateSize);
        chartElement.removeEventListener('wheel', wheelHandler);
      };
    }

    return () => window.removeEventListener('resize', updateSize);
  }, [chartData.length]);

  // Touch and mouse event handlers with mobile support
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (chartRef.current) {
      isDraggingRef.current = true;
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      lastViewportRef.current = { ...viewportRef.current };
    }
  }, []);

  const handlePointerMove = useCallback(
    rafThrottle((e: React.PointerEvent) => {
      if (!isDraggingRef.current || !chartRef.current) return;

      e.preventDefault();
      const rect = chartRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      const panXPercent = deltaX / rect.width;
      const panYPercent = deltaY / rect.height;

      const dataRange = viewportRef.current.endIndex - viewportRef.current.startIndex;
      const priceRange = viewportRef.current.endPrice - viewportRef.current.startPrice;

      const newStartIndex = Math.max(0, lastViewportRef.current.startIndex - panXPercent * dataRange);
      const newEndIndex = Math.min(chartData.length - 1, lastViewportRef.current.endIndex - panXPercent * dataRange);
      const newStartPrice = lastViewportRef.current.startPrice + panYPercent * priceRange;
      const newEndPrice = lastViewportRef.current.endPrice + panYPercent * priceRange;

      const newViewport = {
        startIndex: newStartIndex,
        endIndex: newEndIndex,
        startPrice: newStartPrice,
        endPrice: newEndPrice
      };

      setViewport(newViewport);
      viewportRef.current = newViewport;
    }),
    [chartData.length]
  );

  const handlePointerUp = useCallback((e?: React.PointerEvent) => {
    if (e) e.preventDefault();
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  // Touch-specific handlers for mobile with pinch-to-zoom support
  const touchStartRef = useRef<{ x: number; y: number; distance: number } | null>(null);
  const initialViewportRef = useRef<any>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (chartRef.current) {
      if (e.touches.length === 1) {
        // Single touch - pan
        const touch = e.touches[0];
        isDraggingRef.current = true;
        setIsDragging(true);
        dragStartRef.current = { x: touch.clientX, y: touch.clientY };
        lastViewportRef.current = { ...viewportRef.current };
      } else if (e.touches.length === 2) {
        // Two touches - pinch to zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        touchStartRef.current = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
          distance
        };
        initialViewportRef.current = { ...viewportRef.current };
      }
    }
  }, []);

  const handleTouchMove = useCallback(
    rafThrottle((e: React.TouchEvent) => {
      if (!chartRef.current) return;

      e.preventDefault();

      if (e.touches.length === 1 && isDraggingRef.current) {
        // Single touch pan
        const touch = e.touches[0];
        const rect = chartRef.current.getBoundingClientRect();
        const deltaX = touch.clientX - dragStartRef.current.x;
        const deltaY = touch.clientY - dragStartRef.current.y;

        const panXPercent = deltaX / rect.width;
        const panYPercent = deltaY / rect.height;

        const dataRange = viewportRef.current.endIndex - viewportRef.current.startIndex;
        const priceRange = viewportRef.current.endPrice - viewportRef.current.startPrice;

        const newStartIndex = Math.max(0, lastViewportRef.current.startIndex - panXPercent * dataRange);
        const newEndIndex = Math.min(chartData.length - 1, lastViewportRef.current.endIndex - panXPercent * dataRange);
        const newStartPrice = lastViewportRef.current.startPrice + panYPercent * priceRange;
        const newEndPrice = lastViewportRef.current.endPrice + panYPercent * priceRange;

        const newViewport = {
          startIndex: newStartIndex,
          endIndex: newEndIndex,
          startPrice: newStartPrice,
          endPrice: newEndPrice
        };

        setViewport(newViewport);
        viewportRef.current = newViewport;
      } else if (e.touches.length === 2 && touchStartRef.current && initialViewportRef.current) {
        // Two touch pinch-to-zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );

        const scale = currentDistance / touchStartRef.current.distance;
        const zoomFactor = scale > 1 ? 1.1 : 0.9;

        const rect = chartRef.current.getBoundingClientRect();
        const centerX = touchStartRef.current.x - rect.left;
        const centerY = touchStartRef.current.y - rect.top;

        const zoomCenterX = centerX / rect.width;
        const zoomCenterY = centerY / rect.height;

        const dataRange = initialViewportRef.current.endIndex - initialViewportRef.current.startIndex;
        const priceRange = initialViewportRef.current.endPrice - initialViewportRef.current.startPrice;

        const newDataRange = dataRange * zoomFactor;
        const newPriceRange = priceRange * zoomFactor;

        const zoomCenterIndex = initialViewportRef.current.startIndex + zoomCenterX * dataRange;
        const zoomCenterPrice = initialViewportRef.current.startPrice + (1 - zoomCenterY) * priceRange;

        const newStartIndex = Math.max(0, zoomCenterIndex - zoomCenterX * newDataRange);
        const newEndIndex = Math.min(chartData.length - 1, zoomCenterIndex + (1 - zoomCenterX) * newDataRange);
        const newStartPrice = zoomCenterPrice - (1 - zoomCenterY) * newPriceRange;
        const newEndPrice = zoomCenterPrice + zoomCenterY * newPriceRange;

        const newViewport = {
          startIndex: newStartIndex,
          endIndex: newEndIndex,
          startPrice: newStartPrice,
          endPrice: newEndPrice
        };

        setViewport(newViewport);
        viewportRef.current = newViewport;
      }
    }),
    [chartData.length]
  );

  const handleTouchEnd = useCallback((e?: React.TouchEvent) => {
    if (e) e.preventDefault();
    isDraggingRef.current = false;
    setIsDragging(false);
    touchStartRef.current = null;
    initialViewportRef.current = null;
  }, []);

  // Optimized zoom controls
  const zoomIn = useCallback(() => {
    const currentViewport = viewportRef.current;
    const dataRange = currentViewport.endIndex - currentViewport.startIndex;
    const priceRange = currentViewport.endPrice - currentViewport.startPrice;
    const centerIndex = (currentViewport.startIndex + currentViewport.endIndex) / 2;
    const centerPrice = (currentViewport.startPrice + currentViewport.endPrice) / 2;

    const newDataRange = dataRange * 0.8;
    const newPriceRange = priceRange * 0.8;

    const newViewport = {
      startIndex: Math.max(0, centerIndex - newDataRange / 2),
      endIndex: Math.min(chartData.length - 1, centerIndex + newDataRange / 2),
      startPrice: centerPrice - newPriceRange / 2,
      endPrice: centerPrice + newPriceRange / 2
    };

    setViewport(newViewport);
    viewportRef.current = newViewport;
  }, [chartData.length]);

  const zoomOut = useCallback(() => {
    const currentViewport = viewportRef.current;
    const dataRange = currentViewport.endIndex - currentViewport.startIndex;
    const priceRange = currentViewport.endPrice - currentViewport.startPrice;
    const centerIndex = (currentViewport.startIndex + currentViewport.endIndex) / 2;
    const centerPrice = (currentViewport.startPrice + currentViewport.endPrice) / 2;

    const newDataRange = dataRange * 1.25;
    const newPriceRange = priceRange * 1.25;

    const newViewport = {
      startIndex: Math.max(0, centerIndex - newDataRange / 2),
      endIndex: Math.min(chartData.length - 1, centerIndex + newDataRange / 2),
      startPrice: centerPrice - newPriceRange / 2,
      endPrice: centerPrice + newPriceRange / 2
    };

    setViewport(newViewport);
    viewportRef.current = newViewport;
  }, [chartData.length]);

  const resetZoom = useCallback(() => {
    if (chartData.length > 0) {
      const maxPrice = chartData.length > 0 ? Math.max(...chartData.map(p => p.high)) : 0;
      const minPrice = chartData.length > 0 ? Math.min(...chartData.map(p => p.low)) : 0;
      const priceRange = Math.max(maxPrice - minPrice, 0.01);

      const newViewport = {
        startIndex: 0,
        endIndex: chartData.length - 1,
        startPrice: minPrice - priceRange * 0.1,
        endPrice: maxPrice + priceRange * 0.1
      };

      setViewport(newViewport);
      viewportRef.current = newViewport;
    }
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <div className="text-lg font-medium mb-2">No data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col h-full">
        {/* Chart Container */}
        <div
          ref={chartRef}
          className={`h-full ${isDarkMode ? 'bg-gray-900' : ''} relative overflow-hidden select-none chart-container ${isDragging ? 'chart-dragging' : 'chart-grab'} chart-container-touch-none`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDragStart={(e) => e.preventDefault()}
        >

          {/* Zoom Controls */}
          <div className="absolute top-4 left-4 z-20 flex flex-col space-y-2">
            <button
              onClick={zoomIn}
              className={`p-2 rounded-lg shadow-lg transition-all duration-200 hover:scale-105 ${isDarkMode
                ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                } border`}
              title="Zoom In"
            >
              <FiZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={zoomOut}
              className={`p-2 rounded-lg shadow-lg transition-all duration-200 hover:scale-105 ${isDarkMode
                ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                } border`}
              title="Zoom Out"
            >
              <FiZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetZoom}
              className={`p-2 rounded-lg shadow-lg transition-all duration-200 hover:scale-105 ${isDarkMode
                ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                } border`}
              title="Reset Zoom"
            >
              <FiRotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Price Display Overlay - Connected to Price Line */}
          {(() => {
            const currentPrice = viewportData.visibleData.length > 0 ? viewportData.visibleData[viewportData.visibleData.length - 1].close : latestPrice;
            const pricePosition = Math.max(2, Math.min(98, Math.round(100 - ((currentPrice - priceInfo.minPrice) / priceInfo.priceRange) * 100)));

            return (
              <div
                className={`price-display-dynamic price-display-positioned price-display-top-${pricePosition}`}
              >
                <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-600' : 'bg-white/90 border-gray-200'} border rounded px-1.5 py-0.5 shadow-sm flex items-center`}>
                  <div className={`flex flex-col items-end space-y-0 mr-2`}>
                    <div className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      ${currentPrice.toFixed(2)}
                    </div>
                    <div className={`flex items-center space-x-1 text-xs font-medium ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      <span>{priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}</span>
                      <span>({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)</span>
                    </div>
                  </div>
                  {/* Price line connector */}
                  <div
                    className={`price-line-connector ${isDarkMode ? 'bg-green-400' : 'bg-green-500'}`}
                  ></div>
                </div>
              </div>
            );
          })()}

          {/* Canvas-based Chart */}
          <div className="absolute left-0 right-16 top-0 bottom-6 flex flex-col">
            {/* Main Price Chart */}
            <div className="flex-1 relative">
              <CanvasChart
                data={viewportData.visibleData}
                viewport={viewport}
                priceInfo={priceInfo}
                isDarkMode={isDarkMode}
                width={containerSizeRef.current.width - 64}
                height={(containerSizeRef.current.height - 24) * 0.7}
                indicatorSettings={indicatorSettings}
              />
            </div>

            {/* Trend Fusion Subplot */}
            <div className="h-32 relative">
              <TrendFusionSubplot
                data={viewportData.visibleData}
                isDarkMode={isDarkMode}
                width={containerSizeRef.current.width - 64}
                height={128}
                indicatorSettings={indicatorSettings}
              />
            </div>
          </div>

          {/* Price Axis Labels */}
          <div className="absolute right-2 top-0 bottom-0 w-16 flex flex-col justify-between text-xs pointer-events-none">
            {Array.from({ length: 6 }, (_, i) => {
              const price = priceInfo.maxPrice - (priceInfo.priceRange * i / 5);
              return (
                <div key={i} className={`${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                  {price.toFixed(2)}
                </div>
              );
            })}
          </div>

          {/* Time Axis Labels */}
          <div className="absolute bottom-0 left-0 right-16 h-6 flex justify-between text-xs px-2 pointer-events-none">
            {Array.from({ length: 6 }, (_, i) => {
              const index = Math.floor((viewportData.visibleData.length - 1) * i / 5);
              const candle = viewportData.visibleData[index];
              if (!candle || !candle.timestamp) return <div key={i}></div>;
              return (
                <div key={i} className={`${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                  {format(candle.timestamp, 'HH:mm')}
                </div>
              );
            })}
          </div>

          {/* Timezone Indicator */}
          <div className="absolute bottom-6 left-2 text-xs opacity-60 pointer-events-none">
            <span className={`${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
              UTC
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Trading Dashboard
export default function TradingDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [strategy, setStrategy] = useState<TradingStrategy>({
    priceData: [],
    signal: {
      type: 'NEUTRAL',
      timestamp: new Date(),
      price: 0
    }
  });
  const [selectedTimeRange, setSelectedTimeRange] = useState('1D');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [showIndicatorSettings, setShowIndicatorSettings] = useState(false);
  const [indicatorSettings, setIndicatorSettings] = useState<IndicatorSettings>(defaultIndicatorSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [dataDateRange, setDataDateRange] = useState<{ from: Date; to: Date } | null>(null);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Get available date range from full data (not filtered by time range)
  useEffect(() => {
    const loadFullDataRange = async () => {
      const fullRange = await getFullDataRange();
      if (fullRange) {
        setDataDateRange(fullRange);
      }
    };

    loadFullDataRange();
  }, []); // Only run once on component mount

  // Handle time range changes with loading state
  const handleTimeRangeChange = useCallback(async (newTimeRange: string) => {
    setIsLoading(true);
    setSelectedTimeRange(newTimeRange); // Update immediately to show correct loading message
    try {
      const newStrategy = await getTradingDataForRange(newTimeRange);
      // Add a small delay to ensure loading state is visible
      await new Promise(resolve => setTimeout(resolve, 300));
      setStrategy(newStrategy);
    } catch (error) {
      console.error('Failed to load data for time range:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Progress monitoring effect
  useEffect(() => {
    const checkProgress = () => {
      const { loadProgress: progress } = getLoadingState();
      setLoadProgress(progress);
    };

    const interval = setInterval(checkProgress, 100);
    return () => clearInterval(interval);
  }, []);

  // Initial loading effect
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      setLoadProgress(0);
      try {
        console.log('Loading default trading data (1D)...');
        const initialStrategy = await getTradingDataForRange('1D');
        setStrategy(initialStrategy);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      } finally {
        setIsLoading(false);
        setLoadProgress(0);
      }
    };

    initializeData();
  }, []);

  return (
    <div className={`h-screen flex flex-col trading-dashboard ${isDarkMode ? 'bg-gray-900 text-white' : 'light-mode-enhanced'}`}>
      {/* Header */}
      <header className={`border-b px-4 sm:px-6 py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'header-enhanced'}`}>
        <div className="flex items-center space-x-2 mb-2 sm:mb-0">
          <GiGoldBar className={`w-5 h-5 sm:w-6 sm:h-6 ${isDarkMode ? 'text-gray-400' : 'text-slate-700'}`} />
          <h2 className={`text-sm sm:text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Gold Spot / U.S. Dollar • 1m • OANDA</h2>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-600'} hidden sm:block`}>
            Data: File-based
          </div>
          <button
            type='button'
            onClick={() => setShowIndicatorSettings(true)}
            className={`p-2 sm:p-2 rounded-lg transition-all duration-200 hover:scale-105 border btn-optimized ${isDarkMode
              ? 'bg-gray-700 border-gray-500 hover:bg-gray-600'
              : 'button-enhanced'
              }`}
            title="Indicator Settings"
          >
            <FiSettings className={`w-4 h-4 sm:w-5 sm:h-5 ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`} />
          </button>
          <button
            type='button'
            onClick={toggleTheme}
            className={`p-2 sm:p-2 rounded-lg transition-all duration-200 hover:scale-105 border btn-optimized ${isDarkMode
              ? 'bg-gray-700 border-gray-500 hover:bg-gray-600'
              : 'button-enhanced'
              }`}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <FiMoon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300" />
            ) : (
              <FiSun className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-hidden relative min-h-0">
        {isLoading ? (
          <div className={`absolute inset-0 flex items-center justify-center bg-opacity-75 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
            <div className="flex flex-col items-center space-y-3">
              <LoadingSpinner size="lg" isDarkMode={isDarkMode} />
              <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                Loading {selectedTimeRange} data...
              </div>
              {loadProgress > 0 && (
                <div className="w-64 bg-gray-200 rounded-full h-2">
                  <div
                    className={`bg-blue-600 h-2 rounded-full progress-width-${Math.round(loadProgress)}`}
                  ></div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative h-full">
            {/* MainChart component - customDateRange prop removed as it was unused */}
            <MainChart
              strategy={strategy}
              isDarkMode={isDarkMode}
              indicatorSettings={indicatorSettings}
            />
          </div>
        )}
      </main>

      {/* Secondary Footer - Trading Logic Displays */}
      <footer className={`px-6 py-3 ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'footer-enhanced'}`}>
        <div className="flex justify-between items-center">
          {/* Detailed Indicator Status */}
          <div className="flex items-center space-x-4">
            {(() => {
              const minDataPoints = Math.max(indicatorSettings.sslChannel.maPeriod, indicatorSettings.sslChannel.maPeriod);
              if (strategy.priceData.length < minDataPoints) {
                return (
                  <div className="flex items-center space-x-4 text-xs">
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Need at least {minDataPoints} data points for analysis
                    </div>
                  </div>
                );
              }

              const sslResult = calculateSSLChannel(strategy.priceData, false, {
                maPeriod: indicatorSettings.sslChannel.maPeriod,
                maType: indicatorSettings.sslChannel.maType,
              });
              const trendResult = calculateTrendFusion(strategy.priceData, {
                shortEMAPeriod: indicatorSettings.trendFusion.shortEMAPeriod,
                longEMAPeriod: indicatorSettings.trendFusion.longEMAPeriod,
                rsiPeriod: indicatorSettings.trendFusion.rsiPeriod,
                topLevel: indicatorSettings.trendFusion.topLevel,
                bottomLevel: indicatorSettings.trendFusion.bottomLevel,
              });

              return (
                <div className="flex items-center space-x-4 text-xs">
                  <div className={`indicator-badge ${sslResult.signal === 'BUY'
                    ? isDarkMode ? 'indicator-badge-buy' : 'indicator-badge-buy-enhanced'
                    : sslResult.signal === 'SELL'
                      ? isDarkMode ? 'indicator-badge-sell' : 'indicator-badge-sell-enhanced'
                      : isDarkMode
                        ? 'indicator-badge-dark'
                        : 'indicator-badge-enhanced'
                    }`}>
                    <span className="indicator-dot-ssl">●</span> SSL: {sslResult.signal}
                  </div>
                  <div className={`indicator-badge ${trendResult.trendDirection === 'GREEN'
                    ? isDarkMode ? 'indicator-badge-buy' : 'indicator-badge-buy-enhanced'
                    : trendResult.trendDirection === 'RED'
                      ? isDarkMode ? 'indicator-badge-sell' : 'indicator-badge-sell-enhanced'
                      : isDarkMode
                        ? 'indicator-badge-dark'
                        : 'indicator-badge-enhanced'
                    }`}>
                    <span className="indicator-dot-trend">●</span> Trend Fusion: {trendResult.trendDirection} (RSI: {trendResult.rsiValue.toFixed(1)})
                  </div>
                  <div className={`indicator-badge ${sslResult.signal === 'BUY' && trendResult.trendDirection === 'GREEN'
                    ? isDarkMode ? 'indicator-badge-buy' : 'indicator-badge-buy-enhanced'
                    : sslResult.signal === 'SELL' && trendResult.trendDirection === 'RED'
                      ? isDarkMode ? 'indicator-badge-sell' : 'indicator-badge-sell-enhanced'
                      : isDarkMode
                        ? 'indicator-badge-dark'
                        : 'indicator-badge-enhanced'
                    }`}>
                    Combined: {sslResult.signal === 'BUY' && trendResult.trendDirection === 'GREEN'
                      ? 'BUY'
                      : sslResult.signal === 'SELL' && trendResult.trendDirection === 'RED'
                        ? 'SELL'
                        : 'NEUTRAL'}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Trading Signal Indicator */}
          <div className="flex items-center space-x-4">
            {(() => {
              const minDataPoints = Math.max(indicatorSettings.sslChannel.maPeriod, indicatorSettings.sslChannel.maPeriod);
              if (strategy.priceData.length < minDataPoints) {
                return (
                  <div className="flex items-center space-x-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold trading-indicator ${isDarkMode ? 'trading-indicator-dark' : 'trading-indicator-enhanced'}`}>
                      INSUFFICIENT DATA
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-600'} font-medium`}>
                      {strategy.priceData.length} / {minDataPoints} points
                    </div>
                  </div>
                );
              }

              const sslResult = calculateSSLChannel(strategy.priceData, false, {
                maPeriod: indicatorSettings.sslChannel.maPeriod,
                maType: indicatorSettings.sslChannel.maType,
              });
              const trendResult = calculateTrendFusion(strategy.priceData, {
                shortEMAPeriod: indicatorSettings.trendFusion.shortEMAPeriod,
                longEMAPeriod: indicatorSettings.trendFusion.longEMAPeriod,
                rsiPeriod: indicatorSettings.trendFusion.rsiPeriod,
                topLevel: indicatorSettings.trendFusion.topLevel,
                bottomLevel: indicatorSettings.trendFusion.bottomLevel,
              });

              const isBuySignal = sslResult.signal === 'BUY' && trendResult.trendDirection === 'GREEN';
              const isSellSignal = sslResult.signal === 'SELL' && trendResult.trendDirection === 'RED';

              return (
                <div className="flex items-center space-x-2">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold trading-indicator ${isBuySignal
                    ? isDarkMode ? 'trading-indicator-buy signal-indicator signal-indicator-buy' : 'trading-indicator-buy-enhanced signal-indicator signal-indicator-buy'
                    : isSellSignal
                      ? isDarkMode ? 'trading-indicator-sell signal-indicator signal-indicator-sell' : 'trading-indicator-sell-enhanced signal-indicator signal-indicator-sell'
                      : isDarkMode
                        ? 'trading-indicator-dark'
                        : 'trading-indicator-enhanced'
                    }`}>
                    {isBuySignal ? 'BUY SIGNAL' : isSellSignal ? 'SELL SIGNAL' : 'NEUTRAL'}
                  </div>
                  {isBuySignal && (
                    <div className="text-xs text-green-500 font-medium">
                      ✓ SSL BUY + Trend GREEN
                    </div>
                  )}
                  {isSellSignal && (
                    <div className="text-xs text-red-500 font-medium">
                      ✓ SSL SELL + Trend RED
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </footer>

      {/* Time Range Footer */}
      <footer className={`border-t px-4 sm:px-6 py-2 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'footer-enhanced'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
          {/* Time Range Selection */}
          <div className="flex flex-wrap items-center gap-1">
            <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-slate-700'} mr-2`}>
              Time Range:
            </span>
            <div className="flex flex-wrap gap-1">
              {[
                { key: '1H', title: '1 Hour' },
                { key: '1D', title: '1 Day' },
                { key: '5D', title: '5 Days' },
                { key: '1M', title: '1 Month' },
                { key: '3M', title: '3 Months' },
                { key: '6M', title: '6 Months' },
                { key: 'YTD', title: 'Year to Date' },
                { key: '1Y', title: '1 Year' },
                { key: '5Y', title: '5 Years' },
                { key: '10Y', title: '10 Years' },
                { key: 'All', title: 'All Data' }
              ].map(({ key, title }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTimeRangeChange(key)}
                  disabled={isLoading}
                  title={title}
                  className={`px-2 sm:px-3 py-1 text-xs font-medium rounded transition-all duration-200 flex items-center space-x-1 btn-optimized ${isLoading
                    ? isDarkMode
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-75'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-75'
                    : key === selectedTimeRange
                      ? isDarkMode
                        ? 'bg-gray-700 text-gray-300 border border-gray-500 shadow-md'
                        : 'button-selected'
                      : isDarkMode
                        ? 'text-gray-300 hover:text-white hover:bg-gray-700 hover:shadow-sm'
                        : 'button-enhanced'
                    }`}
                >
                  <span>{key}</span>
                </button>
              ))}

              {/* Separator */}
              <div className={`w-px h-4 mx-1 ${isDarkMode ? 'bg-gray-600' : 'bg-slate-300'}`}></div>

              {/* Custom Date Range Icon */}
              <button
                type="button"
                onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
                className={`p-1 rounded transition-colors btn-optimized ${selectedTimeRange === 'CUSTOM'
                  ? isDarkMode
                    ? 'bg-gray-700 text-gray-300 border border-gray-500'
                    : 'button-selected'
                  : isDarkMode
                    ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                    : 'button-enhanced'
                  }`}
                title="Custom Date Range"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  <path d="M4 8a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1V8z" />
                  <path d="M7 12a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" />
                </svg>
              </button>
            </div>

            {/* Custom Date Range Picker */}
            {showCustomDatePicker && (
              <div
                className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-200`}
                onClick={() => setShowCustomDatePicker(false)}
              >
                <div
                  className={`relative p-6 rounded-lg shadow-xl border max-w-4xl w-full mx-4 ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-slate-300'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setShowCustomDatePicker(false)}
                    className={`absolute top-2 right-2 p-1 rounded-full hover:bg-opacity-80 transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'}`}
                    aria-label="Close date picker"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <div className="flex flex-col space-y-4">
                    <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>
                      Custom Date Range
                    </h3>

                    <div className="flex flex-col space-y-4">
                      <div className="flex flex-col space-y-2">
                        <label className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                          Select Date Range:
                        </label>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-600'} mb-2`}>
                          Note: Today's date (highlighted in blue) is based on UTC timezone to match the trading data.
                          Only dates with available trading data are selectable.
                        </div>
                        {dataDateRange && (
                          <div className={`text-xs ${isDarkMode ? 'text-blue-300' : 'text-blue-600'} mb-2 font-medium`}>
                            📅 Available data: {format(dataDateRange.from, 'MMM dd, yyyy')} - {format(dataDateRange.to, 'MMM dd, yyyy')}
                          </div>
                        )}
                        <div className={`p-3 rounded border ${isDarkMode ? 'bg-gray-700 border-gray-500' : 'bg-slate-50 border-slate-200'}`}>
                          <DayPicker
                            mode="range"
                            selected={customDateRange}
                            onSelect={setCustomDateRange}
                            numberOfMonths={2}
                            className={`${isDarkMode ? 'rdp-dark' : ''}`}
                            disabled={[
                              // Disable dates outside the available data range
                              ...(dataDateRange ? [
                                { before: dataDateRange.from },
                                { after: dataDateRange.to }
                              ] : []),
                              // Also disable future dates (after today) - using UTC to match trading data
                              {
                                after: (() => {
                                  const today = new Date();
                                  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
                                })()
                              }
                            ]}
                            modifiers={{
                              range_start: customDateRange?.from,
                              range_end: customDateRange?.to,
                              in_range: (date) => {
                                if (!customDateRange?.from || !customDateRange?.to) return false;
                                return isWithinInterval(date, {
                                  start: customDateRange.from,
                                  end: customDateRange.to
                                });
                              },
                              // Custom today modifier using UTC
                              today: (date) => {
                                const today = new Date();
                                const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
                                const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
                                return utcDate.getTime() === utcToday.getTime();
                              }
                            }}
                            modifiersStyles={{
                              range_start: {
                                backgroundColor: isDarkMode ? '#6B7280' : '#9CA3AF',
                                color: isDarkMode ? '#E5E7EB' : '#374151',
                                borderRadius: '50%'
                              },
                              range_end: {
                                backgroundColor: isDarkMode ? '#6B7280' : '#9CA3AF',
                                color: isDarkMode ? '#E5E7EB' : '#374151',
                                borderRadius: '50%'
                              },
                              in_range: {
                                backgroundColor: isDarkMode ? '#4B5563' : '#E5E7EB',
                                color: isDarkMode ? '#D1D5DB' : '#6B7280'
                              },
                              today: {
                                backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB',
                                color: '#FFFFFF',
                                fontWeight: 'bold',
                                borderRadius: '50%',
                                boxShadow: isDarkMode
                                  ? '0 0 0 2px rgba(59, 130, 246, 0.3)'
                                  : '0 0 0 2px rgba(37, 99, 235, 0.3)'
                              }
                            }}
                            classNames={{
                              months: 'flex space-x-4 justify-center',
                              month: 'space-y-4 min-w-[280px]',
                              caption: 'flex justify-center pt-1 relative items-center',
                              caption_label: 'text-sm font-medium',
                              nav: 'space-x-1 flex items-center',
                              nav_button: 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
                              nav_button_previous: 'absolute left-1',
                              nav_button_next: 'absolute right-1',
                              table: 'w-full border-collapse space-y-1',
                              head_row: 'flex',
                              head_cell: 'text-gray-500 rounded-md w-8 font-normal text-xs',
                              row: 'flex w-full mt-2',
                              cell: 'text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
                              day: isDarkMode ? 'h-8 w-8 p-0 font-normal rounded-full hover:bg-gray-400 hover:text-gray-900' : 'h-8 w-8 p-0 font-normal rounded-full hover:bg-slate-200 hover:text-slate-900',
                              day_selected: isDarkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500 focus:bg-gray-500' : 'bg-blue-500 text-white hover:bg-blue-600 focus:bg-blue-600',
                              day_today: '', // We're using custom today modifier instead
                              day_outside: 'text-gray-400 opacity-50',
                              day_disabled: 'text-gray-400 opacity-50',
                              day_hidden: 'invisible',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      {customDateRange?.from && customDateRange?.to && (
                        <div className="text-sm">
                          {format(customDateRange.from, 'MMM dd, yyyy')} - {format(customDateRange.to, 'MMM dd, yyyy')}
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (customDateRange?.from && customDateRange?.to) {
                              setIsLoading(true);
                              setSelectedTimeRange('CUSTOM'); // Update immediately to show correct loading message
                              try {
                                const newStrategy = await getTradingDataForRange('CUSTOM');
                                // Add a small delay to ensure loading state is visible
                                await new Promise(resolve => setTimeout(resolve, 300));
                                setStrategy(newStrategy);
                                setShowCustomDatePicker(false);
                              } catch (error) {
                                console.error('Failed to load custom date range data:', error);
                              } finally {
                                setIsLoading(false);
                              }
                            }
                          }}
                          disabled={!customDateRange?.from || !customDateRange?.to}
                          className={`px-4 py-2 text-sm font-medium rounded transition-colors border btn-optimized ${customDateRange?.from && customDateRange?.to
                            ? isDarkMode
                              ? 'bg-gray-700 border-gray-500 text-gray-300 hover:bg-gray-600'
                              : 'button-selected'
                            : isDarkMode
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50 border-gray-500'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50 border-gray-200'
                            }`}
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCustomDatePicker(false)}
                          className={`px-4 py-2 text-sm font-medium rounded transition-colors btn-optimized ${isDarkMode
                            ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            : 'button-enhanced'
                            }`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* UTC Display */}
          <div className="flex justify-center items-center">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
              UTC: {new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'UTC'
              })}
            </span>
          </div>
        </div>
      </footer>

      {/* Indicator Settings Modal */}
      <IndicatorSettingsModal
        isOpen={showIndicatorSettings}
        onClose={() => setShowIndicatorSettings(false)}
        settings={indicatorSettings}
        onSettingsChange={setIndicatorSettings}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}