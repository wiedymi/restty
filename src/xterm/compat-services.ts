import type { ResttyConfig } from "../surface/restty";

export function createCompatServicesConfig(
  userServicesConfig: ResttyConfig["services"],
  emitData: (data: string) => void,
): ResttyConfig["services"] {
  return (context) => {
    const resolved =
      typeof userServicesConfig === "function"
        ? userServicesConfig(context)
        : (userServicesConfig ?? {});
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
