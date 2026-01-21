export interface ToolPreset {
    id: string; // Internal ID
    name: string; // Display Name / Tool Name
    description: string;
    command: string[];
    envVars?: string[]; // Environment variables to prompt for
    inputSchema?: any;
}

export const TOOL_PRESETS: ToolPreset[] = [
    {
        id: "brave-search",
        name: "brave_search",
        description: "Privacy-focused web search using Brave API.",
        command: ["uv", "run", "mcp-server-brave-search"],
        envVars: ["BRAVE_API_KEY"]
    },
    {
        id: "fetch",
        name: "fetch",
        description: "Retrieve raw content from any URL.",
        command: ["uv", "run", "mcp-server-fetch"]
    },
    {
        id: "sqlite",
        name: "sqlite_query",
        description: "Execute read-only SQL queries on a local database.",
        command: ["uv", "run", "mcp-server-sqlite", "--db-path", "${DB_PATH}"],
        envVars: ["DB_PATH"] // Special handling for arguments
    },
    {
        id: "git",
        name: "git_read",
        description: "Read and search git repositories.",
        command: ["uv", "run", "mcp-server-git", "--repository", "${REPO_PATH}"],
        envVars: ["REPO_PATH"]
    },
    {
        id: "github",
        name: "github_pr",
        description: "Interact with GitHub Issues and Pull Requests.",
        command: ["uv", "run", "mcp-server-github"],
        envVars: ["GITHUB_TOKEN"]
    }
];
