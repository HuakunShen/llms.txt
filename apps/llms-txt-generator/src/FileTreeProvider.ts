import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import ignore from "ignore";
import { minimatch } from "minimatch";
import { FileTreeItem } from "./FileTreeItem";

export class FileTreeProvider implements vscode.TreeDataProvider<FileTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    FileTreeItem | undefined | null | void
  > = new vscode.EventEmitter<FileTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    FileTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

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
    if (!this.workspaceRoot) {
      return;
    }

    const gitignorePath = path.join(this.workspaceRoot, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      try {
        const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
        this.ig.add(gitignoreContent);
      } catch (e) {
        console.error("Failed to read .gitignore", e);
      }
    }
    // Always ignore .git folder and node_modules by default if usually desired, but user said "Respect gitignore" specifically.
    // We should explicitly ignore .git as it's not usually in .gitignore but hidden.
    this.ig.add(".git");
  }

  private scanDirectory(dir: string, parent?: FileTreeItem): FileTreeItem[] {
    if (!this.workspaceRoot) {
      return [];
    }

    const items: FileTreeItem[] = [];
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const relativePath = path.relative(this.workspaceRoot, filePath);

        if (this.ig.ignores(relativePath)) {
          continue;
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

        const item = new FileTreeItem(
          vscode.Uri.file(filePath),
          fileType,
          false
        );
        item.parent = parent; // Link parent

        if (fileType === vscode.FileType.Directory) {
          const children = this.scanDirectory(filePath, item);
          item.children = children;
        }

        items.push(item);
      }
    } catch (e) {
      console.error(`Error scanning directory ${dir}:`, e);
    }

    return items.sort((a, b) => {
      if (a.type === b.type) {
        return (a.label as string).localeCompare(b.label as string);
      }
      return a.type === vscode.FileType.Directory ? -1 : 1;
    });
  }

  // ... (keep getTreeItem, getChildren) ...

  getTreeItem(element: FileTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FileTreeItem): vscode.ProviderResult<FileTreeItem[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage("No dependency in empty workspace");
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve(element.children || []);
    } else {
      return Promise.resolve(this.data);
    }
  }

  getParent(element: FileTreeItem): vscode.ProviderResult<FileTreeItem> {
    return element.parent;
  }

  // Toggle checkbox
  toggleCheckbox(item: FileTreeItem) {
    const newState = !item.isChecked;
    this.setCheckStateRecursive(item, newState);
    this.updateParentCheckState(item.parent);
    this._onDidChangeTreeData.fire();
  }

  private setCheckStateRecursive(item: FileTreeItem, state: boolean) {
    item.setChecked(state);
    if (item.children) {
      item.children.forEach((child) =>
        this.setCheckStateRecursive(child, state)
      );
    }
  }

  // Update parent state based on children
  private updateParentCheckState(item: FileTreeItem | undefined) {
    if (!item) {
      return;
    }

    if (item.children) {
      const allChecked = item.children.every((child) => child.isChecked);
      // If all checked, parent is checked.
      // If NOT all checked, parent is unchecked.
      // If partial? VS Code API only supports True/False.
      // We use simple logic: Checked means "All descendants selected".
      // So if one child is unchecked, parent becomes unchecked.
      // But what if we check parent? It selects all recursive (via toggle logic).

      if (item.isChecked !== allChecked) {
        item.setChecked(allChecked);
        // Propagate up
        this.updateParentCheckState(item.parent);
      }
    }
  }

  public checkAll() {
    if (!this.workspaceRoot) {
      return;
    }
    const traverse = (items: FileTreeItem[]) => {
      for (const item of items) {
        item.setChecked(true);
        if (item.children) {
          traverse(item.children);
        }
      }
    };
    traverse(this.data);
    this._onDidChangeTreeData.fire();
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

  public uncheckAll() {
    if (!this.workspaceRoot) {
      return;
    }
    const traverse = (items: FileTreeItem[]) => {
      for (const item of items) {
        item.setChecked(false);
        if (item.children) {
          traverse(item.children);
        }
      }
    };
    traverse(this.data);
    this._onDidChangeTreeData.fire();
  }

  public searchAndSelect(pattern: string): FileTreeItem[] {
    if (!this.workspaceRoot) {
      return [];
    }

    const matchedItems: FileTreeItem[] = [];

    const traverse = (items: FileTreeItem[]) => {
      for (const item of items) {
        if (item.type === vscode.FileType.File) {
          const relativePath = path.relative(
            this.workspaceRoot!,
            item.uri.fsPath
          );
          if (minimatch(relativePath, pattern, { matchBase: true })) {
            this.setCheckStateRecursive(item, true);
            matchedItems.push(item);
          }
        }
        if (item.children) {
          traverse(item.children);
        }
      }
    };

    traverse(this.data);
    this._onDidChangeTreeData.fire();
    return matchedItems;
  }
}
