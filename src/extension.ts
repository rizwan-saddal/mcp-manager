import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as cp from 'node:child_process';
import * as yaml from 'js-yaml';
import * as https from 'node:https';
import AdmZip from 'adm-zip';
import { SERVER_CONFIGS } from './serverConfigs';

interface ParsedServer {
    id: string;
    title: string;
    description: string;
    repo: string;
    subpath?: string;
    category: string;
    iconUrl?: string;
    configSchema?: any;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('MCP Manager extension is active');

    let currentPanel: vscode.WebviewPanel | undefined = undefined;
    const outputChannel = vscode.window.createOutputChannel("MCP Manager");

    // Watch for changes in Docker config files to support dynamic updates
    const HOME = process.env.USERPROFILE || process.env.HOME || "";
    const configPaths = [
        path.join(HOME, ".docker", "mcp", "catalogs", "docker-mcp.yaml"),
        getMcpConfigPath()
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
                const runCmd = (command: string, cwd?: string, logCommand?: string): Promise<{ stdout: string, stderr: string }> => {
                    return new Promise((resolve, reject) => {
                        const isWindows = process.platform === 'win32';
                        // Ensure cwd exists if provided
                         if (cwd && !fs.existsSync(cwd)) {
                            const errorMsg = `[runCmd] Error: CWD does not exist: ${cwd}`;
                            outputChannel.appendLine(errorMsg);
                            console.error(errorMsg);
                            reject({ err: new Error(`Working directory does not exist: ${cwd}`), stdout: '', stderr: '' });
                            return;
                        }

                        const displayCmd = logCommand || command;
                        const logMsg = `Executing: ${displayCmd} in ${cwd || 'default cwd'}`;
                        console.log(logMsg);
                        outputChannel.appendLine(logMsg);
                        
                        // On Windows, explicitly try to use ComSpec, fallback to system32 cmd.exe to avoid ENOENT
                        const shellPath = isWindows ? (process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe') : true;

                        const child = cp.spawn(command, {
                            shell: shellPath,
                            cwd: cwd,
                            env: { ...process.env }
                        });

                        let stdout = '';
                        let stderr = '';

                        child.stdout.on('data', (data) => { 
                            const str = data.toString();
                            stdout += str;
                            outputChannel.append(str);
                        });
                        child.stderr.on('data', (data) => { 
                            const str = data.toString();
                            stderr += str;
                            outputChannel.append(str);
                        });

                        child.on('close', (code) => {
                            if (code === 0) {
                                resolve({ stdout, stderr });
                            } else {
                                const errorMsg = `Command failed with code ${code}`;
                                outputChannel.appendLine(errorMsg);
                                reject({ err: new Error(errorMsg), stdout, stderr });
                            }
                        });
                        
                        child.on('error', (err) => {
                             const errorMsg = `Command execution error: ${err.message}`;
                             outputChannel.appendLine(errorMsg);
                             reject({ err, stdout, stderr });
                        });
                    });
                };

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
                            outputChannel.appendLine(`Failed to list servers: ${errorMsg}`);
                            vscode.window.showErrorMessage('Failed to list servers: ' + errorMsg);
                            panel.webview.postMessage({ command: 'error', message: errorMsg });
                        }
                        return;

                    case 'add_server':
                        console.log(`Enabling server ${message.serverId}...`);
                        try {
                            const configPath = getMcpConfigPath();
                            const servers = listMcpServers();
                            const server = servers.find(s => s.id === message.serverId);
                            
                            if (!server) throw new Error("Server not found in catalog");

                            let config: any = { mcpServers: {} };
                            if (fs.existsSync(configPath)) {
                                config = JSON.parse(fs.readFileSync(configPath, "utf8"));
                            }
                            if (!config.mcpServers) config.mcpServers = {};

                            const envArgs: string[] = [];
                            if (message.env) {
                                for (const [key, value] of Object.entries(message.env)) {
                                    envArgs.push("-e", `${key}=${value}`);
                                }
                            }

                            config.mcpServers[message.serverId] = {
                                command: "docker",
                                args: ["run", "-i", "--rm", ...envArgs, server.image]
                            };

                            // Ensure directory exists
                            fs.mkdirSync(path.dirname(configPath), { recursive: true });
                            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

                            console.log(`Enabled ${message.serverId} via JSON config`);
                            vscode.window.showInformationMessage(`Enabled ${message.serverId}`);
                            panel.webview.postMessage({ command: 'server_added', serverId: message.serverId });
                        } catch (e: any) {
                            console.error(`Failed to enable ${message.serverId}:`, e.message);
                            vscode.window.showErrorMessage(`Failed to enable ${message.serverId}: ${e.message}`);
                            panel.webview.postMessage({ command: 'operation_error', message: `Failed to initialize ${message.serverId}: ${e.message}` });
                        }
                        return;

                    case 'remove_server':
                        console.log(`Disabling server ${message.serverId}...`);
                        try {
                            const configPath = getMcpConfigPath();
                            if (fs.existsSync(configPath)) {
                                const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
                                if (config.mcpServers && config.mcpServers[message.serverId]) {
                                    delete config.mcpServers[message.serverId];
                                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                                }
                            }
                            console.log(`Disabled ${message.serverId}`);
                            vscode.window.showInformationMessage(`Disabled ${message.serverId}`);
                            panel.webview.postMessage({ command: 'server_removed', serverId: message.serverId });
                        } catch (e: any) {
                            console.error(`Failed to disable ${message.serverId}:`, e.message);
                            vscode.window.showErrorMessage(`Failed to disable ${message.serverId}: ${e.message}`);
                            panel.webview.postMessage({ command: 'operation_error', message: `Failed to stop ${message.serverId}: ${e.message}` });
                        }
                        return;


                    case 'check_docker':
                        try {
                            await runCmd('docker --version');
                            panel.webview.postMessage({ command: 'docker_status', available: true });
                        } catch (e) {
                            panel.webview.postMessage({ command: 'docker_status', available: false });
                        }
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

                    case 'install_community_server':
                        const { repo, id, subpath } = message.server;
                        const envVars = message.env || {};
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        
                        if (!workspaceFolder) {
                            vscode.window.showErrorMessage('No workspace folder open. Please open a folder to clone the server.');
                            return;
                        }



                        vscode.window.showInformationMessage(`Installing ${id}...`);
                        outputChannel.show(); // Show the output channel so user can see progress
                        
                        const mcpDir = path.join(workspaceFolder, 'mcp-servers');
                        const serverDir = path.join(mcpDir, id);

                        if (!fs.existsSync(mcpDir)) {
                            fs.mkdirSync(mcpDir);
                        }

                        try {
                            // 1. Clone
                            // 1. Download & Extract Code (No Git Required)
                            if (!fs.existsSync(serverDir)) {
                                outputChannel.appendLine(`Downloading source from ${repo}...`);
                                
                                let archiveUrl = repo;
                                if (repo.endsWith('.git')) archiveUrl = repo.slice(0, -4);
                                
                                // Construct Zip URL for GitHub
                                // Supporting both main and master is tricky without checking, but HEAD usually points to default
                                if (!archiveUrl.endsWith('.zip')) {
                                    archiveUrl = `${archiveUrl}/archive/HEAD.zip`;
                                }

                                const zipPath = path.join(mcpDir, `${id}.zip`);
                                const tempExtractDir = path.join(mcpDir, `${id}_temp`);

                                try {
                                    outputChannel.appendLine(`Downloading ${archiveUrl}...`);
                                    await downloadFile(archiveUrl, zipPath);
                                    
                                    outputChannel.appendLine(`Extracting...`);
                                    if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true });
                                    fs.mkdirSync(tempExtractDir);

                                    await extractZip(zipPath, tempExtractDir);
                                    
                                    // Handle GitHub's nested folder structure (repo-branch)
                                    const extractedFiles = fs.readdirSync(tempExtractDir);
                                    let sourcePath = tempExtractDir;
                                    
                                    if (extractedFiles.length === 1 && fs.statSync(path.join(tempExtractDir, extractedFiles[0])).isDirectory()) {
                                        sourcePath = path.join(tempExtractDir, extractedFiles[0]);
                                    }

                                    // Handle Subpath (e.g. src/fetch in monorepo)
                                    if (subpath) {
                                        const subPathFull = path.join(sourcePath, subpath);
                                        if (fs.existsSync(subPathFull)) {
                                            outputChannel.appendLine(`Using subpath: ${subpath}`);
                                            sourcePath = subPathFull;
                                        } else {
                                            outputChannel.appendLine(`Warning: Subpath ${subpath} not found in zip. Using root.`);
                                        }
                                    }

                                    // Move to final destination
                                    fs.renameSync(sourcePath, serverDir);
                                    
                                    // Cleanup
                                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                                    if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true });
                                    
