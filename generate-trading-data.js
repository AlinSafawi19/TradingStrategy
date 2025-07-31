import fs from 'fs';
import path from 'path';

// Gold trading data generator
// Generates realistic gold price data with proper market hours and volatility

class GoldDataGenerator {
  constructor() {
    this.basePrice = 2000; // Starting gold price in USD
    this.volatility = 0.015; // Daily volatility ~1.5%
    this.trendStrength = 0.0001; // Slight upward trend
    this.marketHours = {
      london: { start: 8, end: 16 }, // GMT
      newYork: { start: 13, end: 21 }, // GMT
      tokyo: { start: 0, end: 8 } // GMT
    };
  }

  // Generate realistic gold price movement
  generatePriceMovement(previousPrice, timestamp, marketActivity) {
    // Skip weekends for more realistic data
    if (this.isWeekend(timestamp)) {
      return previousPrice; // No price change on weekends
    }
    
    // Base random walk
    let change = (Math.random() - 0.5) * this.volatility * previousPrice;
    
    // Add market session volatility
    const hour = timestamp.getUTCHours();
    const marketMultiplier = this.getMarketSessionMultiplier(hour);
    change *= marketMultiplier;
    
    // Add trend component
    const trendChange = this.trendStrength * previousPrice;
    
    // Add some mean reversion
    const meanReversion = (this.basePrice - previousPrice) * 0.0001;
    
    // Add seasonal patterns (gold tends to be stronger in certain months)
    const month = timestamp.getUTCMonth();
    let seasonalFactor = 0;
    if (month >= 8 && month <= 11) { // Sep-Dec (stronger)
      seasonalFactor = 0.0002;
    } else if (month >= 2 && month <= 5) { // Mar-Jun (weaker)
      seasonalFactor = -0.0001;
    }
    
    const totalChange = change + trendChange + meanReversion + (seasonalFactor * previousPrice);
    const newPrice = previousPrice + totalChange;
    
    // Ensure price doesn't go negative
    return Math.max(newPrice, 100);
  }

  // Check if market is active
  isMarketActive(hour) {
    return (hour >= this.marketHours.london.start && hour <= this.marketHours.london.end) ||
           (hour >= this.marketHours.newYork.start && hour <= this.marketHours.newYork.end) ||
           (hour >= this.marketHours.tokyo.start && hour <= this.marketHours.tokyo.end);
  }

  // Get market session multiplier for more realistic volatility
  getMarketSessionMultiplier(hour) {
    // London session (8-16 GMT) - moderate volatility
    if (hour >= this.marketHours.london.start && hour <= this.marketHours.london.end) {
      return 1.3;
    }
    // New York session (13-21 GMT) - highest volatility
    else if (hour >= this.marketHours.newYork.start && hour <= this.marketHours.newYork.end) {
      return 1.8;
    }
    // Tokyo session (0-8 GMT) - moderate volatility
    else if (hour >= this.marketHours.tokyo.start && hour <= this.marketHours.tokyo.end) {
      return 1.2;
    }
    // Off-hours - lower volatility
    else {
      return 0.6;
    }
  }

  // Check if it's a weekend (Saturday = 6, Sunday = 0)
  isWeekend(timestamp) {
    const day = timestamp.getUTCDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  // Generate OHLC data for a single candle
  generateCandle(openPrice, timestamp) {
    // Skip weekends for more realistic data
    if (this.isWeekend(timestamp)) {
      return {
        timestamp: timestamp.toISOString(),
        open: parseFloat(openPrice.toFixed(2)),
        high: parseFloat(openPrice.toFixed(2)),
        low: parseFloat(openPrice.toFixed(2)),
        close: parseFloat(openPrice.toFixed(2))
      };
    }
    
    const hour = timestamp.getUTCHours();
    const marketMultiplier = this.getMarketSessionMultiplier(hour);
    const volatility = this.volatility * marketMultiplier;
    
    // Generate realistic high/low based on open
    const maxMove = openPrice * volatility * 0.5;
    const highMove = (Math.random() - 0.3) * maxMove; // Bias towards high
    const lowMove = (Math.random() - 0.3) * maxMove; // Bias towards low
    
    const high = openPrice + Math.abs(highMove);
    const low = Math.max(openPrice - Math.abs(lowMove), 100);
    
    // Close price with some correlation to open
    const closeBias = Math.random() > 0.5 ? 0.3 : -0.3; // 50/50 chance of up/down
    const closeMove = (Math.random() + closeBias) * maxMove * 0.8;
    const close = Math.max(Math.min(openPrice + closeMove, high), low);
    
    return {
      timestamp: timestamp.toISOString(),
      open: parseFloat(openPrice.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2))
    };
  }

  // Generate data for a specific time period
  generateDataForPeriod(startDate, endDate, intervalMinutes = 1) {
    const data = [];
    let currentPrice = this.basePrice;
    let currentTime = new Date(startDate);
    
    while (currentTime <= endDate) {
      // Generate new price
      currentPrice = this.generatePriceMovement(currentPrice, currentTime);
      
      // Generate OHLC candle
      const candle = this.generateCandle(currentPrice, currentTime);
      data.push(candle);
      
      // Move to next interval (maintain UTC)
      const nextTime = new Date(currentTime.getTime() + intervalMinutes * 60 * 1000);
      currentTime = new Date(Date.UTC(nextTime.getUTCFullYear(), nextTime.getUTCMonth(), nextTime.getUTCDate(), nextTime.getUTCHours(), nextTime.getUTCMinutes(), nextTime.getUTCSeconds()));
    }
    
    return data;
  }

