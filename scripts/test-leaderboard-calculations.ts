/**
 * Test Script for Weekly Leaderboard Calculations
 * 
 * Run this script to verify that the centralized calculation logic
 * produces correct and consistent results.
 * 
 * Usage:
 *   npx tsx scripts/test-leaderboard-calculations.ts
 */

import {
  calculateWeeklyReturn,
  calculateAccountValue,
  calculateLeaderboard,
  toLeaderboardDbFormat,
  fromLeaderboardDbFormat,
  validateLeaderboardEntries,
  type UserLeaderboardData
} from '../src/shared/lib/utils/leaderboard-calculations';

// ANSI color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function testAccountValue() {
  log('\n📊 Testing Account Value Calculation', colors.bold);
  
  const tests = [
    { wallet: 100, portfolio: 50, expected: 150 },
    { wallet: 0, portfolio: 100, expected: 100 },
    { wallet: 75.25, portfolio: 24.75, expected: 100 },
  ];
  
  tests.forEach((test, i) => {
    const result = calculateAccountValue(test.wallet, test.portfolio);
    const passed = result === test.expected;
    log(
      `  Test ${i + 1}: ${test.wallet} + ${test.portfolio} = ${result} ${passed ? '✅' : '❌'}`,
      passed ? colors.green : colors.red
    );
  });
}

function testWeeklyReturn() {
  log('\n📈 Testing Weekly Return Calculation', colors.bold);
  
  const tests = [
    {
      name: 'No deposits, 10% gain',
      start: 100,
      end: 110,
      deposits: 0,
      expected: 0.10, // 10%
    },
    {
      name: 'With deposits, need to account',
      start: 100,
      end: 160,
      deposits: 50,
      expected: 0.066667, // 6.67%
    },
    {
      name: 'Loss with deposits',
      start: 100,
      end: 140,
      deposits: 50,
      expected: -0.066667, // -6.67%
    },
    {
      name: 'Zero starting balance',
      start: 0,
      end: 50,
      deposits: 50,
      expected: 0, // Can't calculate return from nothing
    },
    {
      name: 'Pure deposit, no trading',
      start: 100,
      end: 150,
      deposits: 50,
      expected: 0, // No gain from trading
    },
  ];
  
  tests.forEach((test, i) => {
    const result = calculateWeeklyReturn(test.start, test.end, test.deposits);
    const resultPercent = (result * 100).toFixed(2);
    const expectedPercent = (test.expected * 100).toFixed(2);
    const passed = Math.abs(result - test.expected) < 0.0001;
    
    log(`  Test ${i + 1}: ${test.name}`, colors.blue);
    log(`    Start: $${test.start}, End: $${test.end}, Deposits: $${test.deposits}`);
    log(
      `    Result: ${resultPercent}% (expected ${expectedPercent}%) ${passed ? '✅' : '❌'}`,
      passed ? colors.green : colors.red
    );
  });
}

function testLeaderboardRanking() {
  log('\n🏆 Testing Leaderboard Ranking', colors.bold);
  
  const userData: UserLeaderboardData[] = [
    {
      user_id: 'user1',
      full_name: 'Alice',
      start_wallet_value: 50,
      start_portfolio_value: 50,
      start_account_value: 100,
      end_wallet_value: 60,
      end_portfolio_value: 60,
      end_account_value: 120,
      deposits_week: 0,
    },
    {
      user_id: 'user2',
      full_name: 'Bob',
      start_wallet_value: 80,
      start_portfolio_value: 20,
      start_account_value: 100,
      end_wallet_value: 85,
      end_portfolio_value: 20,
      end_account_value: 105,
      deposits_week: 0,
    },
    {
      user_id: 'user3',
      full_name: 'Charlie',
      start_wallet_value: 100,
      start_portfolio_value: 0,
      start_account_value: 100,
      end_wallet_value: 80,
      end_portfolio_value: 10,
      end_account_value: 90,
      deposits_week: 0,
    },
  ];
  
  const leaderboard = calculateLeaderboard(userData);
  
  log('  Rankings:');
  leaderboard.forEach((entry, i) => {
    const returnPercent = (entry.weekly_return * 100).toFixed(2);
    log(
      `    Rank ${entry.rank}: ${entry.full_name} - ${returnPercent}%`,
      entry.rank === i + 1 ? colors.green : colors.red
    );
  });
  
  // Verify Alice is #1 (20% return)
  const aliceIsFirst = leaderboard[0].full_name === 'Alice';
  log(`\n  Alice should be #1: ${aliceIsFirst ? '✅' : '❌'}`, aliceIsFirst ? colors.green : colors.red);
  
  // Verify Bob is #2 (5% return)
  const bobIsSecond = leaderboard[1].full_name === 'Bob';
  log(`  Bob should be #2: ${bobIsSecond ? '✅' : '❌'}`, bobIsSecond ? colors.green : colors.red);
  
  // Verify Charlie is #3 (-10% return)
  const charlieIsThird = leaderboard[2].full_name === 'Charlie';
  log(`  Charlie should be #3: ${charlieIsThird ? '✅' : '❌'}`, charlieIsThird ? colors.green : colors.red);
}

