<script lang="ts">
  const TERMINAL_INIT_EVENT = "restty:playground-terminal-init";
  const TERMINAL_PAUSE_EVENT = "restty:playground-terminal-pause";
  const TERMINAL_CLEAR_EVENT = "restty:playground-terminal-clear";

  function dispatchTerminalEvent(type: string) {
    window.dispatchEvent(new CustomEvent(type));
  }
</script>

<section class="section">
  <div class="section-title">Terminal</div>
  <div class="btn-row">
    <button id="btnInit" type="button" onclick={() => dispatchTerminalEvent(TERMINAL_INIT_EVENT)}>
      Init
    </button>
    <button
      id="btnPause"
      type="button"
      onclick={() => dispatchTerminalEvent(TERMINAL_PAUSE_EVENT)}
    >
      Pause
    </button>
    <button
      id="btnClear"
      type="button"
      onclick={() => dispatchTerminalEvent(TERMINAL_CLEAR_EVENT)}
    >
      Clear
    </button>
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
