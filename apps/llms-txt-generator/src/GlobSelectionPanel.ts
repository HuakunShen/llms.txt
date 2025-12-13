import * as vscode from 'vscode';
import * as path from 'path';

export class GlobSelectionPanel {
    public static currentPanel: GlobSelectionPanel | undefined;
    
    // Persist patterns across re-opens
    private static _currentPatterns: string[] = [];
    
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    
    // Callback to update selection in extension.ts
    public static onUpdatePatterns: ((patterns: string[]) => void) | undefined;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        
        this._panel.webview.html = this._getHtmlForWebview();
        
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'updatePatterns':
                        GlobSelectionPanel._currentPatterns = message.patterns;
                        if (GlobSelectionPanel.onUpdatePatterns) {
                            GlobSelectionPanel.onUpdatePatterns(message.patterns);
                        }
                        return;
                    case 'requestInitialState':
                        this._panel.webview.postMessage({
                            command: 'initialState',
                            patterns: GlobSelectionPanel._currentPatterns.map(p => ({ text: p, count: 0 })) // Counts update later
                        });
                        return;
                    case 'generate':
                        vscode.commands.executeCommand('llms-txt-generator.generate');
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (GlobSelectionPanel.currentPanel) {
            GlobSelectionPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'globManager',
            'Glob Manager',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        GlobSelectionPanel.currentPanel = new GlobSelectionPanel(panel, extensionUri);
    }

    public static updateStats(stats: { pattern: string, count: number }[], totalSelected: number) {
        if (GlobSelectionPanel.currentPanel) {
            GlobSelectionPanel.currentPanel._panel.webview.postMessage({ 
                command: 'updateStats',
                stats: stats,
                totalSelected: totalSelected
            });
        }
    }

    public dispose() {
        GlobSelectionPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getHtmlForWebview() {
        // Local path to main script
        const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'assets', 'index.js');
        // And the style sheet
        const stylePathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'assets', 'index.css');

        // URI to load into webview
        const scriptUri = this._panel.webview.asWebviewUri(scriptPathOnDisk);
        const styleUri = this._panel.webview.asWebviewUri(stylePathOnDisk);

        // Usage of CSP to allow scripts and styles
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource}; script-src 'nonce-${nonce}';">
                <link href="${styleUri}" rel="stylesheet">
                <title>Glob Manager</title>
            </head>
            <body>
                <div id="app"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
