// Market cap value object
import { Money, type Currency } from './Money';

export class MarketCap extends Money {
  constructor(amount: number, currency: Currency = 'USD') {
    super(amount, currency);
    if (amount < 0) {
      throw new Error('Market cap cannot be negative');
    }
  }

  calculateSharePrice(totalShares: number): number {
    if (totalShares <= 0) {
      throw new Error('Total shares must be greater than zero');
    }
    return this.amount / totalShares;
  }

  calculatePercentChange(from: MarketCap): number {
    if (this.currency !== from.currency) {
      throw new Error('Cannot compare market caps with different currencies');
    }
    if (from.amount === 0) return 0;
    return ((this.amount - from.amount) / from.amount) * 100;
  }
}
