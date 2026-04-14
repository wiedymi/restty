type DocumentLike = Pick<Document, "getElementById">;

type DialogLike = HTMLDialogElement | null;

export type PlaygroundElements = {
  paneRoot: HTMLElement;
  settingsDialog: DialogLike;
};

function getRequiredElement(documentLike: DocumentLike, id: string): HTMLElement {
  const element = documentLike.getElementById(id) as HTMLElement | null;
  if (!element) {
    throw new Error(`missing #${id} element`);
  }
  return element;
}

export function queryPlaygroundElements(documentLike: DocumentLike): PlaygroundElements {
  return {
    paneRoot: getRequiredElement(documentLike, "paneRoot"),
    settingsDialog: documentLike.getElementById("settingsDialog") as HTMLDialogElement | null,
  };
}
