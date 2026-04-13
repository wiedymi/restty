import type { ResttyPaneDefinition, ResttyPaneSplitDirection } from "./types";

type SplitResizeState = {
  pointerId: number;
  axis: "x" | "y";
  divider: HTMLDivElement;
  first: HTMLElement;
  second: HTMLElement;
  startCoord: number;
  startFirst: number;
  total: number;
};

const getSplitBranches = (split: HTMLElement): HTMLElement[] => {
  const branches: HTMLElement[] = [];
  for (const child of Array.from(split.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.classList.contains("pane-divider")) continue;
    branches.push(child);
  }
  return branches;
};

const getRectEdgeDistanceSquared = (
  sourceRect: DOMRectReadOnly,
  targetRect: DOMRectReadOnly,
): number => {
  const dx = Math.max(targetRect.left - sourceRect.right, sourceRect.left - targetRect.right, 0);
  const dy = Math.max(targetRect.top - sourceRect.bottom, sourceRect.top - targetRect.bottom, 0);
  return dx ** 2 + dy ** 2;
};

const getRectCenterDistanceSquared = (
  sourceRect: DOMRectReadOnly,
  targetRect: DOMRectReadOnly,
): number => {
  const sourceCenterX = sourceRect.left + sourceRect.width * 0.5;
  const sourceCenterY = sourceRect.top + sourceRect.height * 0.5;
  const targetCenterX = targetRect.left + targetRect.width * 0.5;
  const targetCenterY = targetRect.top + targetRect.height * 0.5;
  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;
  return dx ** 2 + dy ** 2;
};

export function findClosestPaneToRect<TPane extends ResttyPaneDefinition>(
  sourceRect: DOMRectReadOnly | null,
  panes: Iterable<TPane>,
): TPane | null {
  if (!sourceRect) return null;
  let closestPane: TPane | null = null;
  let closestEdgeDistance = Number.POSITIVE_INFINITY;
  let closestCenterDistance = Number.POSITIVE_INFINITY;
  for (const candidate of panes) {
    const targetRect = candidate.container.getBoundingClientRect();
    const edgeDistance = getRectEdgeDistanceSquared(sourceRect, targetRect);
    const centerDistance = getRectCenterDistanceSquared(sourceRect, targetRect);
    if (
      edgeDistance < closestEdgeDistance ||
      (edgeDistance === closestEdgeDistance && centerDistance < closestCenterDistance)
    ) {
      closestPane = candidate;
      closestEdgeDistance = edgeDistance;
      closestCenterDistance = centerDistance;
    }
  }
  return closestPane;
}

export function collapseSplitAncestors(start: HTMLElement | null): void {
  let current = start;
  while (current && current.classList.contains("pane-split")) {
    const branches = getSplitBranches(current);
    if (branches.length > 1) return;
    const onlyChild = branches[0];
    const parent = current.parentElement;
    if (!parent || !onlyChild) return;
    const inheritedFlex = current.style.flex;
    if (inheritedFlex) {
      onlyChild.style.flex = inheritedFlex;
    } else {
      onlyChild.style.flex = "";
    }
    parent.replaceChild(onlyChild, current);
    current = parent;
  }
}

export function createSplitDividerFactory(options: {
  minPaneSize: number;
  requestLayoutSync: () => void;
}): {
  createSplitDivider: (direction: ResttyPaneSplitDirection) => HTMLDivElement;
} {
  let splitResizeState: SplitResizeState | null = null;

  const createSplitDivider = (direction: ResttyPaneSplitDirection): HTMLDivElement => {
    const divider = document.createElement("div");
    divider.className = `pane-divider ${direction === "vertical" ? "is-vertical" : "is-horizontal"}`;
    divider.setAttribute("role", "separator");
    divider.setAttribute("aria-orientation", direction === "vertical" ? "vertical" : "horizontal");

    const onPointerMove = (event: PointerEvent) => {
      const state = splitResizeState;
      if (!state || event.pointerId !== state.pointerId) return;
      event.preventDefault();

      const coord = state.axis === "x" ? event.clientX : event.clientY;
      const delta = coord - state.startCoord;
      const maxFirst = Math.max(options.minPaneSize, state.total - options.minPaneSize);
      const nextFirst = Math.min(maxFirst, Math.max(options.minPaneSize, state.startFirst + delta));
      const nextSecond = Math.max(options.minPaneSize, state.total - nextFirst);
      const firstPercent = (nextFirst / (nextFirst + nextSecond)) * 100;
      const secondPercent = 100 - firstPercent;
      state.first.style.flex = `0 0 ${firstPercent.toFixed(5)}%`;
      state.second.style.flex = `0 0 ${secondPercent.toFixed(5)}%`;
      options.requestLayoutSync();
    };

    const endResize = () => {
      if (!splitResizeState) return;
      splitResizeState.divider.classList.remove("is-dragging");
      document.body.classList.remove("is-resizing-split");
      splitResizeState = null;
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (!splitResizeState || event.pointerId !== splitResizeState.pointerId) return;
      try {
        divider.releasePointerCapture(splitResizeState.pointerId);
      } catch {
        // ignore capture release errors
      }
      divider.removeEventListener("pointermove", onPointerMove);
      divider.removeEventListener("pointerup", onPointerEnd);
      divider.removeEventListener("pointercancel", onPointerEnd);
      endResize();
    };

    divider.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const first = divider.previousElementSibling as HTMLElement | null;
      const second = divider.nextElementSibling as HTMLElement | null;
      const split = divider.parentElement as HTMLElement | null;
      if (!first || !second || !split) return;

      const splitRect = split.getBoundingClientRect();
      const firstRect = first.getBoundingClientRect();
      const axis: "x" | "y" = direction === "vertical" ? "x" : "y";
      const total = axis === "x" ? splitRect.width : splitRect.height;
      if (total <= 0) return;

      endResize();
      event.preventDefault();
      event.stopPropagation();

      splitResizeState = {
        pointerId: event.pointerId,
        axis,
        divider,
        first,
        second,
        startCoord: axis === "x" ? event.clientX : event.clientY,
        startFirst: axis === "x" ? firstRect.width : firstRect.height,
        total,
      };

      divider.classList.add("is-dragging");
      document.body.classList.add("is-resizing-split");
      divider.setPointerCapture(event.pointerId);
      divider.addEventListener("pointermove", onPointerMove);
      divider.addEventListener("pointerup", onPointerEnd);
      divider.addEventListener("pointercancel", onPointerEnd);
    });

    return divider;
  };

  return { createSplitDivider };
}
