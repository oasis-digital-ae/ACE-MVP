// Environment configuration utility
// This ensures all environment variables are properly typed and validated

interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appEnv: 'development' | 'production' | 'test';
  debugMode: boolean;
}

function getEnvironmentConfig(): EnvironmentConfig {
  // Cast import.meta.env to any to avoid TypeScript errors
  const env = import.meta.env;
  
  // Support multiple environment variable naming conventions
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 
                     env.VITE_SUPABASE_URL || 
                     env.SUPABASE_URL;
  
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 
                         env.SUPABASE_ANON_KEY;
  const appEnv = (env.VITE_APP_ENV || 'development') as 'development' | 'production' | 'test';
  const debugMode = env.VITE_DEBUG_MODE === 'true';

  // Validate required environment variables
  if (!supabaseUrl) {
    // Try to extract URL from the anon key if available
    const anonKey = env.VITE_SUPABASE_ANON_KEY;
    if (anonKey && anonKey.startsWith('eyJ')) {
      try {
        // Decode JWT to get the project reference
        const payload = JSON.parse(atob(anonKey.split('.')[1]));
        const projectRef = payload.ref;
        if (projectRef) {
          const extractedUrl = `https://${projectRef}.supabase.co`;
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
    
    throw new Error('Supabase URL is required. Please set NEXT_PUBLIC_SUPABASE_URL, VITE_SUPABASE_URL, or SUPABASE_URL in your environment variables.');
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
