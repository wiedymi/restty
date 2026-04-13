import type { ResttyConfig } from "../surface/restty";

export function createCompatAppOptions(
  userTerminalConfig: ResttyConfig["terminal"],
  emitData: (data: string) => void,
): ResttyConfig["terminal"] {
  return (context) => {
    const resolved =
      typeof userTerminalConfig === "function"
        ? userTerminalConfig(context)
        : (userTerminalConfig ?? {});
    const userBeforeInput = resolved.beforeInput;
    return {
      ...resolved,
      beforeInput: ({ text, source }) => {
        const maybeNext = userBeforeInput?.({ text, source });
        if (maybeNext === null) return null;
        const nextText = maybeNext === undefined ? text : maybeNext;
        if (source !== "pty" && nextText) {
          emitData(nextText);
        }
        return nextText;
      },
    };
  };
}
