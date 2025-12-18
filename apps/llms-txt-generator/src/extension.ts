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

	// Track expanded directories so "click-to-toggle" can collapse too.
	// (Without this, our folder click command can only ever expand.)
	const expandedElements = new Set<string>();
	context.subscriptions.push(treeView.onDidExpandElement((e) => {
		const item = e.element as FileTreeItem;
		expandedElements.add(item.uri.toString());
	}));
	context.subscriptions.push(treeView.onDidCollapseElement((e) => {
		const item = e.element as FileTreeItem;
		expandedElements.delete(item.uri.toString());
	}));

	// ... (keep existing checkbox listener) ...
	context.subscriptions.push(treeView.onDidChangeCheckboxState(e => {
		for (const [item] of e.items) {
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

	context.subscriptions.push(vscode.commands.registerCommand('llms-txt-generator.toggleDirectory', async (item: FileTreeItem) => {
		const key = item.uri.toString();

		// Ensure the tree view has focus/selection so list actions apply to it.
		await treeView.reveal(item, { focus: true, select: true });

		if (expandedElements.has(key)) {
			// Collapse the currently selected element in the focused tree.
			await vscode.commands.executeCommand('list.collapse');
			expandedElements.delete(key);
		} else {
			await treeView.reveal(item, { expand: true, focus: true, select: true });
			expandedElements.add(key);
		}
	}));
}

export function deactivate() {}
