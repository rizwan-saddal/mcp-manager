
export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'path' | 'email';
  required: boolean;
  description: string;
  placeholder?: string;
  pattern?: string; 
  errorMessage?: string; 
}

export const SERVER_CONFIGS: Record<string, ConfigField[]> = {
  'brave-search': [
    {
      key: 'BRAVE_API_KEY',
      label: 'Brave API Key',
      type: 'password',
      required: true,
      description: 'Required to access the Brave Search API. You can get a free key from the Brave Search API dashboard.',
      placeholder: 'BSA...',
      pattern: '^BSA.*$',
      errorMessage: 'Brave API Key usually starts with "BSA"'
    }
  ],
  'github': [
    {
      key: 'GITHUB_PERSONAL_ACCESS_TOKEN',
      label: 'GitHub Personal Access Token',
      type: 'password',
      required: true,
      description: 'A personal access token with repo permissions is required to access GitHub repositories.',
      placeholder: 'ghp_...',
      pattern: '^(ghp|github_pat)_.*$',
      errorMessage: 'Must be a valid GitHub Personal Access Token'
    }
  ],
  'postgres': [
    {
      key: 'POSTGRES_URL',
      label: 'Database Connection URL',
      type: 'text',
      required: true,
      description: 'The connection string for your PostgreSQL database.',
      placeholder: 'postgresql://user:password@localhost:5432/dbname',
      pattern: '^postgresql://.*$',
      errorMessage: 'Must be a valid postgresql:// URL'
    }
  ],
  'filesystem': [
    {
        key: 'ALLOWED_PATHS',
        label: 'Allowed Directory Paths',
        type: 'path',
        required: true,
        description: 'Absolute paths to directories the server is allowed to access, separated by commas.',
        placeholder: '/path/to/project',
    }
  ],
  'google-maps': [
    {
        key: 'GOOGLE_MAPS_API_KEY',
        label: 'Google Maps API Key',
        type: 'password',
        required: true,
        description: 'API Key from Google Cloud Console with Maps API enabled.',
        placeholder: 'AIza...',
        pattern: '^AIza[0-9A-Za-z-_]{35}$',
        errorMessage: 'Invalid Google API Key format'
    }
  ],
  'slack': [
      {
          key: 'SLACK_BOT_TOKEN',
          label: 'Slack Bot Token',
          type: 'password',
          required: true,
          description: 'Bot User OAuth Token.',
          placeholder: 'xoxb-...',
          pattern: '^xoxb-.*$',
          errorMessage: 'Must be a valid Slack Bot Token (starts with xoxb-)'
      },
      {
          key: 'SLACK_TEAM_ID',
          label: 'Slack Team ID',
          type: 'text',
          required: true,
          description: 'The Workspace ID.',
          placeholder: 'T...',
          pattern: '^T[A-Z0-9]+$',
          errorMessage: 'Invalid Slack Team ID'
      }
  ],
  'sentry': [
      {
          key: 'SENTRY_AUTH_TOKEN',
          label: 'Sentry Auth Token',
          type: 'password',
          required: true,
          description: 'User Auth Token from Sentry settings.',
          placeholder: 'Start with sntry...',
      }
  ]
};
