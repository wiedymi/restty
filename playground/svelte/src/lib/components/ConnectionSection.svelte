<script lang="ts">
  import {
    getConnectionUiState,
    type ConnectionBackend,
  } from "../../../../lib/pty-connection.ts";
  import {
    dispatchConnectionBackendChange,
    dispatchPtyButton,
    dispatchPtyUrlChange,
    dispatchWebContainerCommandChange,
    dispatchWebContainerCwdChange,
  } from "../shell-dispatch.ts";
  import { connectionShellState } from "../stores/shell-state.ts";

  let connectionBackend: ConnectionBackend = "webcontainer";
  let ptyUrl = "ws://localhost:8787/pty";
  let wcCommand = "jsh";
  let wcCwd = "/";

  $: connectionUi = getConnectionUiState(connectionBackend);

  function handleConnectionBackendChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    dispatchConnectionBackendChange(select.value);
  }

  function handlePtyUrlChange(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    dispatchPtyUrlChange(input.value);
  }

  function handleWebContainerCommandChange(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    dispatchWebContainerCommandChange(input.value);
  }

  function handleWebContainerCwdChange(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    dispatchWebContainerCwdChange(input.value);
  }

</script>

<section class="section">
  <div class="section-title">Connection</div>
  <div class="field-row">
    <label>
      <span>Backend</span>
      <select
        id="connectionBackend"
        bind:value={connectionBackend}
        onchange={handleConnectionBackendChange}
      >
        <option value="ws">WebSocket PTY</option>
        <option value="webcontainer">WebContainer</option>
      </select>
    </label>
  </div>
  <div class="field-row">
    <input
      id="ptyUrl"
      type="text"
      bind:value={ptyUrl}
      placeholder="PTY URL"
      disabled={connectionUi.ptyUrlDisabled}
      oninput={handlePtyUrlChange}
      onchange={handlePtyUrlChange}
    />
    <button id="btnPty" type="button" onclick={dispatchPtyButton}>
      {$connectionShellState.ptyButtonLabel}
    </button>
  </div>
  <div class="field-row">
    <input
      id="wcCommand"
      type="text"
      bind:value={wcCommand}
      placeholder="WebContainer command"
      disabled={connectionUi.webContainerInputsDisabled}
      oninput={handleWebContainerCommandChange}
      onchange={handleWebContainerCommandChange}
    />
    <input
      id="wcCwd"
      type="text"
      bind:value={wcCwd}
      placeholder="WebContainer cwd"
      disabled={connectionUi.webContainerInputsDisabled}
      oninput={handleWebContainerCwdChange}
      onchange={handleWebContainerCwdChange}
    />
  </div>
  <div id="connectionHint" class="hint">{connectionUi.hintText}</div>
</section>
