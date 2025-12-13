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
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Glob Manager</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); background-color: var(--vscode-editor-background); }
        .container { max-width: 600px; margin: 0 auto; }
        h2 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
        .stats { margin-bottom: 20px; font-weight: bold; }
        .pattern-list { list-style: none; padding: 0; }
        .pattern-item { display: flex; align-items: center; margin-bottom: 10px; background: var(--vscode-editor-lineHighlightBackground); padding: 8px; border-radius: 4px; }
        .pattern-input { flex-grow: 1; margin-right: 10px; background: transparent; border: none; color: inherit; font-size: 14px; outline: none; }
        .badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-right: 10px; }
        .btn-remove { cursor: pointer; color: var(--vscode-errorForeground); background: none; border: none; font-size: 16px; }
        .btn-add { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; cursor: pointer; border-radius: 2px; }
        .btn-add:hover { background: var(--vscode-button-hoverBackground); }
    </style>
</head>
<body>
    <div class="container">
        <h2>Glob Patterns</h2>
        <div class="stats" id="total-stats">Total Files Selected: 0</div>
        <ul class="pattern-list" id="pattern-list">
        </ul>
        <button class="btn-add" id="btn-add">Add Pattern</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const patternList = document.getElementById('pattern-list');
        const btnAdd = document.getElementById('btn-add');
        const totalStats = document.getElementById('total-stats');
        
        let patterns = [];

        // Restore state if needed, simpler to just start fresh or sync from ext?
        // Let's keep state in webview for now and push to ext.

        function render() {
            patternList.innerHTML = '';
            patterns.forEach((p, index) => {
                const li = document.createElement('li');
                li.className = 'pattern-item';
                
                const input = document.createElement('input');
                input.className = 'pattern-input';
                input.value = p.text;
                input.placeholder = '**/*.ts';
                input.onchange = (e) => updatePattern(index, e.target.value);
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        updatePattern(index, e.target.value);
                        addPattern();
                    }
                };
                
                const badge = document.createElement('span');
                badge.className = 'badge';
                badge.textContent = (p.count !== undefined ? p.count : 0) + ' matches';
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'btn-remove';
                removeBtn.textContent = '✕';
                removeBtn.onclick = () => removePattern(index);
                
                li.appendChild(input);
                li.appendChild(badge);
                li.appendChild(removeBtn);
                patternList.appendChild(li);
            });
        }

        function addPattern() {
            patterns.push({ text: '', count: 0 });
            render();
            // Focus the new last input
            const inputs = document.querySelectorAll('.pattern-input');
            if (inputs.length > 0) {
                inputs[inputs.length - 1].focus();
            }
        }

        function removePattern(index) {
            patterns.splice(index, 1);
            render();
            notifyExtension();
        }

        function updatePattern(index, text) {
            patterns[index].text = text;
            notifyExtension();
        }

        function notifyExtension() {
            // Send only valid patterns
            const validPatterns = patterns.map(p => p.text).filter(t => t.trim().length > 0);
            vscode.postMessage({
                command: 'updatePatterns',
                patterns: validPatterns
            });
        }

        btnAdd.addEventListener('click', addPattern);

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data; 
            switch (message.command) {
                case 'initialState':
                    patterns = message.patterns;
                    render();
                    notifyExtension(); // Re-apply them? Maybe yes to get counts.
                    break;
                case 'updateStats':
                    // message.stats is array of { pattern, count }
                    // message.totalSelected
                    totalStats.textContent = 'Total Files Selected: ' + message.totalSelected;
                    
                    if (message.stats) {
                        message.stats.forEach(stat => {
                            const found = patterns.find(p => p.text === stat.pattern);
                            if (found) found.count = stat.count;
                        });
                        
                        // Update DOM directly to preserve focus
                        const items = document.querySelectorAll('.pattern-item');
                        items.forEach((item, index) => {
                            const p = patterns[index];
                            if (p) {
                                const badge = item.querySelector('.badge');
                                if (badge) {
                                    badge.textContent = (p.count !== undefined ? p.count : 0) + ' matches';
                                }
                            }
                        });
                    }
                    break;
            }
        });

        // Request initial state on load
        vscode.postMessage({ command: 'requestInitialState' });
    </script>
</body>
</html>`;
    }
}