                                    outputChannel.appendLine(`Source code installed to ${serverDir}`);

                                } catch (err: any) {
                                    // Cleanup on failure
                                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                                    if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true });
                                    throw new Error(`Download failed: ${err.message}`);
                                }
                            } else {
                                console.log('Directory exists, skipping download');
                                outputChannel.appendLine(`Directory ${serverDir} exists, skipping download.`);
                            }

                            // 2. Detect & Install
                            let config: any = { mcpServers: {} };
                            const configPath = getMcpConfigPath();
                            if (fs.existsSync(configPath)) {
                                config = JSON.parse(fs.readFileSync(configPath, "utf8"));
                            }
                            if (!config.mcpServers) config.mcpServers = {};

                            // Strategy A: Dockerfile (Highest Priority for reliability)
                            if (fs.existsSync(path.join(serverDir, 'Dockerfile'))) {
                                vscode.window.showInformationMessage(`Building Docker image for ${id}...`);
                                panel.webview.postMessage({ command: 'operation_start', message: `Building Docker image...` });

                                const imageName = `mcp-community-${id.toLowerCase()}`;
                                await runCmd(`docker build -t ${imageName} .`, serverDir);

                                const envArgs: string[] = [];
                                for (const [key, value] of Object.entries(envVars)) {
                                    envArgs.push("-e", `${key}=${value}`);
                                }

                                config.mcpServers[id] = {
                                    command: "docker",
                                    args: ["run", "-i", "--rm", ...envArgs, imageName]
                                };
                                
                                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                                vscode.window.showInformationMessage(`Successfully installed - running via Docker!`);
                                panel.webview.postMessage({ command: 'server_added', serverId: id });
                            }
                            // Strategy B: Node.js (package.json)
                            else if (fs.existsSync(path.join(serverDir, 'package.json'))) {
                                vscode.window.showInformationMessage(`Building Node.js server ${id}...`);
                                panel.webview.postMessage({ command: 'operation_start', message: `Installing NPM dependencies...` });

                                await runCmd('npm install', serverDir);
                                await runCmd('npm run build', serverDir);

                                // Try to find the built file
                                let buildPath = path.join(serverDir, 'build', 'index.js');
                                if (!fs.existsSync(buildPath)) {
                                    buildPath = path.join(serverDir, 'dist', 'index.js');
                                }
                                if (!fs.existsSync(buildPath)) {
                                     if (fs.existsSync(path.join(serverDir, 'index.js'))) {
                                         buildPath = path.join(serverDir, 'index.js');
                                     }
                                }

                                if (fs.existsSync(buildPath)) {
                                    config.mcpServers[id] = {
                                        command: "node",
                                        args: [buildPath],
                                        env: envVars
                                    };
                                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                                    
                                    vscode.window.showInformationMessage(`Successfully installed Node.js server!`);
                                    panel.webview.postMessage({ command: 'server_added', serverId: id });
                                } else {
                                    vscode.window.showWarningMessage(`Built ${id}, but couldn't locate entry point. Check configuration.`);
                                    panel.webview.postMessage({ command: 'server_cloned', serverId: id }); // Update UI but don't mark active yet
                                }
                            }
                            // Strategy C: Python (pyproject.toml or requirements.txt)
                            else if (fs.existsSync(path.join(serverDir, 'pyproject.toml')) || fs.existsSync(path.join(serverDir, 'requirements.txt'))) {
                                vscode.window.showInformationMessage(`Setting up Python environment for ${id}...`);
                                panel.webview.postMessage({ command: 'operation_start', message: `Creating venv & installing pip packages...` });

                                // Create Venv
                                await runCmd('python -m venv .venv', serverDir);
                                
                                const isWin = process.platform === 'win32';
                                const venvBin = path.join(serverDir, '.venv', isWin ? 'Scripts' : 'bin');
                                const pythonPath = path.join(venvBin, isWin ? 'python.exe' : 'python');
                                const pipPath = path.join(venvBin, isWin ? 'pip.exe' : 'pip');

                                // Install deps
                                // Use the venv python to install to ensure we use the venv
                                await runCmd(`"${pythonPath}" -m pip install .`, serverDir);

                                // Attempt to detect entry point script
                                let scriptName = id;
                                const pyprojectPath = path.join(serverDir, 'pyproject.toml');
                                if (fs.existsSync(pyprojectPath)) {
                                    try {
                                        const content = fs.readFileSync(pyprojectPath, 'utf8');
                                        // Simple regex to find a script entry in [project.scripts]
                                        // matches: name = "..."
                                        const match = content.match(/\[project\.scripts\][^[]*?([\w-]+)\s*=/s);
                                        if (match) {
                                            scriptName = match[1];
                                        }
                                    } catch (e) {
                                        console.log('Error parsing pyproject.toml', e);
                                    }
                                }

                                // Check if a script executable was created in venv/Scripts
                                const scriptPath = path.join(venvBin, isWin ? `${scriptName}.exe` : scriptName);
                                
                                if (fs.existsSync(scriptPath)) {
                                    config.mcpServers[id] = {
                                        command: scriptPath,
                                        args: [],
                                        env: envVars
                                    };
                                } else {
                                    // Fallback: python -m <id> or python -m <scriptName>
                                    config.mcpServers[id] = {
                                        command: pythonPath,
                                        args: ["-m", scriptName],
                                        env: envVars
                                    };
                                }

                                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                                vscode.window.showInformationMessage(`Successfully installed Python server!`);
                                panel.webview.postMessage({ command: 'server_added', serverId: id });
                            }
                            else {
                                // Unknown structure
                                vscode.window.showInformationMessage(`Cloned ${id} to ${serverDir}. Please configure manually.`);
                                panel.webview.postMessage({ command: 'server_cloned', serverId: id });
                            }

                        } catch (e: any) {
                            // Enhanced Error Handling
                            const msg = e.err?.message || String(e);
                            const details = (e.stderr || e.stdout || "No output").trim();
                            
                            console.error('Install failed:', e);
                            outputChannel.appendLine(`[Error] Install failed: ${msg}`);
                            outputChannel.appendLine(`[Details] ${details}`);
                            
                            let userMessage = `Installation failed: ${msg}. Check 'MCP Manager' output for details.`;
                            
                            // Heuristic for missing Git
                            if ((details.includes("'git'") && details.includes("not recognized")) || 
                                msg.includes("spawn git ENOENT") || 
                                details.includes("command not found")) {
                                userMessage = "Git is required but was not detected. Please ensure Git is installed and available in your PATH.";
                            }

                            vscode.window.showErrorMessage(userMessage);
                            panel.webview.postMessage({ command: 'operation_error', message: userMessage + `\n\nDetails: ${details}` });
                        }
                        return;
                }
            },

            undefined,
            context.subscriptions
        );
    });


    context.subscriptions.push(disposable);

    // Register MCP tools as VS Code Language Model Tools
    registerMcpTools(context);
}

