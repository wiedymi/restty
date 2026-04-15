<script lang="ts">
  import { dispatchTerminalAction } from "../../../lib/shell-bridge.ts";
  import { terminalShellState } from "../stores/shell-state.ts";

  function handleFontSizeEvent(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    dispatchTerminalAction({ fontSize: input.value });
  }

  function handleRendererEvent(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    dispatchTerminalAction({ renderer: select.value });
  }
</script>

<section class="section">
  <div class="section-title">Terminal</div>
  <div class="btn-row">
    <button id="btnInit" type="button" onclick={() => dispatchTerminalAction({ command: "init" })}>
      Init
    </button>
    <button id="btnPause" type="button" onclick={() => dispatchTerminalAction({ command: "pause" })}>
      {$terminalShellState.pauseLabel}
    </button>
    <button id="btnClear" type="button" onclick={() => dispatchTerminalAction({ command: "clear" })}>
      Clear
    </button>
  </div>
  <div class="field-row">
    <label>
      <span>Renderer</span>
      <select id="rendererSelect" value={$terminalShellState.renderer} onchange={handleRendererEvent}>
        <option value="auto">Auto</option>
        <option value="webgpu">WebGPU</option>
        <option value="webgl2">WebGL2</option>
      </select>
    </label>
    <label>
      <span>Font</span>
      <input
        id="fontSize"
        type="number"
        min="10"
        max="64"
        step="1"
        value={$terminalShellState.fontSize}
        oninput={handleFontSizeEvent}
      />
    </label>
  </div>
</section>
