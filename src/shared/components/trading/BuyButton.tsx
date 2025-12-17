// Reusable buy button component
import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Loader2 } from 'lucide-react';

interface BuyButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  isWindowClosed?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BuyButton: React.FC<BuyButtonProps> = ({
  onClick,
  disabled = false,
  isLoading = false,
  isWindowClosed = false,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const getButtonText = () => {
    if (isLoading) return 'Processing...';
    if (isWindowClosed) return '🔒 Closed';
    return 'Buy';
  };

  return (
    <Button
      onClick={onClick}
      disabled={disabled || isLoading || isWindowClosed}
      className={`bg-gradient-success hover:bg-gradient-success/80 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${sizeClasses[size]} ${className}`}
      title={isWindowClosed ? 'Trading window is closed' : 'Buy shares'}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        getButtonText()
      )}
    </Button>
  );
};
