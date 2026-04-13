<script lang="ts">
  import {
    getConnectionUiState,
    type ConnectionBackend,
  } from "../../lib/pty-connection.ts";

  const SETTINGS_OPEN_EVENT = "restty:playground-settings-open";
  const SETTINGS_CLOSE_EVENT = "restty:playground-settings-close";

  document.documentElement.dataset.playgroundShell = "svelte";

  let settingsDialog: HTMLDialogElement | null = null;
  let settingsOpen = false;
  let connectionBackend: ConnectionBackend = "webcontainer";

  function syncSettingsDialog() {
    if (!settingsDialog) return;
    if (settingsOpen) {
      if (!settingsDialog.open) {
        if (typeof settingsDialog.showModal === "function") {
          settingsDialog.showModal();
        } else {
          settingsDialog.setAttribute("open", "");
        }
      }
      return;
    }
    if (settingsDialog.open) {
      if (typeof settingsDialog.close === "function") {
        settingsDialog.close();
      } else {
        settingsDialog.removeAttribute("open");
      }
    }
  }

  function openSettings() {
    if (settingsOpen) return;
    window.dispatchEvent(new CustomEvent(SETTINGS_OPEN_EVENT));
    settingsOpen = true;
  }

  function closeSettings() {
    if (!settingsOpen) return;
    settingsOpen = false;
    window.dispatchEvent(new CustomEvent(SETTINGS_CLOSE_EVENT));
  }

  function handleDialogClick(event: MouseEvent) {
    if (event.target !== settingsDialog) return;
    closeSettings();
  }

  function handleDialogCancel(event: Event) {
    event.preventDefault();
    closeSettings();
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (!settingsOpen || event.key !== "Escape") return;
    event.preventDefault();
    closeSettings();
  }

  $: connectionUi = getConnectionUiState(connectionBackend);
  $: syncSettingsDialog();
</script>

<svelte:head>
  <title>restty Playground</title>
</svelte:head>

<svelte:window onkeydown={handleWindowKeydown} />

<main id="paneRoot" class="pane-root"></main>

<div class="settings-fab-stack">
  <a
    class="settings-fab settings-fab-link settings-fab-social"
    href="https://github.com/wiedymi/restty"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Open GitHub repository"
    title="GitHub"
  >
    <svg class="settings-fab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.57.1.78-.25.78-.55v-2.16c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.78 1.2 1.78 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.74.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.3 1.19-3.11-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.17 1.18A10.9 10.9 0 0 1 12 6.84c.97 0 1.95.13 2.86.39 2.2-1.49 3.16-1.18 3.16-1.18.64 1.59.24 2.77.12 3.06.74.81 1.19 1.85 1.19 3.11 0 4.43-2.7 5.4-5.27 5.68.42.36.79 1.07.79 2.17v3.22c0 .3.2.66.79.55A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z"
      />
    </svg>
  </a>
  <a
    class="settings-fab settings-fab-link settings-fab-text settings-fab-social"
    href="https://www.npmjs.com/package/restty"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Open npm package"
    title="npm"
  >
    <span>npm</span>
  </a>
  <button
    id="settingsFab"
    class="settings-fab"
    type="button"
    aria-label="Open settings"
    title="Settings"
    onclick={openSettings}
  >
    <svg class="settings-fab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94L14.5 2.5a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.5l-.36 2.82c-.58.22-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.6 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.62-.06.94s.02.63.06.94L2.72 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.82a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5l.25-2.82c.58-.22 1.13-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
      />
    </svg>
  </button>
</div>

<dialog
  bind:this={settingsDialog}
  id="settingsDialog"
  class="settings-dialog"
  onclick={handleDialogClick}
  oncancel={handleDialogCancel}
