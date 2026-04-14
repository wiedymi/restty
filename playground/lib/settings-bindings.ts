type TargetLike = Pick<EventTarget, "addEventListener" | "removeEventListener">;

type NullableTarget = TargetLike | null | undefined;

type Disposer = () => void;
function listen(
  target: NullableTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions | boolean,
): Disposer {
  if (!target) return () => {};
  target.addEventListener(type, listener, options);
  return () => {
    target.removeEventListener(type, listener, options);
  };
}

export function bindLegacySettingsControls(options: {
  target: Window & TargetLike;
  settingsDialog: (HTMLDialogElement & TargetLike) | null;
  settingsFab: NullableTarget;
  settingsClose: NullableTarget;
  onOpen: () => void;
  onClose: () => void;
}): Disposer {
  const disposers: Disposer[] = [];

  disposers.push(
    listen(options.settingsFab, "click", options.onOpen),
    listen(options.settingsClose, "click", options.onClose),
    listen(options.settingsDialog, "click", (event) => {
      if (event.target !== options.settingsDialog) return;
      options.onClose();
    }),
    listen(options.settingsDialog, "cancel", (event) => {
      event.preventDefault();
      options.onClose();
    }),
    listen(
      options.target,
      "keydown",
      (event) => {
        if ((event as KeyboardEvent).key !== "Escape") return;
        options.onClose();
      },
      { capture: true },
    ),
  );

  return () => {
    for (const dispose of disposers) dispose();
  };
}
