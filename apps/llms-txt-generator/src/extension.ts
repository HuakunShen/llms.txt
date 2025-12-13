import * as vscode from 'vscode';
import * as path from 'path';
import { FileTreeProvider } from './FileTreeProvider';
import { FileTreeItem } from './FileTreeItem';
import { generateLLMsTxt } from './generator';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "llms-txt-generator" is now active!');

	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri : undefined;

	const fileTreeProvider = new FileTreeProvider(rootPath);

    // Register TreeDataProvider
	// We can also use createTreeView to get access to the view object for events
    const treeView = vscode.window.createTreeView('llms-txt-generator.fileView', {
        treeDataProvider: fileTreeProvider,
        manageCheckboxStateManually: true // We want to handle recursive checking manually
    });

	// Handle Checkbox Changes
    context.subscriptions.push(treeView.onDidChangeCheckboxState(e => {
        // e.items is [treeItem, state][] - tuples of item and new state
        // But wait, the event gives us the items that CHANGED.
        // For 'manageCheckboxStateManually: true', we update our model.
        
        for (const [item, state] of e.items) {
             // item is FileTreeItem
             // state is the NEW state (Checked or Unchecked)
             const isChecked = state === vscode.TreeItemCheckboxState.Checked;
             fileTreeProvider.toggleCheckbox(item as FileTreeItem); 
             // Note: toggleCheckbox in provider might just flip the boolean. 
             // But here we receive the DESIRED state from the UI click? 
             // Actually, when manageCheckboxStateManually is true, checking a box fires this event.
             // We should update our model to reflect this.
             // My provider toggleCheckbox flips the state. Let's make sure it syncs with what the UI did or just use the toggle logic.
             // A better approach for the provider's `toggleCheckbox` might be `setChecked(state)`.
             // However, `toggleCheckbox` in provider does recursive logic. 
             // If I click a folder, I want recursive behavior.
             // The event returns the item that was clicked.
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
        
        // Open in new untitled document
        const dooc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'markdown' // or plaintext
        });
        await vscode.window.showTextDocument(dooc);
	}));
}

export function deactivate() {}
