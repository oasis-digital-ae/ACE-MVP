import React from 'react';

interface TeamLogoProps {
  teamName: string;
  externalId?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const TeamLogo: React.FC<TeamLogoProps> = ({ teamName, externalId, className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-lg'
  };

  // Generate crest URL directly from external_id (Football Data API team ID)
  const getCrestUrl = (externalId?: number): string | null => {
    if (!externalId) return null;
    
    // Use external_id directly as the team_id in the Football Data API crest URL
    return `https://crests.football-data.org/${externalId}.png`;
  };

  // Get team initials (first letter of each word)
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2); // Max 2 characters
  };

  // Get consistent color for each team
  const getTeamColor = (name: string): string => {
    const teamColors: Record<string, string> = {
      'Arsenal FC': 'bg-red-500',
      'Aston Villa FC': 'bg-purple-500',
      'AFC Bournemouth': 'bg-red-600',
      'Brentford FC': 'bg-yellow-500',
      'Brighton & Hove Albion FC': 'bg-blue-500',
      'Burnley FC': 'bg-red-700',
      'Chelsea FC': 'bg-blue-600',
      'Crystal Palace FC': 'bg-blue-400',
      'Everton FC': 'bg-blue-700',
      'Leeds United FC': 'bg-yellow-600',
      'Liverpool FC': 'bg-red-500',
      'Manchester City FC': 'bg-blue-500',
      'Manchester United FC': 'bg-red-600',
      'Newcastle United FC': 'bg-gray-600',
      'Nottingham Forest FC': 'bg-green-600',
      'Sunderland AFC': 'bg-red-500',
      'Tottenham Hotspur FC': 'bg-blue-500',
      'West Ham United FC': 'bg-red-500',
      'Wolverhampton Wanderers FC': 'bg-yellow-500',
      'Fulham FC': 'bg-white text-black'
    };

    return teamColors[name] || 'bg-gray-500';
  };

  const crestUrl = getCrestUrl(externalId);

  // If we have a crest URL, show the actual logo
  if (crestUrl) {
    return (
      <img
        src={crestUrl}
        alt={`${teamName} logo`}
        className={`${sizeClasses[size]} object-contain ${className}`}
        onError={(e) => {
          // Fallback to initials if image fails
          const target = e.target as HTMLImageElement;
          const parent = target.parentElement;
          if (parent) {
            const initials = getInitials(teamName);
            const colorClass = getTeamColor(teamName);
            parent.innerHTML = `
              <div class="${sizeClasses[size]} ${colorClass} rounded-full flex items-center justify-center text-white font-bold">
                ${initials}
              </div>
            `;
          }
        }}
      />
    );
  }

  // Fallback to colored circle with initials
  const initials = getInitials(teamName);
  const colorClass = getTeamColor(teamName);
  
  return (
    <div className={`${sizeClasses[size]} ${colorClass} rounded-full flex items-center justify-center text-white font-bold ${className}`}>
      {initials}
    </div>
  );
};

export default TeamLogo;
