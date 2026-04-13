<script lang="ts">
  import {
    type ShellStringValueDetail,
  } from "../../../../lib/shell-events.ts";
  import {
    dispatchTerminalClear,
    dispatchTerminalFontSizeChange,
    dispatchTerminalInit,
    dispatchTerminalPause,
    dispatchTerminalRendererChange,
  } from "../shell-dispatch.ts";
  import { terminalShellState } from "../stores/shell-state.ts";

  function handleFontSizeEvent(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    dispatchTerminalFontSizeChange(input.value);
  }

  function handleRendererEvent(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    dispatchTerminalRendererChange(select.value);
  }
</script>

<section class="section">
  <div class="section-title">Terminal</div>
  <div class="btn-row">
    <button id="btnInit" type="button" onclick={dispatchTerminalInit}>
      Init
    </button>
    <button id="btnPause" type="button" onclick={dispatchTerminalPause}>
      {$terminalShellState.pauseLabel}
    </button>
    <button id="btnClear" type="button" onclick={dispatchTerminalClear}>
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
        onchange={handleFontSizeEvent}
      />
    </label>
  </div>
</section>
