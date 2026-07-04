import { useEffect, useRef, useState } from "react";
import { Restty, getBuiltinTheme } from "restty";

const DEFAULT_PTY_URL = "ws://localhost:8787/pty";

export function App() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const resttyRef = useRef<Restty | null>(null);
  const ptyUrlRef = useRef(DEFAULT_PTY_URL);
  const [ptyUrl, setPtyUrl] = useState(DEFAULT_PTY_URL);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const restty = new Restty({
      root,
      surface: {
        shortcuts: true,
        paneStyles: true,
        searchUi: true,
        defaultContextMenu: {
          getPtyUrl: () => ptyUrlRef.current,
        },
      },
      terminal: {
        renderer: "auto",
        fontSize: 15,
        theme: getBuiltinTheme("Aizen Dark") ?? undefined,
      },
    });

    resttyRef.current = restty;
    restty.sendInput("React mounted restty. Connect to attach a shell.\r\n", "pty");

    return () => {
      restty.destroy();
      resttyRef.current = null;
    };
  }, []);

  function updatePtyUrl(next: string) {
    ptyUrlRef.current = next;
    setPtyUrl(next);
  }

  return (
    <main className="app-shell">
      <header className="toolbar">
        <label>
          PTY URL
          <input value={ptyUrl} onChange={(event) => updatePtyUrl(event.target.value)} />
        </label>
        <button type="button" onClick={() => resttyRef.current?.connectPty(ptyUrlRef.current)}>
          Connect
        </button>
        <button type="button" onClick={() => resttyRef.current?.disconnectPty()}>
          Disconnect
        </button>
        <button type="button" onClick={() => resttyRef.current?.splitActivePane("horizontal")}>
          Split
        </button>
      </header>
      <section ref={rootRef} className="terminal-root" aria-label="restty terminal" />
    </main>
  );
}
