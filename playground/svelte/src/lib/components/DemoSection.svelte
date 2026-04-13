<script lang="ts">
  import type { PlaygroundDemoKind } from "../../../../lib/demos.ts";
  import { dispatchDemoRun } from "../shell-dispatch.ts";

  let demoKind: PlaygroundDemoKind = "basic";
</script>

<section class="section">
  <div class="section-title">Demo</div>
  <div class="field-row">
    <select id="demoSelect" bind:value={demoKind}>
      <option value="basic">Basics</option>
      <option value="palette">Palette</option>
      <option value="unicode">Unicode</option>
      <option value="anim">Animation</option>
    </select>
    <button id="btnRunDemo" type="button" onclick={() => dispatchDemoRun(demoKind)}>Run</button>
  </div>
</section>
