<script lang="ts">
  import {
    getConnectionUiState,
    type ConnectionBackend,
  } from "../../../../lib/pty-connection.ts";
  import {
    PTY_BUTTON_EVENT,
    PTY_BUTTON_STATE_EVENT,
    type PtyButtonStateDetail,
  } from "../../../../lib/shell-events.ts";

  let connectionBackend: ConnectionBackend = "webcontainer";
  let ptyButtonLabel = "Connect PTY";
  let ptyUrl = "ws://localhost:8787/pty";
  let wcCommand = "jsh";
  let wcCwd = "/";

  $: connectionUi = getConnectionUiState(connectionBackend);

  function handlePtyButtonClick() {
    window.dispatchEvent(new CustomEvent(PTY_BUTTON_EVENT));
  }

  function handleWindowPtyButtonState(event: Event) {
    const detail = (event as CustomEvent<PtyButtonStateDetail>).detail;
    if (typeof detail?.label === "string") {
      ptyButtonLabel = detail.label;
    }
  }
</script>

<svelte:window on:restty:playground-pty-button-state={handleWindowPtyButtonState} />

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
      bind:value={ptyUrl}
      placeholder="PTY URL"
      disabled={connectionUi.ptyUrlDisabled}
    />
    <button id="btnPty" type="button" onclick={handlePtyButtonClick}>{ptyButtonLabel}</button>
  </div>
  <div class="field-row">
    <input
      id="wcCommand"
      type="text"
      bind:value={wcCommand}
      placeholder="WebContainer command"
      disabled={connectionUi.webContainerInputsDisabled}
    />
    <input
      id="wcCwd"
      type="text"
      bind:value={wcCwd}
      placeholder="WebContainer cwd"
      disabled={connectionUi.webContainerInputsDisabled}
    />
  </div>
  <div id="connectionHint" class="hint">{connectionUi.hintText}</div>
</section>
