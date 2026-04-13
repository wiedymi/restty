<script lang="ts">
  import {
    TERMINAL_CLEAR_EVENT,
    TERMINAL_FONT_SIZE_EVENT,
    TERMINAL_INIT_EVENT,
    TERMINAL_PAUSE_EVENT,
    TERMINAL_RENDERER_EVENT,
    type ShellStringValueDetail,
  } from "../../../../lib/shell-events.ts";
  import { terminalShellState } from "../stores/shell-state.ts";

  function dispatchTerminalEvent(type: string) {
    window.dispatchEvent(new CustomEvent(type));
  }

  function handleFontSizeEvent(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    window.dispatchEvent(
      new CustomEvent(TERMINAL_FONT_SIZE_EVENT, {
        detail: { value: input.value },
      }),
    );
  }

  function handleRendererEvent(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    window.dispatchEvent(
      new CustomEvent(TERMINAL_RENDERER_EVENT, {
        detail: { value: select.value },
      }),
    );
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
      {$terminalShellState.pauseLabel}
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
