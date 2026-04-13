<section class="section">
  <div class="section-title">Terminal</div>
  <div class="btn-row">
    <button id="btnInit">Init</button>
    <button id="btnPause">Pause</button>
    <button id="btnClear">Clear</button>
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
