/**
 * Database Configuration
 * 
 * Neon PostgreSQL connection settings
 */

// Neon Database Connection String
// In production, use environment variables via expo-constants or react-native-dotenv
export const DATABASE_URL = 'postgresql://neondb_owner:npg_BgqmUSLjMa97@ep-falling-forest-aedbyaqb-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

// Neon HTTP API endpoint (derived from connection string)
export const NEON_API_HOST = 'ep-falling-forest-aedbyaqb-pooler.c-2.us-east-2.aws.neon.tech';
export const NEON_DATABASE = 'neondb';
export const NEON_USER = 'neondb_owner';
export const NEON_PASSWORD = 'npg_BgqmUSLjMa97';
