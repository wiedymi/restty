<script lang="ts">
  import {
    getConnectionUiState,
    type ConnectionBackend,
  } from "../../../../lib/pty-connection.ts";

  let connectionBackend: ConnectionBackend = "webcontainer";
  let ptyUrl = "ws://localhost:8787/pty";
  let wcCommand = "jsh";
  let wcCwd = "/";

  $: connectionUi = getConnectionUiState(connectionBackend);
</script>

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
    <button id="btnPty">Connect</button>
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
