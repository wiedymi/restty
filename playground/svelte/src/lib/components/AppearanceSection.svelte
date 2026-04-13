<section class="section">
  <div class="section-title">Appearance</div>
  <div class="field-row">
    <select id="fontFamily">
      <option value="fira-code" selected>Base Font: Fira Code (default)</option>
      <option value="jetbrains">Base Font: JetBrains Mono</option>
    </select>
  </div>
  <div class="field-row">
    <select id="ligatures">
      <option value="on" selected>Ligatures: On</option>
      <option value="off">Ligatures: Off</option>
    </select>
    <select id="fontHinting">
      <option value="off" selected>Hinting: Off</option>
      <option value="on">Hinting: On</option>
    </select>
    <select id="fontHintTarget">
      <option value="auto" selected>Hint Target: Auto</option>
      <option value="light">Hint Target: Light</option>
      <option value="normal">Hint Target: Normal</option>
    </select>
  </div>
  <div class="hint">
    Bundled Fira Code is available in the playground for ligatures and fallback checks.
  </div>
  <div class="field-row">
    <select id="fontFamilyLocal">
      <option value="">Local Font: None</option>
    </select>
    <button id="btnLoadLocalFonts" type="button">Detect Local</button>
  </div>
  <div id="fontFamilyHint" class="hint">
    Main font family for all panes. Use Detect Local to add system fonts.
  </div>
  <div class="field-row">
    <select id="themeSelect">
      <option value="">Default Theme</option>
    </select>
    <label class="file-input">
      <input id="themeFile" type="file" accept=".conf,.theme,.txt" />
      <span>Upload</span>
    </label>
  </div>
  <div class="field-row">
    <select id="mouseMode">
      <option value="auto" selected>Mouse: Auto</option>
      <option value="on">Mouse: On</option>
      <option value="off">Mouse: Off</option>
    </select>
  </div>
  <div class="field-row">
    <select id="shaderPreset">
      <option value="none" selected>Shader: None</option>
      <option value="scanline">Shader: Scanline</option>
      <option value="aurora">Shader: Aurora</option>
      <option value="crt-lite">Shader: CRT Lite</option>
      <option value="mono-green">Shader: Mono Green</option>
    </select>
  </div>
</section>
