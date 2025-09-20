// Environment configuration utility
// This ensures all environment variables are properly typed and validated

interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appEnv: 'development' | 'production' | 'test';
  debugMode: boolean;
}

function getEnvironmentConfig(): EnvironmentConfig {
  // Debug: Log ALL environment variables to help troubleshoot
  console.log('All environment variables:', import.meta.env);
  
  // Support multiple environment variable naming conventions
  const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 
                     import.meta.env.VITE_SUPABASE_URL || 
                     import.meta.env.SUPABASE_URL ||
                     'https://zuwpcgfgrwvqsbmyfbwj.supabase.co'; // Fallback URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                         import.meta.env.SUPABASE_ANON_KEY;
  const appEnv = (import.meta.env.VITE_APP_ENV || 'development') as 'development' | 'production' | 'test';
  const debugMode = import.meta.env.VITE_DEBUG_MODE === 'true';

  // Debug logging to help troubleshoot
  console.log('Environment variables check:', {
    NEXT_PUBLIC_SUPABASE_URL: import.meta.env.NEXT_PUBLIC_SUPABASE_URL,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_URL: import.meta.env.SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing',
    SUPABASE_ANON_KEY: import.meta.env.SUPABASE_ANON_KEY ? 'Present' : 'Missing',
    supabaseUrl: supabaseUrl,
    supabaseAnonKey: supabaseAnonKey ? 'Present' : 'Missing'
  });

  // Validate required environment variables
  if (!supabaseUrl) {
    // Try to extract URL from the anon key if available
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (anonKey && anonKey.startsWith('eyJ')) {
      try {
        // Decode JWT to get the project reference
        const payload = JSON.parse(atob(anonKey.split('.')[1]));
        const projectRef = payload.ref;
        if (projectRef) {
          const extractedUrl = `https://${projectRef}.supabase.co`;
          console.log('Extracted Supabase URL from JWT:', extractedUrl);
          return {
            supabaseUrl: extractedUrl,
            supabaseAnonKey: anonKey,
            appEnv,
            debugMode
          };
        }
      } catch (e) {
        console.warn('Could not extract URL from JWT:', e);
      }
    }
    
    throw new Error('Supabase URL is required. Please set NEXT_PUBLIC_SUPABASE_URL, VITE_SUPABASE_URL, or SUPABASE_URL in your .env file.');
  }

  if (!supabaseAnonKey) {
    throw new Error('Supabase Anon Key is required. Please set VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY in your .env file.');
  }

  // Validate Supabase URL format
  if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
    throw new Error('Supabase URL must be a valid Supabase URL (https://your-project.supabase.co)');
  }

  // Validate Supabase key format (JWT tokens start with 'eyJ')
  if (!supabaseAnonKey.startsWith('eyJ')) {
    throw new Error('Supabase Anon Key must be a valid JWT token');
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    appEnv,
    debugMode
  };
}

// Export the validated configuration
export const env = getEnvironmentConfig();

// Export individual values for convenience
export const { supabaseUrl, supabaseAnonKey, appEnv, debugMode } = env;

// Development helper
export const isDevelopment = appEnv === 'development';
export const isProduction = appEnv === 'production';
export const isTest = appEnv === 'test';
