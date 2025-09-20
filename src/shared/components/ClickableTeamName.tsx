import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import TeamDetailsModal from '@/features/trading/components/TeamDetailsModal';
import { teamsService } from '@/shared/lib/database';

interface ClickableTeamNameProps {
  teamName: string;
  teamId?: number;
  className?: string;
  variant?: 'link' | 'button' | 'default';
  children?: React.ReactNode;
}

const ClickableTeamName: React.FC<ClickableTeamNameProps> = ({ 
  teamName, 
  teamId, 
  className = '',
  variant = 'link',
  children 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [databaseTeamId, setDatabaseTeamId] = useState<number | null>(null);

  const handleClick = async () => {
    console.log('ClickableTeamName clicked:', { teamName, teamId });
    
    if (teamId) {
      try {
        // Get the database team ID from the external ID
        const teams = await teamsService.getAll();
        console.log('Available teams:', teams.map(t => ({ id: t.id, external_id: t.external_id, name: t.name })));
        
        const team = teams.find(t => t.external_id === teamId);
        console.log('Found team:', team);
        
        if (team) {
          console.log('Setting database team ID:', team.id);
          setDatabaseTeamId(team.id);
          setIsModalOpen(true);
        } else {
          console.warn('Could not find database team for external ID:', teamId);
          console.warn('Available external IDs:', teams.map(t => t.external_id));
          // Fallback: use external ID directly
          setDatabaseTeamId(teamId);
          setIsModalOpen(true);
        }
      } catch (error) {
        console.error('Error finding team:', error);
        // Fallback: use external ID directly
        setDatabaseTeamId(teamId);
        setIsModalOpen(true);
      }
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
        />
      )}
    </>
  );
};

export default ClickableTeamName;