>
  <div class="panel settings-panel">
    <header>
      <h1>restty</h1>
      <button
        id="settingsClose"
        class="settings-close"
        type="button"
        aria-label="Close settings"
        onclick={closeSettings}
      >
        ✕
      </button>
    </header>

    <section class="section">
      <div class="section-title">Terminal</div>
      <div class="btn-row">
        <button id="btnInit">Init</button>
        <button id="btnPause">Pause</button>
        <button id="btnClear">Clear</button>
      </div>
      <div class="field-row">
        <label>
          <span>Renderer</span>
          <select id="rendererSelect">
            <option value="auto">Auto</option>
            <option value="webgpu">WebGPU</option>
            <option value="webgl2">WebGL2</option>
          </select>
        </label>
        <label>
          <span>Font</span>
          <input id="fontSize" type="number" min="10" max="64" step="1" value="18" />
        </label>
      </div>
    </section>

    <section class="section">
      <div class="section-title">Connection</div>
      <div class="field-row">
        <label>
          <span>Backend</span>
          <select id="connectionBackend" bind:value={connectionBackend}>
            <option value="ws">WebSocket PTY</option>
            <option value="webcontainer">WebContainer</option>
          </select>
        </label>
      </div>
      <div class="field-row">
        <input
          id="ptyUrl"
          type="text"
          value="ws://localhost:8787/pty"
          placeholder="PTY URL"
          disabled={connectionUi.ptyUrlDisabled}
        />
        <button id="btnPty">Connect</button>
      </div>
      <div class="field-row">
        <input
          id="wcCommand"
          type="text"
          value="jsh"
          placeholder="WebContainer command"
          disabled={connectionUi.webContainerInputsDisabled}
        />
        <input
          id="wcCwd"
          type="text"
          value="/"
          placeholder="WebContainer cwd"
          disabled={connectionUi.webContainerInputsDisabled}
        />
      </div>
      <div id="connectionHint" class="hint">{connectionUi.hintText}</div>
    </section>

    <section class="section">
      <div class="section-title">Appearance</div>
      <div class="field-row">
        <select id="fontFamily">
          <option value="fira-code" selected>Base Font: Fira Code (default)</option>
          <option value="jetbrains">Base Font: JetBrains Mono</option>
        </select>
      </div>
      <div class="field-row">
        <select id="ligatures">
          <option value="on" selected>Ligatures: On</option>
          <option value="off">Ligatures: Off</option>
        </select>
        <select id="fontHinting">
          <option value="off" selected>Hinting: Off</option>
          <option value="on">Hinting: On</option>
        </select>
        <select id="fontHintTarget">
          <option value="auto" selected>Hint Target: Auto</option>
          <option value="light">Hint Target: Light</option>
          <option value="normal">Hint Target: Normal</option>
        </select>
      </div>
      <div class="hint">
        Bundled Fira Code is available in the playground for ligatures and fallback checks.
      </div>
      <div class="field-row">
        <select id="fontFamilyLocal">
          <option value="">Local Font: None</option>
        </select>
        <button id="btnLoadLocalFonts" type="button">Detect Local</button>
      </div>
      <div id="fontFamilyHint" class="hint">
        Main font family for all panes. Use Detect Local to add system fonts.
      </div>
      <div class="field-row">
        <select id="themeSelect">
          <option value="">Default Theme</option>
        </select>
        <label class="file-input">
          <input id="themeFile" type="file" accept=".conf,.theme,.txt" />
          <span>Upload</span>
        </label>
      </div>
      <div class="field-row">
        <select id="mouseMode">
          <option value="auto" selected>Mouse: Auto</option>
          <option value="on">Mouse: On</option>
          <option value="off">Mouse: Off</option>
        </select>
      </div>
      <div class="field-row">
        <select id="shaderPreset">
          <option value="none" selected>Shader: None</option>
          <option value="scanline">Shader: Scanline</option>
          <option value="aurora">Shader: Aurora</option>
          <option value="crt-lite">Shader: CRT Lite</option>
          <option value="mono-green">Shader: Mono Green</option>
        </select>
      </div>
    </section>

    <section class="section">
      <div class="section-title">Demo</div>
      <div class="field-row">
        <select id="demoSelect">
          <option value="basic">Basics</option>
          <option value="palette">Palette</option>
          <option value="unicode">Unicode</option>
          <option value="anim">Animation</option>
        </select>
        <button id="btnRunDemo">Run</button>
      </div>
    </section>
  </div>
</dialog>
