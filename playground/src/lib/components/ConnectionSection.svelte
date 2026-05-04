<script lang="ts">
  import { getConnectionUiState } from "../../../lib/connection-state.ts";
  import { dispatchConnectionInput, dispatchShellCommand } from "../../../lib/shell-bridge.ts";
  import { connectionShellState } from "../stores/shell-state.ts";

  $: connectionUi = getConnectionUiState($connectionShellState.backend);
  $: showPtyUrl = $connectionShellState.backend === "ws";
  $: showWebContainerFields = $connectionShellState.backend === "webcontainer";

  function handleConnectionBackendChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    dispatchConnectionInput({ backend: select.value });
  }

  function handlePtyUrlChange(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    dispatchConnectionInput({ ptyUrl: input.value });
  }

  function handleWebContainerCommandChange(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    dispatchConnectionInput({ webContainerCommand: input.value });
  }

  function handleWebContainerCwdChange(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    dispatchConnectionInput({ webContainerCwd: input.value });
  }
</script>

<section class="section">
  <div class="section-title">Connection</div>
  <div class="field-row">
    <label>
      <span>Backend</span>
      <select
        id="connectionBackend"
        value={$connectionShellState.backend}
        onchange={handleConnectionBackendChange}
      >
        <option value="just-bash">Just Bash</option>
        <option value="webcontainer">WebContainer</option>
        <option value="ws">OS PTY</option>
      </select>
    </label>
  </div>
  <div class="field-row">
    {#if showPtyUrl}
      <input
        id="ptyUrl"
        type="text"
        value={$connectionShellState.ptyUrl}
        placeholder="PTY URL"
        disabled={connectionUi.ptyUrlDisabled}
        oninput={handlePtyUrlChange}
      />
    {/if}
    <button
      id="btnPty"
      class:full-width={!showPtyUrl}
      type="button"
      onclick={() => dispatchShellCommand({ command: "pty-button" })}
    >
      {$connectionShellState.ptyButtonLabel}
    </button>
  </div>
  {#if showWebContainerFields}
    <div class="field-row">
      <input
        id="wcCommand"
        type="text"
        value={$connectionShellState.webContainerCommand}
        placeholder="WebContainer command"
        disabled={connectionUi.webContainerInputsDisabled}
        oninput={handleWebContainerCommandChange}
      />
      <input
        id="wcCwd"
        type="text"
        value={$connectionShellState.webContainerCwd}
        placeholder="WebContainer cwd"
        disabled={connectionUi.webContainerInputsDisabled}
        oninput={handleWebContainerCwdChange}
      />
    </div>
  {/if}
  <div id="connectionHint" class="hint">{connectionUi.hintText}</div>
</section>
