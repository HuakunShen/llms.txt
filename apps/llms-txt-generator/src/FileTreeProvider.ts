import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';
import { FileTreeItem } from './FileTreeItem';

export class FileTreeProvider implements vscode.TreeDataProvider<FileTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileTreeItem | undefined | null | void> = new vscode.EventEmitter<FileTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private data: FileTreeItem[] = [];
    private ig = ignore();
    private workspaceRoot: string | undefined;

    constructor(private workspaceRootUri: vscode.Uri | undefined) {
        this.workspaceRoot = workspaceRootUri?.fsPath;
        if (this.workspaceRoot) {
            this.loadGitIgnore();
        }
        this.refresh();
    }

    refresh(): void {
        if (this.workspaceRoot) {
            this.loadGitIgnore();
            this.data = this.scanDirectory(this.workspaceRoot);
        }
        this._onDidChangeTreeData.fire();
    }

    private loadGitIgnore() {
        this.ig = ignore();
        if (!this.workspaceRoot) return;

        const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            try {
                const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
                this.ig.add(gitignoreContent);
            } catch (e) {
                console.error('Failed to read .gitignore', e);
            }
        }
        // Always ignore .git folder and node_modules by default if usually desired, but user said "Respect gitignore" specifically.
        // We should explicitly ignore .git as it's not usually in .gitignore but hidden.
        this.ig.add('.git');
    }

    private scanDirectory(dir: string): FileTreeItem[] {
        if (!this.workspaceRoot) return [];

        const items: FileTreeItem[] = [];
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const relativePath = path.relative(this.workspaceRoot, filePath);
                
                // Check if ignored
                if (this.ig.ignores(relativePath)) {
                    continue; // Skip ignored files entirely
                }

                let fileType = vscode.FileType.File;
                let stat;
                try {
                    stat = fs.statSync(filePath);
                } catch (e) {
                    continue;
                }

                if (stat.isDirectory()) {
                    fileType = vscode.FileType.Directory;
                }

                const item = new FileTreeItem(vscode.Uri.file(filePath), fileType, false); // Default unchecked
                
                if (fileType === vscode.FileType.Directory) {
                   const children = this.scanDirectory(filePath);
                   // Only add directory if it has visible children or scanning logic allows empty dirs? 
                   // Let's just add it.
                   item.children = children;
                }

                items.push(item);
            }
        } catch (e) {
            console.error(`Error scanning directory ${dir}:`, e);
        }
        
        // Sort: folders first, then files
        return items.sort((a, b) => {
            if (a.type === b.type) {
                return (a.label as string).localeCompare(b.label as string);
            }
            return a.type === vscode.FileType.Directory ? -1 : 1;
        });
    }

    getTreeItem(element: FileTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileTreeItem): vscode.ProviderResult<FileTreeItem[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No dependency in empty workspace');
            return Promise.resolve([]);
        }

        if (element) {
            return Promise.resolve(element.children || []);
        } else {
            return Promise.resolve(this.data);
        }
    }

    // Toggle checkbox
    toggleCheckbox(item: FileTreeItem) {
        const newState = !item.isChecked;
        this.setCheckStateRecursive(item, newState);
        this._onDidChangeTreeData.fire();
    }

    private setCheckStateRecursive(item: FileTreeItem, state: boolean) {
        item.setChecked(state);
        if (item.children) {
            item.children.forEach(child => this.setCheckStateRecursive(child, state));
        }
    }
    
    // Get all checked files
    public getCheckedFiles(): string[] {
        const files: string[] = [];
        const traverse = (items: FileTreeItem[]) => {
            for (const item of items) {
                if (item.type === vscode.FileType.File && item.isChecked) {
                    files.push(item.uri.fsPath);
                }
                if (item.children) {
                    traverse(item.children);
                }
            }
        };
        traverse(this.data);
        return files;
    }
}