  // Generate high-frequency intraday data for specific periods
  generateIntradayData(startDate, endDate, intervalSeconds = 30) {
    const data = [];
    let currentPrice = this.basePrice;
    let currentTime = new Date(startDate);
    
    while (currentTime <= endDate) {
      // Generate new price with higher frequency
      currentPrice = this.generatePriceMovement(currentPrice, currentTime);
      
      // Generate OHLC candle for intraday data
      const candle = this.generateCandle(currentPrice, currentTime);
      data.push(candle);
      
      // Move to next interval (maintain UTC)
      const nextTime = new Date(currentTime.getTime() + intervalSeconds * 1000);
      currentTime = new Date(Date.UTC(nextTime.getUTCFullYear(), nextTime.getUTCMonth(), nextTime.getUTCDate(), nextTime.getUTCHours(), nextTime.getUTCMinutes(), nextTime.getUTCSeconds()));
    }
    
    return data;
  }

  // Generate a single comprehensive dataset for the app
  generateMainDataset() {
    console.log('Generating main gold trading dataset...');
    
    // Generate 1 year of data with optimized intervals (all in UTC)
    const now = new Date();
    const oneYearAgo = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));
    
    // For performance, we'll generate different intervals based on recency:
    // - 1-minute data for the last 1 month (highest frequency)
    // - 5-minute data for the last 3 months
    // - 15-minute data for the last 6 months
    // - 1-hour data for the rest
    const oneMonthAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));
    const threeMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));
    const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));
    
    let data = [];
    
    // Generate 1-hour data from 1 year ago to 6 months ago
    const historicalData = this.generateDataForPeriod(oneYearAgo, sixMonthsAgo, 60);
    data = data.concat(historicalData);
    
    // Generate 15-minute data for the last 6 months to 3 months ago
    const sixMonthData = this.generateDataForPeriod(sixMonthsAgo, threeMonthsAgo, 15);
    data = data.concat(sixMonthData);
    
    // Generate 5-minute data for the last 3 months to 1 month ago
    const threeMonthData = this.generateDataForPeriod(threeMonthsAgo, oneMonthAgo, 5);
    data = data.concat(threeMonthData);
    
    // Generate 1-minute data for the last 1 month (highest frequency)
    const recentData = this.generateDataForPeriod(oneMonthAgo, now, 1);
    data = data.concat(recentData);
    
    console.log(`Generated main dataset: ${data.length} total candles`);
    console.log(`- Historical (1H intervals): ${historicalData.length} candles`);
    console.log(`- 6-month data (15M intervals): ${sixMonthData.length} candles`);
    console.log(`- 3-month data (5M intervals): ${threeMonthData.length} candles`);
    console.log(`- Recent (1M intervals): ${recentData.length} candles`);
    
    return data;
  }

  // Calculate price range efficiently for large datasets
  calculatePriceRange(data) {
    if (data.length === 0) return { min: 0, max: 0 };
    
    let minPrice = data[0].low;
    let maxPrice = data[0].high;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i].low < minPrice) minPrice = data[i].low;
      if (data[i].high > maxPrice) maxPrice = data[i].high;
    }
    
    return { min: minPrice, max: maxPrice };
  }

  // Save data to file
  saveData(data, filename) {
    const filePath = path.join(process.cwd(), 'public', 'data', filename);
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Data saved to: ${filePath}`);
  }

  // Generate additional high-frequency datasets
  generateHighFrequencyDatasets() {
    console.log('Generating high-frequency datasets...');
    
    const now = new Date();
    const oneWeekAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7, now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));
    const oneDayAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));
    
    // Generate 30-second data for the last week
    const thirtySecondData = this.generateIntradayData(oneWeekAgo, now, 30);
    this.saveData(thirtySecondData, 'trading-data-30s.json');
    
    // Generate 10-second data for the last day
    const tenSecondData = this.generateIntradayData(oneDayAgo, now, 10);
    this.saveData(tenSecondData, 'trading-data-10s.json');
    
    console.log(`Generated high-frequency datasets:`);
    console.log(`- 30-second data: ${thirtySecondData.length} candles`);
    console.log(`- 10-second data: ${tenSecondData.length} candles`);
  }

  // Generate and save all datasets
  generateAllDatasets() {
    console.log('Starting gold trading data generation...\n');
   
    // Generate main dataset for the app
    const mainData = this.generateMainDataset();
    this.saveData(mainData, 'trading-data.json');
    
    // Generate high-frequency datasets
    this.generateHighFrequencyDatasets();
    
    // Calculate price range efficiently
    const priceRange = this.calculatePriceRange(mainData);
    
    console.log('\n✅ Gold trading data generation complete!');
    console.log(`📊 Generated ${mainData.length} data points for main dataset`);
    console.log(`📅 Date range: ${mainData[0]?.timestamp} to ${mainData[mainData.length - 1]?.timestamp}`);
    console.log(`💰 Price range: $${priceRange.min.toFixed(2)} - $${priceRange.max.toFixed(2)}`);
    console.log(`📁 Additional high-frequency datasets saved in public/data/`);
  }
}

// Run the generator
const generator = new GoldDataGenerator();
generator.generateAllDatasets();

export default GoldDataGenerator;
