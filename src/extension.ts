import * as vscode from 'vscode';
import * as path from 'path';
import { UvManager } from './uvManager';
import { ConfigSync } from './configSync';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating MCP Manager Extension...');

    // 1. Ensure uv is available
    let uvPath = 'uv';
    try {
        uvPath = await UvManager.ensureUV(context);
    } catch (e) {
        vscode.window.showErrorMessage(`Failed to bootstrap 'uv': ${e}`);
        return;
    }

    // 2. Resolve Router Path
    const routerPath = context.asAbsolutePath(path.join('python', 'router.py'));

    // 3. Register MCP Server Provider
    // Note: using the API signature provided in the prompt context.
    // In strict VS Code API, this might be different.
    try {
        // @ts-ignore - Assuming the API exists or is injected by the environment/mock
        vscode.lm.registerMcpServerDefinitionProvider('mcp-manager-provider', {
            provideMcpServerDefinitions: () => {
                return [
                    new vscode.McpStdioServerDefinition(
                        'MCP Manager Tools',
                        uvPath,
                        ['run', routerPath],
                        { 'PYTHONUNBUFFERED': '1' }
                    )
                ];
            }
        });
        console.log('Registered MCP Server Definition Provider.');
    } catch (e) {
        console.error('Failed to register MCP provider (API might be missing):', e);
    }

    // 4. Create File Watcher for Manifest changes (to trigger updates if needed)
    const manifestWatcher = vscode.workspace.createFileSystemWatcher('**/router_manifest.json');
    manifestWatcher.onDidChange(() => {
        // In a real implementation, we might restart the server or notify via config
        console.log('Manifest changed.');
    });
    context.subscriptions.push(manifestWatcher);

    // 5. Sync Config to Antigravity
    await ConfigSync.updateAntigravityConfig(uvPath, routerPath);
    
    // Command to manual sync
    context.subscriptions.push(vscode.commands.registerCommand('mcp-manager.syncConfig', async () => {
         await ConfigSync.updateAntigravityConfig(uvPath, routerPath);
         vscode.window.showInformationMessage('MCP Config Synced to Antigravity.');
    }));
}

export function deactivate() {}