async function registerMcpTools(context: vscode.ExtensionContext) {
    try {
        const configPath = getMcpConfigPath();
        if (!fs.existsSync(configPath)) return;

        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        const servers = config.mcpServers || {};

        for (const [serverId, serverConfig] of Object.entries(servers)) {
            if (serverId === 'brave') {
                registerBraveTools(context, serverConfig as any);
            } else if (serverId === 'fetch') {
                registerFetchTools(context, serverConfig as any);
            }
        }
    } catch (e) {
        console.error('Failed to register MCP tools:', e);
    }
}

function registerBraveTools(context: vscode.ExtensionContext, config: any) {
    const tools = [
        {
            name: 'brave_search',
            description: 'Search the web using Brave Search. Best for current events and general information.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The search query' },
                    count: { type: 'number', description: 'Number of results (1-10)', default: 5 }
                },
                required: ['query']
            }
        },
        {
            name: 'brave_local_search',
            description: 'Search for local businesses, points of interest, and places.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The search query' }
                },
                required: ['query']
            }
        }
    ];

    for (const tool of tools) {
        const toolId = `mcp-brave-${tool.name}`;
        context.subscriptions.push(
            vscode.lm.registerTool(toolId, {
                async invoke(options, token) {
                    const result = await runMcpToolCall(config, tool.name, options.input);
                    return new vscode.LanguageModelToolResult([new vscode.LanguageModelToolResultPart(result)]);
                }
            })
        );
        console.log(`Registered VS Code tool: ${toolId}`);
    }
}

