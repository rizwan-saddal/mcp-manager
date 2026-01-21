import * as vscode from 'vscode';
import * as path from 'path';
import { UvManager } from './uvManager';
import { ConfigSync } from './configSync';
import { DashboardGenerator } from './dashboard';
import { ToolManager } from './toolManager';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating MCP Manager Extension...');

    // Register commands immediately so they are available even if bootstrap fails
    // Command to manual sync
    context.subscriptions.push(vscode.commands.registerCommand('mcp-manager.syncConfig', async () => {
         // We need uvPath to sync, so we might need to check availability here or store it
         // For now, let's try to get it again or use a placeholder if bootstrapping failed previously.
         // Actually, if activate failed, we might not have reached here. 
         // But if we move registration up, we need scopes.
         // Let's defer execution.
         try {
             const verifiedUvPath = await UvManager.ensureUV(context);
             const routerPath = context.asAbsolutePath(path.join('python', 'router.py'));
             await ConfigSync.updateAntigravityConfig(verifiedUvPath, routerPath);
             vscode.window.showInformationMessage('MCP Config Synced to Antigravity.');
         } catch(e) {
             vscode.window.showErrorMessage(`Sync failed: ${e}`);
         }
    }));

    // Command to show status
    context.subscriptions.push(vscode.commands.registerCommand('mcp-manager.showStatus', async () => {
        const panel = vscode.window.createWebviewPanel(
            'mcpDashboard',
            'MCP Manager Dashboard',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const manifestPath = path.join(context.extensionPath, 'router_manifest.json');
        const logPath = path.join(context.extensionPath, 'logs', 'usage.jsonl');
        
        try {
            panel.webview.html = await DashboardGenerator.getHtml(context.extensionUri, logPath, manifestPath);
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to load dashboard: ${e}`);
        }
    }));

    // Command to Add Tool
    context.subscriptions.push(vscode.commands.registerCommand('mcp-manager.addTool', async () => {
        await ToolManager.addTool(context);
    }));

    // 1. Ensure uv is available
    let uvPath = 'uv';
    try {
        uvPath = await UvManager.ensureUV(context);
    } catch (e) {
        vscode.window.showErrorMessage(`Failed to bootstrap 'uv': ${e}`);
        // Do NOT return, so that commands remain registered
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
}

export function deactivate() {}