function testDatabaseConversion() {
  log('\n💾 Testing Database Format Conversion', colors.bold);
  
  const entry = {
    user_id: 'test-user',
    full_name: 'Test User',
    rank: 1,
    start_wallet_value: 100.50,
    start_portfolio_value: 50.25,
    start_account_value: 150.75,
    end_wallet_value: 110.50,
    end_portfolio_value: 55.25,
    end_account_value: 165.75,
    deposits_week: 10.00,
    weekly_return: 0.052300,
  };
  
  // Convert to DB format (cents)
  const dbFormat = toLeaderboardDbFormat(entry);
  
  log('  Original (dollars):');
  log(`    Start Account: $${entry.start_account_value}`);
  log(`    End Account: $${entry.end_account_value}`);
  log(`    Weekly Return: ${(entry.weekly_return * 100).toFixed(2)}%`);
  
  log('\n  Database Format (cents):');
  log(`    Start Account: ${dbFormat.start_account_value} cents`);
  log(`    End Account: ${dbFormat.end_account_value} cents`);
  log(`    Weekly Return: ${dbFormat.weekly_return}`);
  
  // Convert back
  const restored = fromLeaderboardDbFormat(dbFormat);
  
  log('\n  Restored (dollars):');
  log(`    Start Account: $${restored.start_account_value}`);
  log(`    End Account: $${restored.end_account_value}`);
  log(`    Weekly Return: ${(restored.weekly_return * 100).toFixed(2)}%`);
  
  // Verify round-trip
  const startMatches = Math.abs(entry.start_account_value - restored.start_account_value) < 0.01;
  const endMatches = Math.abs(entry.end_account_value - restored.end_account_value) < 0.01;
  const returnMatches = Math.abs(entry.weekly_return - restored.weekly_return) < 0.000001;
  
  const passed = startMatches && endMatches && returnMatches;
  log(`\n  Round-trip conversion: ${passed ? '✅' : '❌'}`, passed ? colors.green : colors.red);
}

function testValidation() {
  log('\n🔍 Testing Validation', colors.bold);
  
  // Valid data
  const validData = [{
    user_id: 'user1',
    full_name: 'Valid User',
    rank: 1,
    start_wallet_value: 100,
    start_portfolio_value: 50,
    start_account_value: 150,
    end_wallet_value: 110,
    end_portfolio_value: 55,
    end_account_value: 165,
    deposits_week: 0,
    weekly_return: 0.10,
  }];
  
  const validErrors = validateLeaderboardEntries(validData);
  log(`  Valid data errors: ${validErrors.length === 0 ? '✅' : '❌'}`, validErrors.length === 0 ? colors.green : colors.red);
  
  // Invalid data (negative account value)
  const invalidData = [{
    ...validData[0],
    end_account_value: -10,
  }];
  
  const invalidErrors = validateLeaderboardEntries(invalidData);
  log(`  Invalid data caught: ${invalidErrors.length > 0 ? '✅' : '❌'}`, invalidErrors.length > 0 ? colors.green : colors.red);
  if (invalidErrors.length > 0) {
    log(`    Error: ${invalidErrors[0]}`, colors.yellow);
  }
}

// Run all tests
function runAllTests() {
  log('═══════════════════════════════════════════════════', colors.bold);
  log('  Weekly Leaderboard Calculation Tests', colors.bold);
  log('═══════════════════════════════════════════════════', colors.bold);
  
  try {
    testAccountValue();
    testWeeklyReturn();
    testLeaderboardRanking();
    testDatabaseConversion();
    testValidation();
    
    log('\n═══════════════════════════════════════════════════', colors.bold);
    log('  ✅ All Tests Completed!', colors.green + colors.bold);
    log('═══════════════════════════════════════════════════', colors.bold);
    
  } catch (error) {
    log('\n═══════════════════════════════════════════════════', colors.bold);
    log('  ❌ Tests Failed!', colors.red + colors.bold);
    log('═══════════════════════════════════════════════════', colors.bold);
    console.error(error);
    process.exit(1);
  }
}

runAllTests();
