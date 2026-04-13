<script lang="ts">
  import {
    TERMINAL_CLEAR_EVENT,
    TERMINAL_FONT_SIZE_EVENT,
    TERMINAL_INIT_EVENT,
    TERMINAL_PAUSE_EVENT,
    TERMINAL_RENDERER_EVENT,
    TERMINAL_STATE_EVENT,
    type ShellStringValueDetail,
    type TerminalStateDetail,
  } from "../../../../lib/shell-events.ts";

  let pauseLabel = "Pause";
  let renderer = "auto";
  let fontSize = "18";

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

  function handleWindowTerminalState(event: Event) {
    const detail = (event as CustomEvent<TerminalStateDetail>).detail;
    if (!detail) return;
    if (typeof detail.pauseLabel === "string") {
      pauseLabel = detail.pauseLabel;
    }
    if (typeof detail.renderer === "string") {
      renderer = detail.renderer;
    }
    if (detail.fontSize !== undefined && detail.fontSize !== null) {
      fontSize = String(detail.fontSize);
    }
  }
</script>

<svelte:window on:restty:playground-terminal-state={handleWindowTerminalState} />

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
      {pauseLabel}
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
      <select id="rendererSelect" bind:value={renderer} onchange={handleRendererEvent}>
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
        bind:value={fontSize}
        oninput={handleFontSizeEvent}
        onchange={handleFontSizeEvent}
      />
    </label>
  </div>
</section>
