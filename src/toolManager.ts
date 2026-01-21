import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TOOL_PRESETS, ToolPreset } from './toolPresets';

export class ToolManager {
    static async addTool(context: vscode.ExtensionContext) {
        // 1. Select Tool
        const selected = await vscode.window.showQuickPick(
            TOOL_PRESETS.map(t => ({
                label: t.name,
                description: t.description,
                detail: t.id,
                preset: t
            })),
            {
                placeHolder: "Select an MCP Tool to install..."
            }
        );

        if (!selected) return;
        const preset = selected.preset;

        // 2. Prompt for Env Vars / Args
        const env: {[key: string]: string} = {};
        const finalCommand = [...preset.command]; // Clone

        if (preset.envVars) {
            for (const varName of preset.envVars) {
                // Check if it's a command argument placeholder (e.g., REPO_PATH)
                if (preset.command.some(part => part.includes(`\${${varName}}`))) {
                    const value = await vscode.window.showInputBox({
                        prompt: `Enter value for ${varName}`,
                        placeHolder: `e.g. /path/to/repo`
                    });
                    if (!value) {
                         vscode.window.showWarningMessage("Installation cancelled: Missing argument.");
                         return;
                    }
                    
                    // Replace in command
                    for (let i = 0; i < finalCommand.length; i++) {
                        finalCommand[i] = finalCommand[i].replace(`\${${varName}}`, value);
                    }

                } else {
                    // It's a real Env Var
                    const value = await vscode.window.showInputBox({
                        prompt: `Enter API Key / Token for ${varName}`,
                        password: varName.includes('KEY') || varName.includes('TOKEN')
                    });
                     if (!value) {
                         vscode.window.showWarningMessage("Installation cancelled: Missing Environment Variable.");
                         return;
                    }
                    env[varName] = value;
                }
            }
        }

        // 3. Update Manifest
        const manifestPath = path.join(context.extensionPath, 'router_manifest.json');
        let manifest: any = { tools: [] };
        
        try {
            if (fs.existsSync(manifestPath)) {
                manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            }
        } catch (e) {
            console.warn("Could not read existing manifest, creating new one.");
        }

        // Check duplicate
        if (manifest.tools.find((t: any) => t.name === preset.name)) {
            const overwrite = await vscode.window.showWarningMessage(
                `Tool '${preset.name}' already exists. Overwrite?`,
                "Yes", "No"
            );
            if (overwrite !== "Yes") return;
            
            // Remove existing
            manifest.tools = manifest.tools.filter((t: any) => t.name !== preset.name);
        }

        // Construct Config
        const toolConfig: any = {
            name: preset.name,
            description: preset.description,
            command: finalCommand,
            inputSchema: preset.inputSchema || {}
        };
        
        if (Object.keys(env).length > 0) {
            toolConfig.env = env;
        }

        // Push
        manifest.tools.push(toolConfig);

        // Write
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        vscode.window.showInformationMessage(`Successfully installed '${preset.name}'. Please reload or sync config.`);
        
        // Trigger Sync
        vscode.commands.executeCommand('mcp-manager.syncConfig');
    }
}
