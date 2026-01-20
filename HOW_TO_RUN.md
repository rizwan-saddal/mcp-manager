# How to Run the MCP Manager Extension

## Method 1: Debug Mode (Recommended for Development)

1. **Open this project in VS Code**
   - Make sure you have the `b:\mcp-manager` folder open in VS Code

2. **Press F5** or:
   - Click on the "Run and Debug" icon in the sidebar (or press `Ctrl+Shift+D`)
   - Select "Launch Extension" from the dropdown
   - Click the green play button

3. **A new VS Code window will open** (Extension Development Host)
   - This is a separate VS Code instance with your extension loaded

4. **In the NEW window**, open the command palette:
   - Press `Ctrl+Shift+P`
   - Type "MCP: Open Manager Dashboard"
   - Press Enter

5. **The dashboard should now open!**

## Method 2: Install the Extension (For Production Use)

If you want to use the extension in your regular VS Code window:

1. **Package the extension**:
   ```powershell
   npm run package
   ```

2. **Install the VSIX file**:
   - In VS Code, press `Ctrl+Shift+P`
   - Type "Extensions: Install from VSIX"
   - Select the `mcp-manager-1.0.0.vsix` file
   - Reload VS Code

3. **Now the command will be available** in your regular VS Code window

## Troubleshooting

### "Command not found" error
- You're trying to run the command in the wrong window
- The extension only works in the Extension Development Host window (when using F5)
- OR you need to install the VSIX file first

### Extension not loading
- Make sure you've run `npm run build` first
- Check the Debug Console for errors (View → Debug Console)

### Dashboard shows errors
- Open Developer Tools: `Ctrl+Shift+P` → "Developer: Toggle Developer Tools"
- Check the Console tab for detailed error messages
