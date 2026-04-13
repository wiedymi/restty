<script lang="ts">
  import type { PlaygroundDemoKind } from "../../../../lib/demos.ts";
  import { dispatchDemoRun } from "../shell-dispatch.ts";
  import { demoShellState } from "../stores/shell-state.ts";

  function getDemoKindForValue(value: string): PlaygroundDemoKind {
    switch (value) {
      case "palette":
      case "unicode":
      case "anim":
        return value;
      case "basic":
      default:
        return "basic";
    }
  }

  function handleDemoKindChange(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    demoShellState.update((state) => ({
      ...state,
      kind: getDemoKindForValue(select.value),
    }));
  }
</script>

<section class="section">
  <div class="section-title">Demo</div>
  <div class="field-row">
    <select id="demoSelect" value={$demoShellState.kind} onchange={handleDemoKindChange}>
      <option value="basic">Basics</option>
      <option value="palette">Palette</option>
      <option value="unicode">Unicode</option>
      <option value="anim">Animation</option>
    </select>
    <button id="btnRunDemo" type="button" onclick={() => dispatchDemoRun($demoShellState.kind)}>
      Run
    </button>
  </div>
</section>
