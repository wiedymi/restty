<script lang="ts">
  import { dispatchShellCommand } from "../../../lib/shell-bridge.ts";

  let settingsDialog: HTMLDialogElement | null = null;
  let isOpen = false;

  function syncSettingsDialog() {
    if (!settingsDialog) return;
    if (isOpen) {
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
    if (isOpen) return;
    isOpen = true;
    dispatchShellCommand({ command: "settings-open" });
  }

  function closeSettings() {
    if (!isOpen) return;
    isOpen = false;
    dispatchShellCommand({ command: "settings-close" });
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
    if (!isOpen || event.key !== "Escape") return;
    event.preventDefault();
    closeSettings();
  }

  $: syncSettingsDialog();
</script>

<svelte:window onkeydown={handleWindowKeydown} />

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

    <slot />
  </div>
</dialog>
