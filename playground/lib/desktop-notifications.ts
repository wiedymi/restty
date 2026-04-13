export type PlaygroundDesktopNotification = {
  title: string;
  body: string;
  source: "osc9" | "osc777";
  raw: string;
  paneId: number;
};

type NotificationSink = {
  getPermission: () => NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  notify: (title: string, options?: NotificationOptions) => void;
};

type CreateDesktopNotificationHandlerOptions = {
  sink?: NotificationSink | null;
  logInfo?: (message: string) => void;
};

export function createDesktopNotificationHandler({
  sink,
  logInfo = console.info,
}: CreateDesktopNotificationHandlerOptions = {}) {
  let permissionRequest: Promise<NotificationPermission> | null = null;

  return function handleDesktopNotification(notification: PlaygroundDesktopNotification) {
    const title = notification.title.trim() || "Terminal notification";
    const body = notification.body.trim();
    const prefix = `[notify][pane ${notification.paneId}][${notification.source}]`;
    logInfo(body ? `${prefix} ${title}: ${body}` : `${prefix} ${title}`);

    if (!sink) return;

    const showBrowserNotification = () => {
      try {
        sink.notify(title, body ? { body } : undefined);
      } catch {
        // Ignore browser notification failures in playground mode.
      }
    };

    const permission = sink.getPermission();
    if (permission === "granted") {
      showBrowserNotification();
      return;
    }

    if (permission !== "default") return;

    if (!permissionRequest) {
      permissionRequest = sink.requestPermission().catch(() => "denied");
    }

    void permissionRequest.then((result) => {
      if (result !== "granted") return;
      showBrowserNotification();
    });
  };
}
