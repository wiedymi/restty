<script lang="ts">
  import {
    FONT_FAMILY_LOCAL_CHANGE_EVENT,
    FONT_FAMILY_CHANGE_EVENT,
    FONT_FAMILY_STATE_EVENT,
    FONT_HINT_TARGET_CHANGE_EVENT,
    FONT_HINTING_CHANGE_EVENT,
    FONT_LIGATURES_CHANGE_EVENT,
    FONT_RENDERING_STATE_EVENT,
    LOAD_LOCAL_FONTS_EVENT,
    MOUSE_MODE_CHANGE_EVENT,
    MOUSE_MODE_STATE_EVENT,
    SHADER_PRESET_CHANGE_EVENT,
    THEME_FILE_CHANGE_EVENT,
    THEME_SELECT_CHANGE_EVENT,
    THEME_SELECT_STATE_EVENT,
    type FontRenderingStateDetail,
    type ShellStringValueDetail,
  } from "../../../../lib/shell-events.ts";
  import type { ShaderPreset } from "../../../../lib/shader-presets.ts";

  let mouseMode = "auto";
  let ligatures = "on";
  let fontFamily = "fira-code";
  let fontHinting = "off";
  let fontHintTarget = "auto";
  let shaderPreset: ShaderPreset = "none";
  let themeSelectValue = "";

  function handleShaderPresetChange() {
    window.dispatchEvent(
      new CustomEvent(SHADER_PRESET_CHANGE_EVENT, {
        detail: { value: shaderPreset },
      }),
    );
  }

  function handleMouseModeChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    window.dispatchEvent(
      new CustomEvent(MOUSE_MODE_CHANGE_EVENT, {
        detail: { value: select.value },
      }),
    );
  }

  function handleWindowMouseModeState(event: Event) {
    const detail = (event as CustomEvent<ShellStringValueDetail>).detail;
    if (typeof detail?.value === "string") {
      mouseMode = detail.value;
    }
  }

  function handleWindowThemeSelectState(event: Event) {
    const detail = (event as CustomEvent<ShellStringValueDetail>).detail;
    if (typeof detail?.value === "string") {
      themeSelectValue = detail.value;
    }
  }

  function handleThemeSelectChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    window.dispatchEvent(
      new CustomEvent(THEME_SELECT_CHANGE_EVENT, {
        detail: { value: select.value },
      }),
    );
  }

  function handleWindowFontFamilyState(event: Event) {
    const detail = (event as CustomEvent<ShellStringValueDetail>).detail;
    if (typeof detail?.value === "string") {
      fontFamily = detail.value;
    }
  }

  function handleThemeFileChange(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    window.dispatchEvent(
      new CustomEvent(THEME_FILE_CHANGE_EVENT, {
        detail: { file: input.files?.[0] ?? null },
      }),
    );
  }

  function handleLigaturesChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    window.dispatchEvent(
      new CustomEvent(FONT_LIGATURES_CHANGE_EVENT, {
        detail: { value: select.value },
      }),
    );
  }

  function handleFontFamilyChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    window.dispatchEvent(
      new CustomEvent(FONT_FAMILY_CHANGE_EVENT, {
        detail: { value: select.value },
      }),
    );
  }

  function handleLocalFontFamilyChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    window.dispatchEvent(
      new CustomEvent(FONT_FAMILY_LOCAL_CHANGE_EVENT, {
        detail: { value: select.value },
      }),
    );
  }

  function handleHintingChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    window.dispatchEvent(
      new CustomEvent(FONT_HINTING_CHANGE_EVENT, {
        detail: { value: select.value },
      }),
    );
  }

  function handleHintTargetChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    window.dispatchEvent(
      new CustomEvent(FONT_HINT_TARGET_CHANGE_EVENT, {
        detail: { value: select.value },
      }),
    );
  }

  function handleLoadLocalFonts() {
    window.dispatchEvent(new CustomEvent(LOAD_LOCAL_FONTS_EVENT));
  }

  function handleWindowFontRenderingState(event: Event) {
    const detail = (event as CustomEvent<FontRenderingStateDetail>).detail;
    if (!detail) return;
    if (typeof detail.ligatures === "string") {
      ligatures = detail.ligatures;
    }
    if (typeof detail.fontHinting === "string") {
      fontHinting = detail.fontHinting;
    }
    if (typeof detail.fontHintTarget === "string") {
      fontHintTarget = detail.fontHintTarget;
    }
  }
</script>

<svelte:window
  on:restty:playground-font-family-state={handleWindowFontFamilyState}
  on:restty:playground-font-rendering-state={handleWindowFontRenderingState}
  on:restty:playground-mouse-mode-state={handleWindowMouseModeState}
  on:restty:playground-theme-select-state={handleWindowThemeSelectState}
/>

<section class="section">
  <div class="section-title">Appearance</div>
  <div class="field-row">
    <select id="fontFamily" bind:value={fontFamily} onchange={handleFontFamilyChange}>
      <option value="fira-code">Base Font: Fira Code (default)</option>
      <option value="jetbrains">Base Font: JetBrains Mono</option>
    </select>
  </div>
  <div class="field-row">
    <select id="ligatures" bind:value={ligatures} onchange={handleLigaturesChange}>
      <option value="on">Ligatures: On</option>
      <option value="off">Ligatures: Off</option>
    </select>
    <select id="fontHinting" bind:value={fontHinting} onchange={handleHintingChange}>
      <option value="off">Hinting: Off</option>
      <option value="on">Hinting: On</option>
    </select>
    <select id="fontHintTarget" bind:value={fontHintTarget} onchange={handleHintTargetChange}>
      <option value="auto">Hint Target: Auto</option>
      <option value="light">Hint Target: Light</option>
      <option value="normal">Hint Target: Normal</option>
    </select>
  </div>
  <div class="hint">
    Bundled Fira Code is available in the playground for ligatures and fallback checks.
  </div>
  <div class="field-row">
    <select id="fontFamilyLocal" onchange={handleLocalFontFamilyChange}>
      <option value="">Local Font: None</option>
    </select>
    <button id="btnLoadLocalFonts" type="button" onclick={handleLoadLocalFonts}>
      Detect Local
    </button>
  </div>
  <div id="fontFamilyHint" class="hint">
    Main font family for all panes. Use Detect Local to add system fonts.
  </div>
  <div class="field-row">
    <select id="themeSelect" bind:value={themeSelectValue} onchange={handleThemeSelectChange}>
      <option value="">Default Theme</option>
    </select>
    <label class="file-input">
      <input
        id="themeFile"
        type="file"
        accept=".conf,.theme,.txt"
        onchange={handleThemeFileChange}
      />
      <span>Upload</span>
    </label>
  </div>
  <div class="field-row">
    <select id="mouseMode" bind:value={mouseMode} onchange={handleMouseModeChange}>
      <option value="auto">Mouse: Auto</option>
      <option value="on">Mouse: On</option>
      <option value="off">Mouse: Off</option>
    </select>
  </div>
  <div class="field-row">
    <select id="shaderPreset" bind:value={shaderPreset} onchange={handleShaderPresetChange}>
      <option value="none">Shader: None</option>
      <option value="scanline">Shader: Scanline</option>
      <option value="aurora">Shader: Aurora</option>
      <option value="crt-lite">Shader: CRT Lite</option>
      <option value="mono-green">Shader: Mono Green</option>
    </select>
  </div>
</section>
