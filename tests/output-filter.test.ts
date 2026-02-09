import { expect, test } from "bun:test";
import { OutputFilter } from "../src/input/output";

test("output filter replies to XTVERSION query (CSI > q)", () => {
  const replies: string[] = [];
  const filter = new OutputFilter({
    getCursorPosition: () => ({ row: 1, col: 1 }),
    sendReply: (data) => replies.push(data),
    mouse: {
      handleModeSeq: () => false,
    } as any,
  });

  const out = filter.filter("\x1b[>q");
  expect(out).toBe("");
  expect(replies.length).toBe(1);
  expect(replies[0]).toContain("P>|ghostty");
});

test("output filter replies to XTWINOPS size queries", () => {
  const replies: string[] = [];
  const filter = new OutputFilter({
    getCursorPosition: () => ({ row: 1, col: 1 }),
    sendReply: (data) => replies.push(data),
    mouse: {
      handleModeSeq: () => false,
    } as any,
    getWindowMetrics: () => ({
      rows: 46,
      cols: 153,
      widthPx: 1836,
      heightPx: 1012,
      cellWidthPx: 12,
      cellHeightPx: 22,
    }),
  });

  expect(filter.filter("\x1b[14t")).toBe("");
  expect(filter.filter("\x1b[16t")).toBe("");
  expect(filter.filter("\x1b[18t")).toBe("");
  expect(replies).toEqual(["\x1b[4;1012;1836t", "\x1b[6;22;12t", "\x1b[8;46;153t"]);
});

test("output filter preserves unhandled OSC 8 hyperlinks (BEL terminator)", () => {
  const filter = new OutputFilter({
    getCursorPosition: () => ({ row: 1, col: 1 }),
    sendReply: () => {},
    mouse: {
      handleModeSeq: () => false,
    } as any,
  });

  const input = "\x1b]8;;https://example.com\x07click me\x1b]8;;\x07\n";
  expect(filter.filter(input)).toBe(input);
});

test("output filter preserves unhandled OSC 8 hyperlinks (ST terminator)", () => {
  const filter = new OutputFilter({
    getCursorPosition: () => ({ row: 1, col: 1 }),
    sendReply: () => {},
    mouse: {
      handleModeSeq: () => false,
    } as any,
  });

  const input = "\x1b]8;;https://example.com\x1b\\click me\x1b]8;;\x1b\\\n";
  expect(filter.filter(input)).toBe(input);
});

test("output filter tracks synchronized output mode without swallowing sequence", () => {
  const filter = new OutputFilter({
    getCursorPosition: () => ({ row: 1, col: 1 }),
    sendReply: () => {},
    mouse: {
      handleModeSeq: () => false,
    } as any,
  });

  expect(filter.isSynchronizedOutput()).toBe(false);
  expect(filter.filter("\x1b[?2026h")).toBe("\x1b[?2026h");
  expect(filter.isSynchronizedOutput()).toBe(true);
  expect(filter.filter("\x1b[?2026l")).toBe("\x1b[?2026l");
  expect(filter.isSynchronizedOutput()).toBe(false);
});

test("output filter does not treat CSI ? 1048 as alt-screen", () => {
  const filter = new OutputFilter({
    getCursorPosition: () => ({ row: 1, col: 1 }),
    sendReply: () => {},
    mouse: {
      handleModeSeq: () => false,
    } as any,
  });

  expect(filter.isAltScreen()).toBe(false);
  expect(filter.filter("\x1b[?1048h")).toBe("\x1b[?1048h");
  expect(filter.isAltScreen()).toBe(false);
  expect(filter.filter("\x1b[?1048l")).toBe("\x1b[?1048l");
  expect(filter.isAltScreen()).toBe(false);
});

test("output filter tracks alt-screen with CSI ? 1049", () => {
  const filter = new OutputFilter({
    getCursorPosition: () => ({ row: 1, col: 1 }),
    sendReply: () => {},
    mouse: {
      handleModeSeq: () => false,
    } as any,
  });

  expect(filter.isAltScreen()).toBe(false);
  expect(filter.filter("\x1b[?1049h")).toBe("\x1b[?1049h");
  expect(filter.isAltScreen()).toBe(true);
  expect(filter.filter("\x1b[?1049l")).toBe("\x1b[?1049l");
  expect(filter.isAltScreen()).toBe(false);
});

test("output filter tracks OSC 133 click_events prompt state", () => {
  const filter = new OutputFilter({
    getCursorPosition: () => ({ row: 1, col: 1 }),
    sendReply: () => {},
    mouse: {
      handleModeSeq: () => false,
    } as any,
  });

  expect(filter.isPromptClickEventsEnabled()).toBe(false);
  expect(filter.encodePromptClickEvent({ row: 3, col: 7 })).toBe("");

  const seqA = "\x1b]133;A;click_events=1\x07";
  expect(filter.filter(seqA)).toBe(seqA);
  expect(filter.isPromptClickEventsEnabled()).toBe(true);
  expect(filter.encodePromptClickEvent({ row: 3, col: 7 })).toBe("\x1b[<0;8;4M");

  const seqC = "\x1b]133;C\x07";
  expect(filter.filter(seqC)).toBe(seqC);
  expect(filter.isPromptClickEventsEnabled()).toBe(false);

  const seqD = "\x1b]133;D\x07";
  expect(filter.filter(seqD)).toBe(seqD);
  expect(filter.isPromptClickEventsEnabled()).toBe(false);

  const seqB = "\x1b]133;B\x07";
  expect(filter.filter(seqB)).toBe(seqB);
  expect(filter.isPromptClickEventsEnabled()).toBe(true);

  const disable = "\x1b]133;A;click_events=0\x07";
  expect(filter.filter(disable)).toBe(disable);
  expect(filter.isPromptClickEventsEnabled()).toBe(false);
});

test("output filter disables prompt click events in alt-screen", () => {
  const filter = new OutputFilter({
    getCursorPosition: () => ({ row: 1, col: 1 }),
    sendReply: () => {},
    mouse: {
      handleModeSeq: () => false,
    } as any,
  });

  const enable = "\x1b]133;A;click_events=1\x07";
  expect(filter.filter(enable)).toBe(enable);
  expect(filter.isPromptClickEventsEnabled()).toBe(true);

  expect(filter.filter("\x1b[?1049h")).toBe("\x1b[?1049h");
  expect(filter.isPromptClickEventsEnabled()).toBe(false);

  expect(filter.filter("\x1b[?1049l")).toBe("\x1b[?1049l");
  expect(filter.isPromptClickEventsEnabled()).toBe(true);
});
