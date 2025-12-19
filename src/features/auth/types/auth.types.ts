export interface UserProfile {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name?: string; // Kept for backward compatibility
    birthday: string;
    country: string;
    phone: string;
  }