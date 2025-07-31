# TradingView Dashboard

A modern, high-performance trading dashboard built with React and TypeScript that provides real-time gold price analysis with advanced technical indicators and customizable trading strategies.

## 🚀 Features

### 📊 Advanced Charting
- **Interactive Price Charts**: Real-time gold price visualization with zoom, pan, and time range selection
- **Multiple Timeframes**: Support for different time intervals (1-minute to daily candles)
- **Responsive Design**: Optimized for desktop and mobile viewing
- **Dark/Light Theme**: Toggle between dark and light modes for comfortable viewing

### 📈 Technical Indicators
- **SSL Channel Indicator**: Customizable moving average-based trend detection
  - Configurable MA period (default: 200)
  - Support for SMA and EMA calculations
  - Visual buy/sell signals
- **Trend Fusion Indicator**: Multi-timeframe momentum analysis
  - Short and long EMA crossover signals
  - RSI momentum confirmation
  - Customizable overbought/oversold levels

### ⚡ Performance Optimizations
- **Virtual Scrolling**: Efficient rendering of large datasets
- **Web Workers**: Background data processing for smooth UI
- **Memory Management**: Optimized data caching and cleanup
- **RAF Throttling**: Smooth animations and interactions

### 🎛️ Customization
- **Indicator Settings**: Adjustable parameters for all technical indicators
- **Time Range Selection**: Flexible date picker for historical analysis
- **Real-time Updates**: Live data streaming with progress indicators

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, PostCSS
- **Icons**: React Icons
- **Date Handling**: date-fns, react-day-picker
- **Build Tool**: Vite with React plugin
- **Linting**: ESLint with TypeScript support

## 📦 Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TradingView
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Generate trading data** (optional)
   ```bash
   npm run generate-data
   ```
   This creates realistic gold trading data in the `public/data/` directory.

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173` to view the dashboard.

## 🚀 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run generate-data` - Generate sample trading data

## 📁 Project Structure

```
TradingView/
├── public/
│   └── data/                 # Trading data files
│       ├── trading-data.json
│       ├── trading-data-10s.json
│       └── trading-data-30s.json
├── src/
│   ├── App.tsx              # Main application component
│   ├── tradingData.ts       # Data management and loading
│   ├── strategyLogic.ts     # Technical indicator calculations
│   ├── performanceUtils.ts  # Performance optimization utilities
│   └── workers/             # Web worker implementations
│       ├── dataProcessor.worker.ts
│       └── workerManager.ts
├── generate-trading-data.js # Data generation script
└── package.json
```

## 📊 Data Generation

The project includes a sophisticated data generator that creates realistic gold trading data:

### Features
- **Realistic Price Movement**: Based on actual market volatility patterns
- **Market Hours Simulation**: Different volatility during London, New York, and Tokyo sessions
- **Seasonal Patterns**: Gold price tendencies throughout the year
- **Weekend Handling**: Proper weekend data with no price changes

### Usage
```bash
npm run generate-data
```

This generates three datasets:
- `trading-data.json` - Main dataset (1-minute intervals)
- `trading-data-10s.json` - High-frequency data (10-second intervals)
- `trading-data-30s.json` - Medium-frequency data (30-second intervals)

## 🎯 Technical Indicators

### SSL Channel Indicator
The SSL (Schaffman Support/Resistance) Channel is a trend-following indicator that identifies support and resistance levels.

**Parameters:**
- `maPeriod`: Moving average period (default: 200)
- `maType`: Moving average type - 'SMA' or 'EMA' (default: 'SMA')

**Signals:**
- **Buy Signal**: Price above SSL Up line
- **Sell Signal**: Price below SSL Down line

### Trend Fusion Indicator
A multi-timeframe momentum indicator combining EMA crossovers with RSI confirmation.

**Parameters:**
- `shortEMAPeriod`: Short EMA period (default: 14)
- `longEMAPeriod`: Long EMA period (default: 50)
- `rsiPeriod`: RSI calculation period (default: 14)
- `topLevel`: RSI overbought level (default: 60)
- `bottomLevel`: RSI oversold level (default: 40)

**Signals:**
- **Bullish**: Short EMA > Long EMA + RSI > 50
- **Bearish**: Short EMA < Long EMA + RSI < 50

## 🔧 Configuration

### Indicator Settings
Access indicator settings through the settings modal (gear icon):
- Adjust moving average periods
- Change indicator types (SMA/EMA)
- Modify RSI levels
- Customize signal thresholds

### Theme Customization
Toggle between dark and light themes using the theme button in the top-right corner.

## 🚀 Performance Features

### Virtual Scrolling
- Efficient rendering of large datasets
- Smooth scrolling performance
- Memory-optimized data handling

### Web Workers
- Background data processing
- Non-blocking UI updates
- Parallel computation for indicators

### Caching Strategy
- Intelligent data caching
- Lazy loading of historical data
- Memory cleanup for optimal performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation in the code comments
- Review the TypeScript interfaces for API usage

## 🔮 Future Enhancements

- [ ] Additional technical indicators
- [ ] Real-time data streaming
- [ ] Portfolio management features
- [ ] Advanced backtesting capabilities
- [ ] Mobile app version
- [ ] Social trading features

---

**Built with ❤️ using React, TypeScript, and modern web technologies**
