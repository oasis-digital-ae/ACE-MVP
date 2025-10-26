/**
 * Market Service - Market cap and share price calculations
 */

import { logger } from '../logger';

export interface MarketData {
  marketCap: number;
  sharesOutstanding: number;
  sharePrice: number;
  launchPrice: number;
}

export const marketService = {
  /**
   * Calculate current share price (NAV)
   */
  calculateSharePrice(marketCap: number, sharesOutstanding: number, defaultValue: number = 20.00): number {
    if (sharesOutstanding <= 0) {
      return defaultValue;
    }
    
    return marketCap / sharesOutstanding;
  },

  /**
   * Calculate profit/loss
   */
  calculateProfitLoss(currentPrice: number, purchasePrice: number): number {
    return currentPrice - purchasePrice;
  },

  /**
   * Calculate percent change
   */
  calculatePercentChange(currentPrice: number, purchasePrice: number): number {
    if (purchasePrice <= 0) return 0;
    return ((currentPrice - purchasePrice) / purchasePrice) * 100;
  },

  /**
   * Get full market data for a team
   */
  getMarketData(
    marketCap: number,
    sharesOutstanding: number,
    launchPrice: number
  ): MarketData {
    const sharePrice = this.calculateSharePrice(marketCap, sharesOutstanding, launchPrice);
    
    return {
      marketCap,
      sharesOutstanding,
      sharePrice,
      launchPrice,
    };
  },

  /**
   * Calculate total value of shares
   */
  calculateTotalValue(sharePrice: number, quantity: number): number {
    return sharePrice * quantity;
  },

  /**
   * Calculate average cost basis
   */
  calculateAverageCost(totalInvested: number, quantity: number): number {
    if (quantity <= 0) return 0;
    return totalInvested / quantity;
  },

  /**
   * Validate share purchase
   */
  validateSharePurchase(units: number, pricePerShare: number, maxShares: number = 10000): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (units <= 0) {
      errors.push('Number of shares must be greater than 0');
    }

    if (units > maxShares) {
      errors.push(`Number of shares cannot exceed ${maxShares.toLocaleString()}`);
    }

    if (pricePerShare <= 0) {
      errors.push('Share price must be greater than 0');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Format share price for display
   */
  formatSharePrice(price: number): string {
    return `$${price.toFixed(2)}`;
  },

  /**
   * Format market cap for display
   */
  formatMarketCap(marketCap: number): string {
    if (marketCap >= 1_000_000) {
      return `$${(marketCap / 1_000_000).toFixed(2)}M`;
    }
    return `$${marketCap.toLocaleString()}`;
  },
};
