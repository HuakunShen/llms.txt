import * as vscode from 'vscode';
import * as path from 'path';
import { FileTreeProvider } from './FileTreeProvider';
import { FileTreeItem } from './FileTreeItem';
import { generateLLMsTxt } from './generator';
import { GlobSelectionPanel } from './GlobSelectionPanel';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "llms-txt-generator" is now active!');

	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri : undefined;

	const fileTreeProvider = new FileTreeProvider(rootPath);

    const treeView = vscode.window.createTreeView('llms-txt-generator.fileView', {
        treeDataProvider: fileTreeProvider,
        manageCheckboxStateManually: true
    });

    // ... (keep existing checkbox listener) ...
    context.subscriptions.push(treeView.onDidChangeCheckboxState(e => {
        for (const [item, state] of e.items) {
             const isChecked = state === vscode.TreeItemCheckboxState.Checked;
             fileTreeProvider.toggleCheckbox(item as FileTreeItem); 
        }
    }));

    // Register Commands
	context.subscriptions.push(vscode.commands.registerCommand('llms-txt-generator.refresh', () => {
        fileTreeProvider.refresh();
        vscode.window.showInformationMessage('File list refreshed');
    }));

	context.subscriptions.push(vscode.commands.registerCommand('llms-txt-generator.generate', async () => {
		if (!rootPath) {
            vscode.window.showErrorMessage('No workspace open');
            return;
        }

        const checkedFiles = fileTreeProvider.getCheckedFiles();
        if (checkedFiles.length === 0) {
            vscode.window.showWarningMessage('No files selected. Please select files to generate llms.txt');
            return;
        }

        const content = generateLLMsTxt(checkedFiles, rootPath.fsPath);
        
        const dooc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'markdown' 
        });
        await vscode.window.showTextDocument(dooc);
	}));

    // Handle updates from WebView
    GlobSelectionPanel.onUpdatePatterns = (patterns: string[]) => {
        // Reset all checks first? User asked for "add glob patterns... remove them".
        // Implies we should re-eval checking based on current active patterns.
        // If we uncheck everything, we lose manual checks.
        // But "Glob Manager" implies it manages the selection via globs.
        // Let's assume for this feature, it manages the selection state derived from these globs.
        // OR: it's additive?
        // "I can add new glob patterns... remove them". If I remove one, I expect its matches to be unchecked.
        // This implies we should reconstruct the selection from scratch based on the pattern list.
        // BUT we should preserve manual selections if possible? 
        // Typically "Select by Glob" is a tool. 
        // If we treat it as a manager, maybe we uncheck all, then apply all patterns.
        // Let's try: Uncheck All -> Search & Select for each pattern.
        
        fileTreeProvider.uncheckAll();
        
        let totalStats: { pattern: string, count: number }[] = [];
        let allMatchedItems: FileTreeItem[] = [];

        for (const pattern of patterns) {
            const matched = fileTreeProvider.searchAndSelect(pattern);
            totalStats.push({ pattern, count: matched.length });
            allMatchedItems.push(...matched);
        }
        
        // Update Stats in Webview
        const uniqueFiles = new Set(fileTreeProvider.getCheckedFiles());
        GlobSelectionPanel.updateStats(totalStats, uniqueFiles.size);

        // Auto Expand to show selected files
        // We can use treeView.reveal(item, { expand: true })
        // Use a limit to avoid freezing?
        if (allMatchedItems.length > 0 && allMatchedItems.length < 50) {
            // Expand first few or all if small count
             // Reveal last one to scroll down? Or first one?
             // Revealing each one might be heavy. 
             // Let's reveal the first few.
             for (const item of allMatchedItems) {
                 try {
                    treeView.reveal(item, { expand: true, focus: false, select: false });
                 } catch (e) { } 
             }
        } else if (allMatchedItems.length >= 50) {
             // Just reveal the first one
             if (allMatchedItems[0]) {
                 treeView.reveal(allMatchedItems[0], { expand: true, focus: false, select: false });
             }
        }
    };

    context.subscriptions.push(vscode.commands.registerCommand('llms-txt-generator.selectByGlob', () => {
        GlobSelectionPanel.createOrShow(context.extensionUri);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('llms-txt-generator.checkAll', () => {
        fileTreeProvider.checkAll();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('llms-txt-generator.uncheckAll', () => {
        fileTreeProvider.uncheckAll();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('llms-txt-generator.toggleDirectory', (item: FileTreeItem) => {
        // Toggle expansion
        // We can't know the current state easily from here without tracking it in model or trusting tree view.
        // But the user clicked it, so they want to toggle.
        // We can use the 'expand' option. 
        // If it's collapsed, we expand. If expanded, we collapse.
        // But how do we know? item.collapsibleState is static initial state.
        
        // Trick: reveal it. If we pick an arbitrary state, say Expand, it opens.
        // To toggle, we might need to rely on native click behavior?
        // But the user said "click on the directory itself nothing happens".
        // This is because we have a TreeDataProvider but maybe didn't set collapsibleState correctly or the item itself is handling clicks differently?
        // Actually, in TreeView, clicking the label usually selects. Clicking the twisty expands.
        // To make clicking the label expand, we need to programmatically expand.
        // But vscode API `reveal` doesn't return state.
        // Let's force expand for now, or just trust standard behavior?
        // User wants standard behavior on the label. 
        // We can try to just reveal with expand: true. If already expanded, it does nothing?
        // Or we use `expand: !current`. We don't know current.
        
        // Actually, typically we just want to expand. If user clicks a folder, they usually want to see inside.
        // Let's Expand.
        treeView.reveal(item, { expand: true, focus: false, select: true });
        // Getting "toggle" behavior (close if open) is hard without state tracking.
        // But "Expand" is better than "Nothing".
    }));
}

export function deactivate() {}
