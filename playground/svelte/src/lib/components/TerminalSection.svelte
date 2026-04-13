<script lang="ts">
  const TERMINAL_INIT_EVENT = "restty:playground-terminal-init";
  const TERMINAL_PAUSE_EVENT = "restty:playground-terminal-pause";
  const TERMINAL_CLEAR_EVENT = "restty:playground-terminal-clear";
  const TERMINAL_FONT_SIZE_EVENT = "restty:playground-terminal-font-size-change";
  const TERMINAL_RENDERER_EVENT = "restty:playground-terminal-renderer-change";

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
      <select id="rendererSelect" onchange={handleRendererEvent}>
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
        value="18"
        oninput={handleFontSizeEvent}
        onchange={handleFontSizeEvent}
      />
    </label>
  </div>
</section>
