import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as cp from 'node:child_process';
import * as yaml from 'js-yaml';
import * as https from 'node:https';

interface ParsedServer {
    id: string;
    title: string;
    description: string;
    repo: string;
    subpath?: string;
    category: string;
    iconUrl?: string;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('MCP Manager extension is active');

    let currentPanel: vscode.WebviewPanel | undefined = undefined;

    // Watch for changes in Docker config files to support dynamic updates
    const HOME = process.env.USERPROFILE || process.env.HOME || "";
    const configPaths = [
        path.join(HOME, ".docker", "mcp", "catalogs", "docker-mcp.yaml"),
        path.join(HOME, ".docker", "mcp", "registry.yaml")
    ];

    const changeListener = () => {
        if (currentPanel) {
            try {
                console.log('Config changed, refreshing servers...');
                const servers = listMcpServers();
                currentPanel.webview.postMessage({ command: 'servers_list', data: servers });
            } catch (e) {
                console.error('Failed to auto-refresh', e);
            }
        }
    };

    configPaths.forEach(p => {
        if (fs.existsSync(p)) {
            // Watch for file changes
            fs.watch(p, (eventType) => {
                if (eventType === 'change') {
                    changeListener();
                }
            });
        }
    });

    let disposable = vscode.commands.registerCommand('mcp-manager.openDashboard', () => {
        if (currentPanel) {
            currentPanel.reveal(vscode.ViewColumn.One);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'mcpManager',
            'MCP Manager',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'dist'))
                ],
                retainContextWhenHidden: true
            }
        );

        currentPanel = panel;

        panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

        panel.onDidDispose(
            () => {
                currentPanel = undefined;
            },
            null,
            context.subscriptions
        );

        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'list_servers':
                        try {
                            console.log('Fetching servers...');
                            const servers = listMcpServers();
                            console.log(`Found ${servers.length} servers`);
                            panel.webview.postMessage({ command: 'servers_list', data: servers });
                        } catch (err: any) {
                            const errorMsg = err.message || String(err);
                            console.error('Failed to list servers:', err);
                            console.error('Error stack:', err.stack);
                            vscode.window.showErrorMessage('Failed to list servers: ' + errorMsg);
                            panel.webview.postMessage({ command: 'error', message: errorMsg });
                        }
                        return;
                    case 'add_server':
                        console.log(`Enabling server ${message.serverId}...`);
                        cp.exec(`docker mcp server enable ${message.serverId}`, (err, stdout, stderr) => {
                            if (err) {
                                console.error(`Failed to enable ${message.serverId}:`, stderr);
                                vscode.window.showErrorMessage(`Failed to enable ${message.serverId}: ${stderr || err.message}`);
                                panel.webview.postMessage({ command: 'operation_error', message: `Failed to enable ${message.serverId}: ${stderr || err.message}` });
                            } else {
                                console.log(`Enabled ${message.serverId}`);
                                vscode.window.showInformationMessage(`Enabled ${message.serverId}`);
                                panel.webview.postMessage({ command: 'server_added', serverId: message.serverId });
                            }
                        });
                        return;
                    case 'remove_server':
                        console.log(`Disabling server ${message.serverId}...`);
                        cp.exec(`docker mcp server disable ${message.serverId}`, (err, stdout, stderr) => {
                            if (err) {
                                console.error(`Failed to disable ${message.serverId}:`, stderr);
                                vscode.window.showErrorMessage(`Failed to disable ${message.serverId}: ${stderr || err.message}`);
                                panel.webview.postMessage({ command: 'operation_error', message: `Failed to disable ${message.serverId}: ${stderr || err.message}` });
                            } else {
                                console.log(`Disabled ${message.serverId}`);
                                vscode.window.showInformationMessage(`Disabled ${message.serverId}`);
                                panel.webview.postMessage({ command: 'server_removed', serverId: message.serverId });
                            }
                        });
                        return;
                    case 'check_docker':
                        cp.exec('docker --version', (err) => {
                           panel.webview.postMessage({ command: 'docker_status', available: !err });
                        });
                        return;
                    case 'fetch_community_servers':
                        try {
                            console.log('Fetching community servers from GitHub...');
                            const communityServers = await fetchAndParseCommunityServers();
                            console.log(`Parsed ${communityServers.length} community servers`);
                            panel.webview.postMessage({ command: 'community_servers_list', data: communityServers });
                        } catch (err: any) {
                            console.error('Failed to fetch community servers:', err);
                            panel.webview.postMessage({ command: 'operation_error', message: `Failed to fetch community servers: ${err.message}` });
                        }
                        return;

                    case 'clone_server':
                        const { repo, id } = message.server;
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        
                        if (!workspaceFolder) {
                            vscode.window.showErrorMessage('No workspace folder open. Please open a folder to clone the server.');
                            return;
                        }

                        const targetDir = path.join(workspaceFolder, 'mcp-servers', id);
                        
                        if (fs.existsSync(targetDir)) {
                            vscode.window.showInformationMessage(`Server already exists at ${targetDir}`);
                            panel.webview.postMessage({ command: 'server_cloned', serverId: id });
                            return;
                        }

                        vscode.window.showInformationMessage(`Cloning ${id} server...`);
                        
                        // We use sparse checkout if it's a monorepo, or full clone.
                        // Simplified for now: Full clone into a temp dir then move? 
                        // Actually, let's just do a specific "git clone" if the user wants.
                        // Since 'servers' is a monorepo, we'll suggest cloning the whole thing or just point them to it.
                        // For this MVP, we will clone the MAIN monorepo into 'mcp-servers/community' if not present.
                        
                        const mcpDir = path.join(workspaceFolder, 'mcp-servers');
                        if (!fs.existsSync(mcpDir)) {
                            fs.mkdirSync(mcpDir);
                        }

                        cp.exec(`git clone ${repo} ${path.join(mcpDir, id)}`, (err, stdout, stderr) => {
                             if (err) {
                                vscode.window.showErrorMessage(`Failed to clone: ${err.message}`);
                                panel.webview.postMessage({ command: 'operation_error', message: `Clone failed: ${err.message}` });
                             } else {
                                vscode.window.showInformationMessage(`Successfully cloned ${id}`);
                                panel.webview.postMessage({ command: 'server_cloned', serverId: id });
                             }
                        });
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });


    context.subscriptions.push(disposable);
}

