import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { Strategy as GitHubStrategy } from 'passport-github2';

export interface OAuthConfig {
  microsoft: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
  };
  github: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
  };
}

export interface OAuthProfile {
  id: string;
  username: string;
  email: string;
  provider: 'microsoft' | 'github';
}

/**
 * Load OAuth configuration from environment variables
 */
export function loadOAuthConfig(): OAuthConfig {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  // Validate required environment variables
  const requiredVars = [
    'MICROSOFT_CLIENT_ID',
    'MICROSOFT_CLIENT_SECRET',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  return {
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirectUri: `${baseUrl}/auth/callback/microsoft`,
      scope: ['openid', 'profile', 'email']
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectUri: `${baseUrl}/auth/callback/github`,
      scope: ['user:email']
    }
  };
}

/**
 * Normalize user profile from different OAuth providers
 */
export function normalizeProfile(provider: 'microsoft' | 'github', profile: any): OAuthProfile {
  switch (provider) {
    case 'microsoft':
      return {
        id: profile.id,
        username: profile.displayName || profile.emails?.[0]?.value?.split('@')[0] || 'Unknown',
        email: profile.emails?.[0]?.value || '',
        provider: 'microsoft'
      };
    
    case 'github':
      return {
        id: profile.id,
        username: profile.username || profile.displayName || 'Unknown',
        email: profile.emails?.[0]?.value || '',
        provider: 'github'
      };
    
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}