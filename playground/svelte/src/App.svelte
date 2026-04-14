<script lang="ts">
  import AppearanceSection from "./lib/components/AppearanceSection.svelte";
  import ConnectionSection from "./lib/components/ConnectionSection.svelte";
  import DemoSection from "./lib/components/DemoSection.svelte";
  import ShellBridge from "./lib/components/ShellBridge.svelte";
  import SettingsShell from "./lib/components/SettingsShell.svelte";
  import TerminalSection from "./lib/components/TerminalSection.svelte";
</script>

<svelte:head>
  <title>restty Playground</title>
</svelte:head>

<ShellBridge />

<main id="paneRoot" class="pane-root"></main>

<SettingsShell>
  <TerminalSection />

  <ConnectionSection />

  <AppearanceSection />

  <DemoSection />
</SettingsShell>
