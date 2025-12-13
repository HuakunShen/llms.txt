<script lang="ts">
  import { onMount } from 'svelte';
  import { vscode } from './vscode';

  interface Pattern {
    text: string;
    count: number;
  }

  let patterns: Pattern[] = [];
  let totalSelected = 0;

  onMount(() => {
    window.addEventListener('message', (event) => {
      const message = event.data;
      switch (message.command) {
        case 'initialState':
          patterns = message.patterns.map((p: string) => ({ text: p, count: 0 }));
          notifyExtension();
          break;
        case 'updateStats':
          totalSelected = message.totalSelected;
          if (message.stats) {
            message.stats.forEach((stat: { pattern: string; count: number }) => {
              const found = patterns.find((p) => p.text === stat.pattern);
              if (found) found.count = stat.count;
            });
            patterns = [...patterns]; // Trigger reactivity
          }
          break;
      }
    });

    vscode.postMessage({ command: 'requestInitialState' });
  });

  function addPattern() {
    patterns = [...patterns, { text: '', count: 0 }];
    // Focus last input (Svelte reactive update handles DOM, wait for tick? 
    // Or simpler: use action or autofocus prop logic. 
    // Quick hack: setTimeout or bind:this)
    setTimeout(() => {
      const inputs = document.querySelectorAll('.pattern-input');
      if (inputs.length > 0) {
        (inputs[inputs.length - 1] as HTMLElement).focus();
      }
    }, 0);
  }

  function removePattern(index: number) {
    patterns.splice(index, 1);
    patterns = [...patterns];
    notifyExtension();
  }

  function updatePattern(index: number, text: string) {
    patterns[index].text = text;
    // patterns = [...patterns]; // Not strictly needed if binding works, but ensuring 
    notifyExtension();
  }

  function handleKeydown(e: KeyboardEvent, index: number) {
      if (e.key === 'Enter') {
          e.preventDefault();
          // updatePattern already called via binding? or change event? 
          // input value is bound.
          addPattern();
      }
  }

  function notifyExtension() {
    const validPatterns = patterns
      .map((p) => p.text)
      .filter((t) => t.trim().length > 0);
    vscode.postMessage({
      command: 'updatePatterns',
      patterns: validPatterns,
    });
  }
  function generate() {
    vscode.postMessage({ command: 'generate' });
  }
</script>

<main class="container">
  <h2>Glob Patterns</h2>
  <div class="stats">Total Files Selected: {totalSelected}</div>
  <ul class="pattern-list">
    {#each patterns as pattern, index}
      <li class="pattern-item">
        <input
          class="pattern-input"
          placeholder="**/*.ts"
          bind:value={pattern.text}
          on:change={() => updatePattern(index, pattern.text)}
          on:keydown={(e) => handleKeydown(e, index)}
        />
        <span class="badge">{pattern.count !== undefined ? pattern.count : 0} matches</span>
        <button class="btn-remove" on:click={() => removePattern(index)}>✕</button>
      </li>
    {/each}
  </ul>
  <div class="actions">
    <button class="btn-add" on:click={addPattern}>Add Pattern</button>
    <button class="btn-generate" on:click={generate}>Generate llms.txt</button>
  </div>
</main>

<style>
  :global(body) {
    font-family: var(--vscode-font-family);
    padding: 20px;
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
    margin: 0;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
  }
  h2 {
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: 10px;
  }
  .stats {
    margin-bottom: 20px;
    font-weight: bold;
  }
  .pattern-list {
    list-style: none;
    padding: 0;
  }
  .pattern-item {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    background: var(--vscode-editor-lineHighlightBackground);
    padding: 8px;
    border-radius: 4px;
  }
  .pattern-input {
    flex-grow: 1;
    margin-right: 10px;
    background: transparent;
    border: none;
    color: inherit;
    font-size: 14px;
    outline: none;
  }
  .badge {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
    margin-right: 10px;
  }
  .btn-remove {
    cursor: pointer;
    color: var(--vscode-errorForeground);
    background: none;
    border: none;
    font-size: 16px;
  }
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }
  .btn-add {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 8px 16px;
    cursor: pointer;
    border-radius: 2px;
  }
  .btn-add:hover {
    background: var(--vscode-button-hoverBackground);
  }
  .btn-generate {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 8px 16px;
    cursor: pointer;
    border-radius: 2px;
  }
  .btn-generate:hover {
    background: var(--vscode-button-secondaryHoverBackground);
  }
</style>
