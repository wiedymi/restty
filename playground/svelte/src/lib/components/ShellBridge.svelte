<script lang="ts">
  import { onMount } from "svelte";
  import { startShellStateBridge } from "../stores/shell-state.ts";

  document.documentElement.dataset.playgroundShell = "svelte";

  onMount(() => startShellStateBridge());
</script>
