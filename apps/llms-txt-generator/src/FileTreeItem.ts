import * as vscode from 'vscode';
import * as path from 'path';

export class FileTreeItem extends vscode.TreeItem {
    public children: FileTreeItem[] | undefined;
    public ignored: boolean = false;
    public parent: FileTreeItem | undefined;

    constructor(
        public readonly uri: vscode.Uri,
        public readonly type: vscode.FileType,
        public isChecked: boolean = false
    ) {
        super(uri, type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        
        this.checkboxState = isChecked ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
        this.contextValue = 'fileTreeItem';
        
        // Customize label to show just the name
        this.label = path.basename(uri.fsPath);

        if (type === vscode.FileType.Directory) {
            this.command = {
                command: 'llms-txt-generator.toggleDirectory',
                title: 'Toggle Directory',
                arguments: [this]
            };
        } else {
            // For files, open them when clicked
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [uri]
            };
        }
    }
    
    // Helper to update checkbox state
    public setChecked(checked: boolean) {
        this.isChecked = checked;
        this.checkboxState = checked ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
    }
}
