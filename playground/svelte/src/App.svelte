<script lang="ts">
  import { onMount } from "svelte";
  import AppearanceSection from "./lib/components/AppearanceSection.svelte";
  import ConnectionSection from "./lib/components/ConnectionSection.svelte";
  import DemoSection from "./lib/components/DemoSection.svelte";
  import SettingsShell from "./lib/components/SettingsShell.svelte";
  import TerminalSection from "./lib/components/TerminalSection.svelte";
  import { startShellStateBridge } from "./lib/stores/shell-state.ts";

  onMount(() => startShellStateBridge());
</script>

<svelte:head>
  <title>restty Playground</title>
</svelte:head>

<main id="paneRoot" class="pane-root"></main>

<SettingsShell>
  <TerminalSection />

  <ConnectionSection />

  <AppearanceSection />

  <DemoSection />
</SettingsShell>
