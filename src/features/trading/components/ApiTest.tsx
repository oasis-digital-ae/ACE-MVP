import React, { useState } from 'react';
import { testApiConnection } from '../../../shared/lib/football-api';

export const ApiTest: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleTest = async () => {
    setIsLoading(true);
    setResult('Testing API connection...');
    
    try {
      const success = await testApiConnection();
      setResult(success ? '✅ API connection successful!' : '❌ API connection failed');
    } catch (error) {
      setResult(`❌ API test error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-2">API Connection Test</h3>
      <button
        onClick={handleTest}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {isLoading ? 'Testing...' : 'Test API Connection'}
      </button>
      {result && (
        <div className="mt-2 p-2 bg-white rounded border">
          <pre className="text-sm">{result}</pre>
        </div>
      )}
    </div>
  );
};