function registerFetchTools(context: vscode.ExtensionContext, config: any) {
    const tools = [
        {
            name: 'fetch',
            description: 'Fetches a URL from the internet and extracts its contents as markdown.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'URL to fetch' },
                    max_length: { type: 'number', description: 'Maximum number of characters to return' },
                    raw: { type: 'boolean', description: 'Get the actual HTML content without simplification' },
                    start_index: { type: 'number', description: 'Start output at this character index' }
                },
                required: ['url']
            }
        }
    ];

    for (const tool of tools) {
        const toolId = `mcp-fetch-${tool.name}`;
        context.subscriptions.push(
            vscode.lm.registerTool(toolId, {
                async invoke(options, token) {
                    const result = await runMcpToolCall(config, tool.name, options.input);
                    return new vscode.LanguageModelToolResult([new vscode.LanguageModelToolResultPart(result)]);
                }
            })
        );
        console.log(`Registered VS Code tool: ${toolId}`);
    }
}

async function runMcpToolCall(config: any, toolName: string, args: any): Promise<string> {
    return new Promise((resolve, reject) => {
        // Construct the docker command but run it in a way that we can talk to it
        // We'll use a one-shot execution for now, but real MCP typically uses stdio persistence
        const dockerArgs = [...(config.args || [])];
        
        // We need to send a JSON-RPC request to stdin
        const request = {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
                name: toolName,
                arguments: args
            }
        };

        const isWindows = process.platform === 'win32';
        const shellPath = isWindows ? (process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe') : true;

        const cp_proc = cp.spawn(config.command, dockerArgs, {
            env: { ...process.env, ...(config.env || {}) },
            shell: shellPath
        });

        let stdout = '';
        let stderr = '';

        cp_proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        cp_proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        cp_proc.on('close', (code) => {
            try {
                // Find the JSON response in stdout (might be multiple lines or contain noise)
                const match = stdout.match(/\{.*\}/s);
                if (match) {
                    const response = JSON.parse(match[0]);
                    if (response.result && response.result.content) {
                        const content = response.result.content
                            .map((c: any) => c.text || JSON.stringify(c))
                            .join('\n');
                        resolve(content);
                    } else if (response.error) {
                        reject(new Error(response.error.message || 'MCP Error'));
                    } else {
                        resolve(stdout);
                    }
                } else {
                    resolve(stdout || stderr || 'No output from tool');
                }
            } catch (err) {
                resolve(stdout || 'Failed to parse MCP response');
            }
        });

        // Write the request to stdin and close it
        cp_proc.stdin.write(JSON.stringify(request) + '\n');
        cp_proc.stdin.end();

        // Timeout after 30 seconds
        setTimeout(() => {
            cp_proc.kill();
            reject(new Error('MCP tool call timed out'));
        }, 30000);
    });
}

