export type ResttyPastePayload = {
  kind: "text";
  text: string;
};

export function readPastePayloadFromDataTransfer(
  dataTransfer: DataTransfer | null | undefined,
): ResttyPastePayload | null {
  if (!dataTransfer) return null;
  const text = dataTransfer.getData("text/plain") || "";
  return text
    ? {
        kind: "text",
        text,
      }
    : null;
}
