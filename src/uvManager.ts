import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as util from 'util';

const execFile = util.promisify(cp.execFile);

export class UvManager {
    static async ensureUV(context: vscode.ExtensionContext): Promise<string> {
        // 1. Check if uv is in PATH
        try {
            await execFile('uv', ['--version']);
            return 'uv';
        } catch (e) {
            // Not in path
        }


        // 2. Check globalStorage
        const storagePath = context.globalStorageUri.fsPath;
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }

        const platform = os.platform();
        const extension = platform === 'win32' ? '.exe' : '';
        const uvPath = path.join(storagePath, `uv${extension}`);

        if (fs.existsSync(uvPath)) {
            return uvPath;
        }

        // 3. Download
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Installing 'uv' package manager...",
            cancellable: false
        }, async (progress) => {
            await this.downloadUV(storagePath, platform);
        });

        return uvPath;
    }

    private static async downloadUV(destDir: string, platform: string) {
        // Construct download URL (simplified for x64 usually)
        let url = '';
        if (platform === 'win32') {
            url = 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip';
        } else if (platform === 'darwin') {
            url = 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-apple-darwin.tar.gz';
        } else {
            url = 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-unknown-linux-gnu.tar.gz';
        }

        // Use curl or powershell to download and extract
        if (platform === 'win32') {
            const zipPath = path.join(destDir, 'uv.zip');
            // Use execFile to avoid spawning cmd.exe
            // Determine available shell (pwsh or powershell)
            let shell = 'powershell';
            try {
                await execFile('pwsh', ['-version']);
                shell = 'pwsh';
            } catch (e) {
                // pwsh not found, fallback to powershell
            }

            const script = `& { Invoke-WebRequest -Uri '${url}' -OutFile '${zipPath}'; Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force; }`;
            await execFile(shell, ['-NoProfile', '-Command', script]);
            // Move from extraction subfolder usually? 
            // The zip usually contains uv.exe directly or in a folder.
            // Let's assume we need to find it.
            // Actually, simpler: Use 'irm ... | iex' to install to temp and move?
            // No, sticking to zip.
            // Safe fallback: Manual prompt if this fails? 
            // For now, assume zip structure has a folder or file.
            // Usually 'uv-x86_64.../uv.exe'.
            // Pass for now.
        } else {
            // Unix (tar.gz)
            // We cannot pipe with execFile directly. We should use curl locally to a file then tar.
            // Or simpler: just use curl to download to file, then tar to extract.
            const tarPath = path.join(destDir, 'uv.tar.gz');
            
            // 1. Download with curl
            await execFile('curl', ['-L', url, '-o', tarPath]);
            
            // 2. Extract with tar
            await execFile('tar', ['-xzf', tarPath, '-C', destDir]);
        }
        
        // Find the binary in subfolders and move to root of globalStorage if needed
        const files = this.getAllFiles(destDir);
        const uvBinary = files.find(f => f.endsWith(platform === 'win32' ? 'uv.exe' : '/uv'));
        if (uvBinary && uvBinary !== path.join(destDir, platform === 'win32' ? 'uv.exe' : 'uv')) {
            fs.copyFileSync(uvBinary, path.join(destDir, platform === 'win32' ? 'uv.exe' : 'uv'));
        }
    }

    private static getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
        const files = fs.readdirSync(dirPath);
        files.forEach((file) => {
            if (fs.statSync(dirPath + "/" + file).isDirectory()) {
                arrayOfFiles = UvManager.getAllFiles(dirPath + "/" + file, arrayOfFiles);
            } else {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        });
        return arrayOfFiles;
    }
}
