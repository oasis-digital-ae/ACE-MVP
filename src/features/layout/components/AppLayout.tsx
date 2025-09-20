import React from 'react';
import { useAppContext } from '@/features/trading/contexts/AppContext';
import Navigation from './Navigation';
import ClubValuesPage from '../../trading/components/ClubValuesPage';
import PortfolioPage from '../../trading/components/PortfolioPage';
import MatchResultsPage from '../../trading/components/MatchResultsPage';
import StandingsPage from '../../trading/components/StandingsPage';
import LiveTradingPage from '../../trading/components/LiveTradingPage';
import LaunchPage from '../../trading/components/LaunchPage';
import SeasonManager from '../../trading/components/SeasonManager';
import SeasonSimulation from '../../trading/components/SeasonSimulation';

const AppLayout: React.FC = () => {
  const { currentPage, setCurrentPage } = useAppContext();

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'marketplace':
      case 'club-values':
        return <ClubValuesPage />;
      case 'portfolio':
        return <PortfolioPage />;
      case 'match-results':
        return <MatchResultsPage />;
      case 'standings':
        return <StandingsPage />;
        case 'live-trading':
          return <LiveTradingPage />;
        case 'launch':
        return <LaunchPage />;
      case 'season-management':
        return <SeasonManager onSeasonChange={() => window.location.reload()} />;
      case 'season-simulation':
        return <SeasonSimulation />;
      default:
        return <ClubValuesPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="max-w-7xl mx-auto">
        {renderCurrentPage()}
      </main>
    </div>
  );
};

export default AppLayout;
