import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import TeamDetailsModal from '@/features/trading/components/TeamDetailsModal';

interface ClickableTeamNameProps {
  teamName: string;
  teamId?: number;
  className?: string;
  variant?: 'link' | 'button' | 'default';
  children?: React.ReactNode;
  userId?: string; // Optional user ID for P/L calculations
}

const ClickableTeamName: React.FC<ClickableTeamNameProps> = ({ 
  teamName, 
  teamId, 
  className = '',
  variant = 'link',
  children,
  userId
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [databaseTeamId, setDatabaseTeamId] = useState<number | null>(null);

  const handleClick = () => {
    console.log('ClickableTeamName clicked:', { teamName, teamId });
    
    if (teamId) {
      setDatabaseTeamId(teamId);
      setIsModalOpen(true);
    } else {
      console.warn('No teamId provided for team:', teamName);
    }
  };

  const renderContent = () => {
    if (children) return children;
    
    switch (variant) {
      case 'button':
        return (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClick}
            className={className}
            disabled={!teamId}
          >
            {teamName}
          </Button>
        );
      case 'link':
        return (
          <button
            onClick={handleClick}
            className={`text-blue-400 hover:text-blue-300 hover:underline cursor-pointer ${className}`}
            disabled={!teamId}
          >
            {teamName}
          </button>
        );
      default:
        return (
          <span
            onClick={handleClick}
            className={`cursor-pointer hover:text-blue-400 hover:underline ${className}`}
          >
            {teamName}
          </span>
        );
    }
  };

  return (
    <>
      {renderContent()}
      {databaseTeamId && (
        <TeamDetailsModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setDatabaseTeamId(null);
          }}
          teamId={databaseTeamId}
          teamName={teamName}
          userId={userId}
        />
      )}
    </>
  );
};

export default ClickableTeamName;
