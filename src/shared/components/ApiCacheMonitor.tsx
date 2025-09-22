import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { apiCache } from '@/shared/lib/api-cache';

const ApiCacheMonitor: React.FC = () => {
  const [stats, setStats] = useState(apiCache.getStats());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(apiCache.getStats());
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) {
    return (
      <Button
        onClick={() => setIsVisible(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
      >
        📊 Cache Stats
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50 bg-gray-900 border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          API Cache Monitor
          <Button
            onClick={() => setIsVisible(false)}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Cache Entries:</span>
          <Badge variant="outline">{stats.cacheSize}</Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Pending Requests:</span>
          <Badge variant={stats.pendingRequests > 0 ? "destructive" : "outline"}>
            {stats.pendingRequests}
          </Badge>
        </div>

        <div className="pt-1 pb-1 border-t border-gray-700">
          <div className="text-xs text-green-400 font-medium">
            ⚡ Server-Side Caching Active
          </div>
          <div className="text-xs text-gray-400">
            • 1 API call per team click
          </div>
          <div className="text-xs text-gray-400">
            • Cache shared across ALL users
          </div>
          <div className="text-xs text-gray-400">
            • Survives page refreshes
          </div>
        </div>

        {stats.cacheKeys.length > 0 && (
          <div>
            <span className="text-xs text-gray-400">Cached:</span>
            <div className="text-xs text-gray-300 mt-1 max-h-20 overflow-y-auto">
              {stats.cacheKeys.map(key => (
                <div key={key} className="truncate">• {key}</div>
              ))}
            </div>
          </div>
        )}

        {stats.pendingKeys.length > 0 && (
          <div>
            <span className="text-xs text-gray-400">Pending:</span>
            <div className="text-xs text-yellow-400 mt-1">
              {stats.pendingKeys.map(key => (
                <div key={key} className="truncate">⏳ {key}</div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-gray-700">
          <Button
            onClick={() => apiCache.clear()}
            variant="outline"
            size="sm"
            className="w-full text-xs"
          >
            Clear Cache
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiCacheMonitor;
