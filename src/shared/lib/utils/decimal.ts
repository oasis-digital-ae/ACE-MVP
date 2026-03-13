/**
 * Decimal Utilities Wrapper
 * 
 * Provides a centralized interface for working with Decimal.js for monetary calculations.
 * All monetary values should use Decimal internally to avoid floating-point errors.
 * 
 * Pattern:
 * - Internal calculations: Use Decimal for precision
 * - Display: Round to 2 decimal places only at display/formatter level
 * - Database: Store as BIGINT (cents) - use toCents() before sending, fromCents() after receiving
 */

import Decimal from 'decimal.js';

// Configure Decimal defaults for monetary calculations
// Use high precision internally, round to 2 decimal places for display (matching backend)
Decimal.set({
  precision: 28, // High precision for calculations
  rounding: Decimal.ROUND_HALF_UP, // Standard rounding (0.5 rounds up)
  toExpNeg: -7,
  toExpPos: 21,
  maxE: 9e15,
  minE: -9e15,
  modulo: Decimal.ROUND_HALF_UP,
  crypto: false
});

/**
 * Convert a value to Decimal
 * Handles various input types: number, string, Decimal, null, undefined
 * 
 * @param value - Value to convert (number, string, Decimal, null, undefined)
 * @param defaultValue - Default value if input is null/undefined (default: 0)
 * @returns Decimal instance
 */
export function toDecimal(value: number | string | Decimal | null | undefined, defaultValue: number | Decimal = 0): Decimal {
  if (value === null || value === undefined) {
    return new Decimal(defaultValue);
  }
  
  if (value instanceof Decimal) {
    return value;
  }
  
  try {
    return new Decimal(value);
  } catch (error) {
    console.warn('Error converting value to Decimal:', value, error);
    return new Decimal(defaultValue);
  }
}

/**
 * Convert Decimal to number for display/API compatibility
 * Rounds to 2 decimal places for display consistency
 * 
 * @param value - Decimal instance to convert
 * @param decimals - Number of decimal places (default: 2 for display)
 * @returns Number rounded to specified decimals
 */
export function fromDecimal(value: Decimal | number | string | null | undefined, decimals: number = 2): number {
  if (value === null || value === undefined) {
    return 0;
  }
  
  const decimal = value instanceof Decimal ? value : toDecimal(value);
  return decimal.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Round Decimal value for display (2 decimal places)
 * Use this when converting Decimal to number for UI display
 * 
 * @param value - Decimal instance or convertible value
 * @returns Number rounded to 2 decimal places
 */
export function roundForDisplay(value: Decimal | number | string | null | undefined): number {
  return fromDecimal(value, 2);
}

/**
 * Round Decimal value for database storage (4 decimal places)
 * NOTE: For monetary values, use toCents() instead - database stores as BIGINT (cents)
 * This function is kept for backward compatibility with non-monetary values
 * 
 * @param value - Decimal instance or convertible value
 * @returns Number rounded to 4 decimal places
 */
export function roundForStorage(value: Decimal | number | string | null | undefined): number {
  return fromDecimal(value, 4);
}

/**
 * Convert amount to ten-thousandths of a dollar (for database storage as BIGINT)
 * Enables 4 decimal place precision: $3.5656 → 35656
 * Use this function before sending monetary values to the database
 *
 * @param amount - Decimal amount in dollars
 * @returns Number of ten-thousandths (integer, rounded to nearest 0.0001)
 */
export function toTenThousandths(amount: Decimal | number | string | null | undefined): number {
  const decimal = toDecimal(amount);
  return decimal.times(10000).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Convert ten-thousandths to Decimal amount (from database BIGINT values)
 * 35656 → $3.5656
 *
 * @param tenThousandths - Number of ten-thousandths (BIGINT from database)
 * @returns Decimal amount in dollars
 */
export function fromTenThousandths(tenThousandths: number | string | null | undefined): Decimal {
  return toDecimal(tenThousandths).dividedBy(10000);
}

/**
 * @deprecated Use toTenThousandths - database now stores ten-thousandths
 */
export function toCents(amount: Decimal | number | string | null | undefined): number {
  return toTenThousandths(amount);
}

/**
 * @deprecated Use fromTenThousandths - database now stores ten-thousandths
 */
export function fromCents(cents: number | string | null | undefined): Decimal {
  return fromTenThousandths(cents);
}

/**
 * Check if two Decimal values are equal within tolerance
 * Useful for comparing monetary values that might have tiny rounding differences
 * 
 * @param a - First value
 * @param b - Second value
 * @param tolerance - Tolerance in decimal places (default: 0.0001)
 * @returns True if values are equal within tolerance
 */
export function equals(a: Decimal | number | string, b: Decimal | number | string, tolerance: number = 0.0001): boolean {
  const decimalA = toDecimal(a);
  const decimalB = toDecimal(b);
  return decimalA.minus(decimalB).abs().lessThanOrEqualTo(tolerance);
}

/**
 * Sum an array of Decimal values
 * 
 * @param values - Array of values to sum
 * @returns Sum as Decimal
 */
export function sum(values: Array<Decimal | number | string | null | undefined>): Decimal {
  let result = new Decimal(0);
  for (const val of values) {
    result = result.plus(toDecimal(val));
  }
  return result;
}

/**
 * Get the maximum value from an array
 * 
 * @param values - Array of values
 * @returns Maximum value as Decimal
 */
export function max(values: Array<Decimal | number | string | null | undefined>): Decimal {
  if (values.length === 0) {
    return new Decimal(0);
  }
  return Decimal.max(...values.map(v => toDecimal(v)));
}

/**
 * Get the minimum value from an array
 * 
 * @param values - Array of values
 * @returns Minimum value as Decimal
 */
export function min(values: Array<Decimal | number | string | null | undefined>): Decimal {
  if (values.length === 0) {
    return new Decimal(0);
  }
  return Decimal.min(...values.map(v => toDecimal(v)));
}

// Re-export Decimal class for direct use when needed
export { Decimal };
export default Decimal;