function getMcpConfigPath() {
    const HOME = process.env.USERPROFILE || process.env.HOME || "";
    // We'll manage a standard config file that the user can point their MCP clients to
    return path.join(HOME, ".docker", "mcp", "mcp-manager-config.json");
}

function listMcpServers() {
    try {
        const HOME = process.env.USERPROFILE || process.env.HOME || "";
        const CATALOG_PATH = path.join(HOME, ".docker", "mcp", "catalogs", "docker-mcp.yaml");
        
        if (!fs.existsSync(CATALOG_PATH)) {
            throw new Error('Docker MCP Catalog not found. Please ensure Docker Desktop has MCP features enabled (Beta).');
        }

        const fileContents = fs.readFileSync(CATALOG_PATH, "utf8");
        const data = yaml.load(fileContents) as any;
        
        if (!data?.registry) {
            throw new Error("Invalid catalog format");
        }

        // Get enabled servers from our managed config
        const CONFIG_PATH = getMcpConfigPath();
        let enabledServers: string[] = [];
        if (fs.existsSync(CONFIG_PATH)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
            if (config.mcpServers) {
                enabledServers = Object.keys(config.mcpServers);
            }
        }

        const servers = Object.entries(data.registry).map(([id, info]: [string, any]) => ({
            id,
            title: info.title || id,
            description: info.description || "No description",
            image: info.image,
            iconUrl: info.icon,
            category: info.metadata?.category || "uncategorized",
            enabled: enabledServers.includes(id),
            configSchema: SERVER_CONFIGS[id] || undefined
        }));

        return servers;
    } catch (error: any) {
        console.error('Error in listMcpServers:', error);
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

async function resolveGitPath(): Promise<string> {
   return 'git';
}

function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const handleResponse = (response: any) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
                if (response.headers.location) {
                    const redirectUrl = response.headers.location;
                    https.get(redirectUrl, handleResponse).on('error', (err) => {
                         file.close();
                         fs.unlink(dest, () => {});
                         reject(err);
                    });
                    return;
                }
            }

            if (response.statusCode !== 200) {
                file.close();
                fs.unlink(dest, () => {});
                reject(new Error(`HTTP Status ${response.statusCode}`));
                return;
            }

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        };

        const request = https.get(url, { headers: { 'User-Agent': 'VSCode-MCP-Manager' } }, handleResponse);
        request.on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function extractZip(zipPath: string, destDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(destDir, true);
            resolve();
        } catch (err) {
            console.error('Unzip error (AdmZip):', err);
            reject(err);
        }
    });
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
                                iconUrl,
                                configSchema: SERVER_CONFIGS[title.toLowerCase().replace(/\s+/g, '-')]
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
