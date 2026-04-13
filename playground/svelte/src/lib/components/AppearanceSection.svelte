<script lang="ts">
  import { listBuiltinThemeNames } from "../../../../../src/index.ts";
  import {
    THEME_FILE_RESET_EVENT,
  } from "../../../../lib/shell-events.ts";
  import type { ShaderPreset } from "../../../../lib/shader-presets.ts";
  import {
    dispatchFontFamilyChange,
    dispatchHintingChange,
    dispatchHintTargetChange,
    dispatchLigaturesChange,
    dispatchLoadLocalFonts,
    dispatchLocalFontFamilyChange,
    dispatchMouseModeChange,
    dispatchShaderPresetChange,
    dispatchThemeFileChange,
    dispatchThemeSelectChange,
  } from "../shell-dispatch.ts";
  import { appearanceShellState } from "../stores/shell-state.ts";

  const builtinThemeNames = listBuiltinThemeNames();

  let shaderPreset: ShaderPreset = "none";
  let themeFileInput: HTMLInputElement | null = null;

  function handleShaderPresetChange() {
    dispatchShaderPresetChange(shaderPreset);
  }

  function handleMouseModeChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    dispatchMouseModeChange(select.value);
  }

  function handleThemeSelectChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    dispatchThemeSelectChange(select.value);
  }

  function handleThemeFileChange(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    dispatchThemeFileChange(input.files?.[0] ?? null);
  }

  function handleWindowThemeFileReset() {
    if (themeFileInput) {
      themeFileInput.value = "";
    }
  }

  function handleLigaturesChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    dispatchLigaturesChange(select.value);
  }

  function handleFontFamilyChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    dispatchFontFamilyChange(select.value);
  }

  function handleLocalFontFamilyChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    dispatchLocalFontFamilyChange(select.value);
  }

  function handleHintingChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    dispatchHintingChange(select.value);
  }

  function handleHintTargetChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    dispatchHintTargetChange(select.value);
  }

  function handleLoadLocalFonts() {
    dispatchLoadLocalFonts();
  }
</script>

<svelte:window on:restty:playground-theme-file-reset={handleWindowThemeFileReset} />

<section class="section">
  <div class="section-title">Appearance</div>
  <div class="field-row">
    <select id="fontFamily" value={$appearanceShellState.fontFamily} onchange={handleFontFamilyChange}>
      <option value="fira-code">Base Font: Fira Code (default)</option>
      <option value="jetbrains">Base Font: JetBrains Mono</option>
    </select>
  </div>
  <div class="field-row">
    <select
      id="ligatures"
      value={$appearanceShellState.ligatures}
      onchange={handleLigaturesChange}
    >
      <option value="on">Ligatures: On</option>
      <option value="off">Ligatures: Off</option>
    </select>
    <select
      id="fontHinting"
      value={$appearanceShellState.fontHinting}
      onchange={handleHintingChange}
    >
      <option value="off">Hinting: Off</option>
      <option value="on">Hinting: On</option>
    </select>
    <select
      id="fontHintTarget"
      value={$appearanceShellState.fontHintTarget}
      onchange={handleHintTargetChange}
    >
      <option value="auto">Hint Target: Auto</option>
      <option value="light">Hint Target: Light</option>
      <option value="normal">Hint Target: Normal</option>
    </select>
  </div>
  <div class="hint">
    Bundled Fira Code is available in the playground for ligatures and fallback checks.
  </div>
  <div class="field-row">
    <select
      id="fontFamilyLocal"
      value={$appearanceShellState.localFontValue}
      disabled={$appearanceShellState.localFontSelectDisabled}
      onchange={handleLocalFontFamilyChange}
    >
      {#each $appearanceShellState.localFontOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
    <button
      id="btnLoadLocalFonts"
      type="button"
      disabled={$appearanceShellState.loadLocalFontsDisabled}
      onclick={handleLoadLocalFonts}
    >
      Detect Local
    </button>
  </div>
  <div id="fontFamilyHint" class="hint">{$appearanceShellState.localFontHintText}</div>
  <div class="field-row">
    <select
      id="themeSelect"
      value={$appearanceShellState.themeSelectValue}
      onchange={handleThemeSelectChange}
    >
      <option value="">Default Theme</option>
      {#each builtinThemeNames as name}
        <option value={name}>{name}</option>
      {/each}
    </select>
    <label class="file-input">
      <input
        bind:this={themeFileInput}
        id="themeFile"
        type="file"
        accept=".conf,.theme,.txt"
        onchange={handleThemeFileChange}
      />
      <span>Upload</span>
    </label>
  </div>
  <div class="field-row">
    <select id="mouseMode" value={$appearanceShellState.mouseMode} onchange={handleMouseModeChange}>
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
