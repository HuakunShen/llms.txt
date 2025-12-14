import * as fs from 'fs';
import * as path from 'path';

export function generateLLMsTxt(files: string[], rootPath: string): string {
    let output = 'Selected Files Directory Structure:\n\n';
    
    // Generate Tree Structure
    // This is a simplified tree generation. 
    // Ideally we want to show the full tree of selected files.
    // For now, let's just list the relative paths of selected files or try to build a tree.
    // Building a tree string is a bit complex, let's stick to the example format.
    
    // 1. Build a mini tree structure of selected files
    const treeLines = generateTreeStructure(files, rootPath);
    output += treeLines + '\n\n';

    // 2. Append file contents
    for (const filePath of files) {
        const relativePath = path.relative(rootPath, filePath);
        const fileName = path.basename(filePath);
        output += `--- ${relativePath} ---\n\n`;
        
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            output += content + '\n\n';
        } catch (e) {
            output += `<Error reading file: ${e}>\n\n`;
        }
    }

    return output;
}

function generateTreeStructure(files: string[], rootPath: string): string {
    // This function creates a string representation of the directory tree for the selected files.
    // It's a visual preference. 
    // A simple implementation: sort files, print relative paths.
    // A better implementation: proper ascii tree.
    
    // Let's go with a simple list if tree generation is too heavy, 
    // but the user asked for:
    // └── ./
    //     ├── LICENSE
    //     ├── local.html
    //     └── README.md
    
    // We can use a library or write a simple recursive function.
    // Since we can't easily add more dependencies without approval/risk, let's write a simple one.
    
    const paths = files.map(f => path.relative(rootPath, f).split(path.sep));
    const tree: any = {};
    
    for (const p of paths) {
        let current = tree;
        for (const part of p) {
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part];
        }
    }
    
    return renderTree(tree, '.', '');
}

function renderTree(tree: any, name: string, prefix: string): string {
    const keys = Object.keys(tree).sort();
    let result = '';
    
    // If it's the root (.), just print it? The user example starts with "└── ./" which is a bit odd if top level.
    // Let's assume standard `tree` command output style but rooted at ./
    
    if (name === '.') {
        result += `└── ./\n`;
    }
    
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const isLast = i === keys.length - 1;
        const pointer = isLast ? '└── ' : '├── ';
        const nextPrefix = prefix + (isLast ? '    ' : '│   ');
        
        result += `${prefix}${pointer}${key}\n`;
        
        // If it has children (it is a directory equivalent in our trie if keys exist)
        if (Object.keys(tree[key]).length > 0) {
            result += renderTree(tree[key], key, nextPrefix);
        }
    }
    
    return result;
}
