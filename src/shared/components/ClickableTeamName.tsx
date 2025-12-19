import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import TeamDetailsModal from '@/features/trading/components/TeamDetailsModal';
import { teamsService } from '@/shared/lib/database';

interface ClickableTeamNameProps {
  teamName: string;
  teamId?: number; // Can be database ID or external_id
  externalId?: number; // Explicit external_id if provided
  className?: string;
  variant?: 'link' | 'button' | 'default';
  children?: React.ReactNode;
  userId?: string; // Optional user ID for P/L calculations
}

const ClickableTeamName: React.FC<ClickableTeamNameProps> = ({ 
  teamName, 
  teamId, 
  externalId,
  className = '',
  variant = 'link',
  children,
  userId
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [databaseTeamId, setDatabaseTeamId] = useState<number | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const resolveDatabaseTeamId = async (id: number | undefined, extId: number | undefined) => {
    if (!id && !extId) return null;
    
    setIsResolving(true);
    try {
      // If externalId is provided, look up by external_id
      if (extId) {
        const team = await teamsService.getByExternalId(extId.toString());
        if (team) {
          return team.id;
        }
      }
      
      // If teamId is provided, check if it's a valid database ID
      if (id) {
        const allTeams = await teamsService.getAll();
        const team = allTeams.find(t => t.id === id);
        if (team) {
          return team.id; // It's already a database ID
        }
        
        // If not found, try treating it as external_id
        const teamByExternalId = allTeams.find(t => t.external_id === id);
        if (teamByExternalId) {
          return teamByExternalId.id;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error resolving team ID:', error);
      return null;
    } finally {
      setIsResolving(false);
    }
  };

  const handleClick = async () => {
    console.log('ClickableTeamName clicked:', { teamName, teamId, externalId });
    
    if (teamId || externalId) {
      const dbId = await resolveDatabaseTeamId(teamId, externalId);
      if (dbId) {
        setDatabaseTeamId(dbId);
        setIsModalOpen(true);
      } else {
        console.warn('Could not resolve database team ID for:', { teamName, teamId, externalId });
      }
    } else {
      console.warn('No teamId or externalId provided for team:', teamName);
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
            disabled={!teamId && !externalId}
          >
            {teamName}
          </Button>
        );
      case 'link':
        return (
          <button
            onClick={handleClick}
            className={`text-blue-400 hover:text-blue-300 hover:underline cursor-pointer ${className}`}
            disabled={!teamId && !externalId}
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
