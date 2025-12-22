// Move interfaces from clubs.ts here
export interface Club {
    id: string;
    name: string;
    launchValue: number;
    currentValue: number;
    profitLoss: number;
    percentChange: number;
    marketCap: number;
  }
  
  export interface Match {
    id: string;
    date: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    homeStartValue: number;
    awayStartValue: number;
    homeEndValue: number;
    awayEndValue: number;
    homeChange: number;
    awayChange: number;
    homeProfit: number;
    awayProfit: number;
  }
  
  export interface PortfolioItem {
    clubId: string;
    clubName: string;
    units: number;
    purchasePrice: number;
    currentPrice: number;
    totalValue: number;
    profitLoss: number;
  }
  
  export interface Transaction {
    id: string;
    clubId: string;
    clubName: string;
    units: number;
    pricePerUnit: number;
    totalValue: number;
    date: string;
    orderType: 'BUY' | 'SELL';
  }