function listMcpServers() {
    try {
        const HOME = process.env.USERPROFILE || process.env.HOME || "";
        console.log('HOME directory:', HOME);
        
        const CATALOG_PATH = path.join(HOME, ".docker", "mcp", "catalogs", "docker-mcp.yaml");
        console.log('Catalog path:', CATALOG_PATH);
        
        if (!fs.existsSync(CATALOG_PATH)) {
            throw new Error('Catalog not found at ' + CATALOG_PATH);
        }

        console.log('Reading catalog file...');
        const fileContents = fs.readFileSync(CATALOG_PATH, "utf8");
        console.log('Catalog file size:', fileContents.length, 'bytes');
        
        console.log('Parsing YAML...');
        const data = yaml.load(fileContents) as any;
        
        if (!data?.registry) {
            throw new Error("Invalid catalog format: missing registry field");
        }

        console.log('Registry entries:', Object.keys(data.registry).length);

        // Get enabled servers from registry.yaml
        const REGISTRY_PATH = path.join(HOME, ".docker", "mcp", "registry.yaml");
        console.log('Registry path:', REGISTRY_PATH);
        
        let enabledServers: string[] = [];
        if (fs.existsSync(REGISTRY_PATH)) {
            console.log('Reading registry file...');
            const registryContent = fs.readFileSync(REGISTRY_PATH, "utf8");
            const registryData = yaml.load(registryContent) as any;
            if (registryData?.registry) {
                enabledServers = Object.keys(registryData.registry);
                console.log('Enabled servers:', enabledServers.length);
            }
        } else {
            console.log('Registry file not found, no servers enabled');
        }

        const servers = Object.entries(data.registry).map(([id, info]: [string, any]) => ({
            id,
            title: info.title || id,
            description: info.description || "No description",
            image: info.image,
            iconUrl: info.icon,
            category: info.metadata?.category || "uncategorized",
            enabled: enabledServers.includes(id)
        }));

        console.log('Returning', servers.length, 'servers');
        return servers;
    } catch (error: any) {
        console.error('Error in listMcpServers:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const manifestPath = path.join(extensionUri.fsPath, 'dist', '.vite', 'manifest.json');
    let scriptUri = '';
    let styleUri = '';

    try {
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', manifest['index.html'].file)).toString();
            if (manifest['index.html'].css) {
                styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', manifest['index.html'].css[0])).toString();
            }
        } else {
            // Fallback for development if index.html is directly in dist
            scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'assets', 'index.js')).toString();
            styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'assets', 'index.css')).toString();
        }
    } catch (e) {
        console.error('Failed to parse manifest', e);
    }

    const nonce = getNonce();

    const iconPath = vscode.Uri.joinPath(extensionUri, 'assets', 'icon.png');
    const iconUri = webview.asWebviewUri(iconPath);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Manager</title>
    <link rel="stylesheet" href="${styleUri}">
    <script nonce="${nonce}">
        window.vscode = acquireVsCodeApi();
        window.extensionIcon = "${iconUri}";
    </script>
