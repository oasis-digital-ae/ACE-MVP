import { supabase } from './supabase';
import { teamsService } from './database';

export const testDatabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    
    // Test basic connection
    const { data, error } = await supabase
      .from('teams')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Database connection failed:', error);
      return false;
    }
    
    console.log('✅ Database connection successful');
    
    // Test teams service
    const teams = await teamsService.getAll();
    console.log('✅ Teams service working, found', teams.length, 'teams');
    
    return true;
  } catch (error) {
    console.error('❌ Database test failed:', error);
    return false;
  }
};

