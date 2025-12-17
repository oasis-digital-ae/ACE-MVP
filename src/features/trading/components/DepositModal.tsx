import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { formatCurrency } from '@/shared/lib/formatters';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { supabase } from '@/shared/lib/supabase';
import { Wallet, Loader2 } from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';

// STRIPE DISABLED FOR TESTING - Using direct credit instead
const STRIPE_DISABLED = true;

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, refreshWalletBalance } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleTestCredit = async () => {
    if (!user) {
      setError('You must be logged in');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Credit $1000 directly using credit_wallet RPC
      const { error: creditError } = await supabase.rpc('credit_wallet', {
        p_user_id: user.id,
        p_amount_cents: 100000, // $1000 in cents
        p_ref: 'test_credit_' + Date.now(),
        p_currency: 'usd'
      });

      if (creditError) {
        throw new Error(creditError.message || 'Failed to credit wallet');
      }

      // Refresh wallet balance
      await refreshWalletBalance();
      
      toast({
        title: "Test Credit Successful",
        description: "$1000 has been credited to your wallet for testing.",
        variant: "default",
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error crediting wallet:', err);
      setError(err.message || 'Failed to credit wallet');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800/95 backdrop-blur-md border border-trading-primary/30 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center gradient-text flex items-center justify-center gap-2">
            <Wallet className="w-5 h-5" />
            Deposit Funds
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {STRIPE_DISABLED ? (
            <>
              <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4">
                <p className="text-yellow-300 text-sm font-medium mb-2">
                  ⚠️ Stripe Payment Disabled
                </p>
                <p className="text-gray-400 text-xs">
                  Stripe payments are temporarily disabled for testing. Use the test credit button below to add funds directly.
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-gradient-card p-6 rounded-lg border border-trading-primary/20">
                  <div className="text-center space-y-2">
                    <p className="text-gray-300 font-medium">Test Credit Amount</p>
                    <p className="text-3xl font-bold text-green-400">{formatCurrency(1000)}</p>
                    <p className="text-xs text-gray-400">This will credit $1000 directly to your wallet</p>
                  </div>
                </div>

                {error && (
                  <div className="text-red-400 text-sm text-center">{error}</div>
                )}

                <Button
                  onClick={handleTestCredit}
                  disabled={isLoading || !user}
                  className="w-full bg-gradient-success hover:bg-gradient-success/80 text-white font-semibold"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Crediting wallet...
                    </>
                  ) : (
                    `Credit ${formatCurrency(1000)} to Wallet`
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-400">Stripe payment integration is enabled.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

