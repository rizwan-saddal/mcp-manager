import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class ConfigSync {
    static async updateAntigravityConfig(uvPath: string, routerPath: string) {
        const homeDir = os.homedir();
        // Determine path based on OS (per requirements)
        // Mac/Linux: ~/.gemini/antigravity/mcp_config.json
        // Windows: %USERPROFILE%\.gemini\antigravity\mcp_config.json
        const configDir = path.join(homeDir, '.gemini', 'antigravity');
        const configPath = path.join(configDir, 'mcp_config.json');

        const config = {
            "mcpServers": {
                "mcp-manager-router": {
                    "command": uvPath,
                    "args": [
                        "run",
                        routerPath
                    ],
                    "env": {
                        "PYTHONUNBUFFERED": "1"
                    }
                }
            }
        };

        try {
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log(`Synced MCP config to ${configPath}`);
        } catch (e) {
            console.error(`Failed to sync config: ${e}`);
        }
    }
}
