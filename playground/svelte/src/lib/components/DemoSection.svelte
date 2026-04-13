<script lang="ts">
  import type { PlaygroundDemoKind } from "../../../../lib/demos.ts";

  const RUN_DEMO_EVENT = "restty:playground-demo-run";

  let demoKind: PlaygroundDemoKind = "basic";

  function runDemo() {
    window.dispatchEvent(
      new CustomEvent(RUN_DEMO_EVENT, {
        detail: { kind: demoKind },
      }),
    );
  }
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
    <button id="btnRunDemo" type="button" onclick={runDemo}>Run</button>
  </div>
</section>