</head>
<body style="background-color: transparent !important;">
    <div id="root"></div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

async function fetchAndParseCommunityServers(): Promise<ParsedServer[]> {
    const README_URL = 'https://raw.githubusercontent.com/modelcontextprotocol/servers/main/README.md';
    
    return new Promise((resolve, reject) => {
        https.get(README_URL, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const servers: ParsedServer[] = [];
                    const lines = data.split('\n');
                    let currentCategory = 'Other';

                    for (const line of lines) {
                        const headerMatch = line.match(/^#{2,4}\s+(.+)$/);
                        if (headerMatch) {
                            const header = headerMatch[1].trim();
                            if (header.includes('Reference')) currentCategory = 'AI';
                            else if (header.includes('Official')) currentCategory = 'Cloud';
                            else if (header.includes('Community')) currentCategory = 'DevOps';
                            else if (header.includes('Search')) currentCategory = 'Search';
                            else if (header.includes('Database')) currentCategory = 'Database';
                            else if (header.includes('Developer')) currentCategory = 'DevOps';
                            else if (header.includes('Knowledge') || header.includes('Productivity')) currentCategory = 'Productivity';
                            else if (header.includes('Cloud')) currentCategory = 'Cloud';
                            else if (header.includes('Utilities')) currentCategory = 'Utilities';
                            continue;
                        }

                        // Match patterns like:
                        // - **[Title](URL)** - Description
                        // - <img ... src="ICON" ... /> **[Title](URL)** - Description
                        const serverMatch = line.match(/^-\s+(?:<img[^>]+src="([^"]+)"[^>]*>\s+)?\*\*\[([^\]]+)\]\(([^)]+)\)\*\*\s+[-—]\s+(.+)$/);
                        
                        if (serverMatch) {
                            const [_, iconUrl, title, link, description] = serverMatch;
                            
                            let repo = link;
                            let subpath: string | undefined = undefined;

                            if (!link.startsWith('http')) {
                                repo = 'https://github.com/modelcontextprotocol/servers';
                                subpath = link;
                            }

                            servers.push({
                                id: title.toLowerCase().replace(/\s+/g, '-'),
                                title,
                                description: description.trim(),
                                repo,
                                subpath,
                                category: currentCategory,
                                iconUrl
                            });
                        }
                    }
                    resolve(servers);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * This method is called when your extension is deactivated.
 */
export function deactivate() {
    console.log('MCP Manager deactivated');
}
