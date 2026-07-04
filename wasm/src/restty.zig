const std = @import("std");
const ghostty = @import("ghostty-vt");

pub const std_options: std.Options = ghostty.std_options;

const Allocator = std.mem.Allocator;

const ErrorCode = enum(u32) {
    ok = 0,
    invalid_handle = 1,
    out_of_memory = 2,
    invalid_arg = 3,
    internal = 4,
};

const CellFlags = struct {
    const hyperlink: u16 = 1 << 0;
    const has_grapheme: u16 = 1 << 1;
    const protected: u16 = 1 << 2;
};

const CursorInfo = extern struct {
    row: u16,
    col: u16,
    visible: u8,
    style: u8,
    blinking: u8,
    wide_tail: u8,
    color_rgba: u32,
    reserved: u32 = 0,
};

const SearchViewportSpan = extern struct {
    row: u16,
    start_col: u16,
    end_col: u16,
    selected: u8,
    reserved: u8 = 0,
};

const SearchStatus = extern struct {
    active: u8,
    pending: u8,
    complete: u8,
    reserved: u8 = 0,
    generation: u32,
    total_matches: u32,
    selected_index: i32,
};

const CellBuffers = struct {
    codepoints: []u32,
    content_tags: []u8,
    wide: []u8,
    flags: []u16,
    style_flags: []u16,
    underline_styles: []u8,
    link_ids: []u32,
    fg_rgba: []u32,
    bg_rgba: []u32,
    ul_rgba: []u32,
    grapheme_offsets: []u32,
    grapheme_lengths: []u32,
    row_selection_start: []i16,
    row_selection_end: []i16,

    pub fn init(alloc: Allocator, rows: u16, cols: u16) !CellBuffers {
        const cell_count: usize = @as(usize, rows) * @as(usize, cols);
        var result: CellBuffers = undefined;
        result.codepoints = try alloc.alloc(u32, cell_count);
        errdefer alloc.free(result.codepoints);
        result.content_tags = try alloc.alloc(u8, cell_count);
        errdefer alloc.free(result.content_tags);
        result.wide = try alloc.alloc(u8, cell_count);
        errdefer alloc.free(result.wide);
        result.flags = try alloc.alloc(u16, cell_count);
        errdefer alloc.free(result.flags);
        result.style_flags = try alloc.alloc(u16, cell_count);
        errdefer alloc.free(result.style_flags);
        result.underline_styles = try alloc.alloc(u8, cell_count);
        errdefer alloc.free(result.underline_styles);
        result.link_ids = try alloc.alloc(u32, cell_count);
        errdefer alloc.free(result.link_ids);
        result.fg_rgba = try alloc.alloc(u32, cell_count);
        errdefer alloc.free(result.fg_rgba);
        result.bg_rgba = try alloc.alloc(u32, cell_count);
        errdefer alloc.free(result.bg_rgba);
        result.ul_rgba = try alloc.alloc(u32, cell_count);
        errdefer alloc.free(result.ul_rgba);
        result.grapheme_offsets = try alloc.alloc(u32, cell_count);
        errdefer alloc.free(result.grapheme_offsets);
        result.grapheme_lengths = try alloc.alloc(u32, cell_count);
        errdefer alloc.free(result.grapheme_lengths);
        result.row_selection_start = try alloc.alloc(i16, rows);
        errdefer alloc.free(result.row_selection_start);
        result.row_selection_end = try alloc.alloc(i16, rows);
        errdefer alloc.free(result.row_selection_end);
        return result;
    }

    pub fn deinit(self: *CellBuffers, alloc: Allocator) void {
        alloc.free(self.codepoints);
        alloc.free(self.content_tags);
        alloc.free(self.wide);
        alloc.free(self.flags);
        alloc.free(self.style_flags);
        alloc.free(self.underline_styles);
        alloc.free(self.link_ids);
        alloc.free(self.fg_rgba);
        alloc.free(self.bg_rgba);
        alloc.free(self.ul_rgba);
        alloc.free(self.grapheme_offsets);
        alloc.free(self.grapheme_lengths);
        alloc.free(self.row_selection_start);
        alloc.free(self.row_selection_end);
    }
};

const CursorVisualStyle = @TypeOf(ghostty.RenderState.empty.cursor.visual_style);
const StreamAction = ghostty.StreamAction;
const VtHandlerFn = @TypeOf(ghostty.Terminal.vtHandler);
const ReadonlyHandler = @typeInfo(VtHandlerFn).@"fn".return_type.?;
const kitty_graphics_enabled = @hasDecl(ghostty.kitty.graphics, "Command");
const max_output_bytes: usize = 1024 * 1024;
const max_apc_debug_bytes: usize = 16 * 1024;
const max_apc_error_logs: u8 = 24;

const log = std.log.scoped(.restty_apc);

const KittyPlacementAbi = extern struct {
    image_id: u32,
    image_format: u8,
    _pad0: [3]u8 = .{ 0, 0, 0 },
    image_width: u32,
    image_height: u32,
    image_data_ptr: u32,
    image_data_len: u32,
    x: i32,
    y: i32,
    z: i32,
    width: u32,
    height: u32,
    cell_offset_x: u32,
    cell_offset_y: u32,
    source_x: u32,
    source_y: u32,
    source_width: u32,
    source_height: u32,
    placement_id: u32,
    placement_external: u8,
    _pad1: [3]u8 = .{ 0, 0, 0 },
};

const StreamHandler = struct {
    alloc: Allocator,
    term: *ghostty.Terminal,
    readonly: ReadonlyHandler,
    output: *std.ArrayListUnmanaged(u8),
    apc: ghostty.apc.Handler = .{},
    apc_debug: std.ArrayListUnmanaged(u8) = .{},
    apc_debug_truncated: bool = false,
    apc_error_logs_remaining: u8 = max_apc_error_logs,

    pub fn init(
        alloc: Allocator,
        term: *ghostty.Terminal,
        output: *std.ArrayListUnmanaged(u8),
    ) StreamHandler {
        return .{
            .alloc = alloc,
            .term = term,
            .readonly = .init(term),
            .output = output,
            .apc = .{},
            .apc_debug = .{},
            .apc_debug_truncated = false,
            .apc_error_logs_remaining = max_apc_error_logs,
        };
    }

    pub fn deinit(self: *StreamHandler) void {
        self.readonly.deinit();
        self.apc.deinit();
        self.apc_debug.deinit(self.alloc);
    }

    fn apcDebugReset(self: *StreamHandler) void {
        self.apc_debug.clearRetainingCapacity();
        self.apc_debug_truncated = false;
    }

    fn apcDebugCapture(self: *StreamHandler, byte: u8) void {
        if (self.apc_debug_truncated) return;
        if (self.apc_debug.items.len >= max_apc_debug_bytes) {
            self.apc_debug_truncated = true;
            return;
        }
        self.apc_debug.append(self.alloc, byte) catch {
            self.apc_debug_truncated = true;
        };
    }

    fn isBase64Byte(byte: u8) bool {
        return (byte >= 'A' and byte <= 'Z') or
            (byte >= 'a' and byte <= 'z') or
            (byte >= '0' and byte <= '9') or
            byte == '+' or
            byte == '/' or
            byte == '=';
    }

    fn logApcFailure(self: *StreamHandler) void {
        if (self.apc_error_logs_remaining == 0) return;
        const raw = self.apc_debug.items;
        if (raw.len == 0) return;

        // Only inspect Kitty APC packets.
        if (raw[0] != 'G') return;

        self.apc_error_logs_remaining -|= 1;

        const kitty = raw[1..];
        const sep_opt = std.mem.indexOfScalar(u8, kitty, ';');
        if (sep_opt == null) {
            const preview_len = @min(kitty.len, 64);
            log.warn(
                "kitty APC parse failed before payload control={s} bytes={d} truncated={} preview_hex={x}",
                .{
                    kitty[0..preview_len],
                    kitty.len,
                    self.apc_debug_truncated,
                    kitty[0..preview_len],
                },
            );
            return;
        }

        const sep = sep_opt.?;
        const control = kitty[0..sep];
        const payload = kitty[sep + 1 ..];

        var invalid_idx: ?usize = null;
        var invalid_byte: u8 = 0;
        for (payload, 0..) |byte, idx| {
            if (!isBase64Byte(byte)) {
                invalid_idx = idx;
                invalid_byte = byte;
                break;
            }
        }

        if (invalid_idx) |idx| {
            const win_start = idx -| 12;
            const win_end = @min(payload.len, idx + 13);
            log.warn(
                "kitty APC invalid payload byte control={s} payload_len={d} invalid=0x{x:0>2} at={d} around_hex={x} truncated={}",
                .{
                    control,
                    payload.len,
                    invalid_byte,
                    idx,
                    payload[win_start..win_end],
                    self.apc_debug_truncated,
                },
            );
            return;
        }

        const preview_len = @min(payload.len, 64);
        log.warn(
            "kitty APC parse failed control={s} payload_len={d} payload_mod4={d} truncated={} payload_preview_hex={x}",
            .{
                control,
                payload.len,
                payload.len % 4,
                self.apc_debug_truncated,
                payload[0..preview_len],
            },
        );
    }

    fn logKittyResponseError(
        self: *StreamHandler,
        cmd: *const ghostty.kitty.graphics.Command,
        resp: ghostty.kitty.graphics.Response,
    ) void {
        const action: []const u8 = switch (cmd.control) {
            .query => "q",
            .transmit => "t",
            .transmit_and_display => "T",
            .display => "p",
            .delete => "d",
            .transmit_animation_frame => "f",
            .control_animation => "a",
            .compose_animation => "c",
        };

        log.warn(
            "kitty graphics command failed action={s} quiet={} resp={s} resp_i={d} resp_I={d} resp_p={d} data_len={d}",
            .{
                action,
                cmd.quiet,
                resp.message,
                resp.id,
                resp.image_number,
                resp.placement_id,
                cmd.data.len,
            },
        );

        if (cmd.transmission()) |t| {
            log.warn(
                "kitty tx fields i={d} I={d} p={d} format={} medium={} s={d} v={d} S={d} O={d} m={} compression={}",
                .{
                    t.image_id,
                    t.image_number,
                    t.placement_id,
                    t.format,
                    t.medium,
                    t.width,
                    t.height,
                    t.size,
                    t.offset,
                    t.more_chunks,
                    t.compression,
                },
            );
        }

        if (cmd.display()) |d| {
            log.warn(
                "kitty display fields i={d} I={d} p={d} x={d} y={d} w={d} h={d} X={d} Y={d} c={d} r={d} C={} U={} z={d}",
                .{
                    d.image_id,
                    d.image_number,
                    d.placement_id,
                    d.x,
                    d.y,
                    d.width,
                    d.height,
                    d.x_offset,
                    d.y_offset,
                    d.columns,
                    d.rows,
                    d.cursor_movement,
                    d.virtual_placement,
                    d.z,
                },
            );
        }

        if (self.apc_debug.items.len > 0) {
            const preview_len = @min(self.apc_debug.items.len, 96);
            log.warn(
                "kitty APC preview_hex={x} bytes={d} truncated={}",
                .{
                    self.apc_debug.items[0..preview_len],
                    self.apc_debug.items.len,
                    self.apc_debug_truncated,
                },
            );
        }
    }

    fn appendOutput(self: *StreamHandler, bytes: []const u8) !void {
        if (bytes.len == 0) return;

        if (bytes.len >= max_output_bytes) {
            self.output.clearRetainingCapacity();
            try self.output.appendSlice(self.alloc, bytes[bytes.len - max_output_bytes ..]);
            return;
        }

        if (self.output.items.len + bytes.len > max_output_bytes) {
            const drop = self.output.items.len + bytes.len - max_output_bytes;
            if (drop >= self.output.items.len) {
                self.output.clearRetainingCapacity();
            } else {
                const remaining = self.output.items.len - drop;
                std.mem.copyForwards(
                    u8,
                    self.output.items[0..remaining],
                    self.output.items[drop..],
                );
                self.output.items.len = remaining;
            }
        }

        try self.output.appendSlice(self.alloc, bytes);
    }

    fn deviceAttributes(
        self: *StreamHandler,
        req: ghostty.DeviceAttributeReq,
    ) !void {
        switch (req) {
            .primary => try self.appendOutput("\x1b[?62;22;52c"),
            .secondary => try self.appendOutput("\x1b[>1;10;0c"),
            else => {},
        }
    }

    fn deviceStatusReport(
        self: *StreamHandler,
        req: ghostty.device_status.Request,
    ) !void {
        switch (req) {
            .operating_status => try self.appendOutput("\x1b[0n"),
            .cursor_position => {
                const pos: struct { x: usize, y: usize } = if (self.term.modes.get(.origin)) .{
                    .x = self.term.screens.active.cursor.x -| self.term.scrolling_region.left,
                    .y = self.term.screens.active.cursor.y -| self.term.scrolling_region.top,
                } else .{
                    .x = self.term.screens.active.cursor.x,
                    .y = self.term.screens.active.cursor.y,
                };

                var buf: [64]u8 = undefined;
                const resp = try std.fmt.bufPrint(&buf, "\x1b[{};{}R", .{
                    pos.y + 1,
                    pos.x + 1,
                });
                try self.appendOutput(resp);
            },
            else => {},
        }
    }

    fn queryKittyKeyboard(self: *StreamHandler) !void {
        var buf: [32]u8 = undefined;
        const resp = try std.fmt.bufPrint(&buf, "\x1b[?{}u", .{
            self.term.screens.active.kitty_keyboard.current().int(),
        });
        try self.appendOutput(resp);
    }

    fn apcEnd(self: *StreamHandler) !void {
        var cmd = self.apc.end() orelse {
            self.logApcFailure();
            self.apcDebugReset();
            return;
        };
        defer self.apcDebugReset();
        defer cmd.deinit(self.alloc);

        if (comptime !kitty_graphics_enabled) return;

        switch (cmd) {
            .kitty => |*kitty_cmd| {
                if (self.term.kittyGraphics(self.alloc, kitty_cmd)) |resp| {
                    if (!resp.ok()) {
                        self.logKittyResponseError(kitty_cmd, resp);
                    }
                    var buf: [1024]u8 = undefined;
                    var writer: std.Io.Writer = .fixed(&buf);
                    try resp.encode(&writer);
                    try self.appendOutput(writer.buffered());
                }
            },
            .glyph => {},
        }
    }

    pub fn vt(
        self: *StreamHandler,
        comptime action: StreamAction.Tag,
        value: StreamAction.Value(action),
    ) void {
        self.vtFallible(action, value) catch |err| {
            log.warn("error handling VT action action={} err={}", .{ action, err });
        };
    }

    fn vtFallible(
        self: *StreamHandler,
        comptime action: StreamAction.Tag,
        value: StreamAction.Value(action),
    ) !void {
        switch (action) {
            .device_attributes => try self.deviceAttributes(value),
            .device_status => try self.deviceStatusReport(value.request),
            .kitty_keyboard_query => try self.queryKittyKeyboard(),
            .apc_start => {
                self.apc.start();
                self.apcDebugReset();
            },
            .apc_put => {
                self.apcDebugCapture(value);
                self.apc.feed(self.alloc, value);
            },
            .apc_end => try self.apcEnd(),
            else => self.readonly.vt(action, value),
        }
    }
};

const TerminalStream = ghostty.Stream(StreamHandler);

const Restty = struct {
    alloc: Allocator,
    term: ghostty.Terminal,
    stream: TerminalStream,
    render_state: ghostty.RenderState,
    buffers: CellBuffers,
    graphemes: std.ArrayListUnmanaged(u32) = .{},
    link_offsets: std.ArrayListUnmanaged(u32) = .{},
    link_lengths: std.ArrayListUnmanaged(u32) = .{},
    link_buffer: std.ArrayListUnmanaged(u8) = .{},
    kitty_placements: std.ArrayListUnmanaged(KittyPlacementAbi) = .{},
    output: std.ArrayListUnmanaged(u8) = .{},
    cursor: CursorInfo = .{
        .row = 0,
        .col = 0,
        .visible = 0,
        .style = 0,
        .blinking = 0,
        .wide_tail = 0,
        .color_rgba = 0,
        .reserved = 0,
    },
    search: SearchState = .{},
    rows: u16,
    cols: u16,
};

const SearchState = struct {
    query: std.ArrayListUnmanaged(u8) = .{},
    screen_search: ?ghostty.search.Screen = null,
    viewport_search: ?ghostty.search.Viewport = null,
    viewport_matches: std.ArrayListUnmanaged(SearchViewportSpan) = .{},
    status: SearchStatus = .{
        .active = 0,
        .pending = 0,
        .complete = 0,
        .reserved = 0,
        .generation = 0,
        .total_matches = 0,
        .selected_index = -1,
    },
    active_screen_key: i32 = -1,
    viewport_dirty: bool = false,
    active_dirty: bool = false,

    fn deinit(self: *SearchState, alloc: Allocator) void {
        self.query.deinit(alloc);
        if (self.screen_search) |*s| s.deinit();
        if (self.viewport_search) |*s| s.deinit();
        self.viewport_matches.deinit(alloc);
        self.* = .{};
    }

    fn resetRuntime(self: *SearchState) void {
        self.viewport_matches.clearRetainingCapacity();
        self.status.active = if (self.query.items.len > 0) 1 else 0;
        self.status.total_matches = 0;
        self.status.selected_index = -1;
        self.status.pending = 0;
        self.status.complete = 0;
        self.viewport_dirty = false;
        self.active_dirty = false;
        self.active_screen_key = -1;
    }

    fn bumpGeneration(self: *SearchState) void {
        self.status.generation +%= 1;
    }

    fn setQuery(self: *SearchState, alloc: Allocator, value: []const u8) !void {
        self.query.clearRetainingCapacity();
        try self.query.appendSlice(alloc, value);
    }

    fn isQueryEqual(self: *const SearchState, value: []const u8) bool {
        return std.mem.eql(u8, self.query.items, value);
    }

    fn isActive(self: *const SearchState) bool {
        return self.status.active != 0;
    }
};

fn packRGBA(rgb: ghostty.color.RGB, a: u8) u32 {
    return @as(u32, rgb.r) | (@as(u32, rgb.g) << 8) | (@as(u32, rgb.b) << 16) | (@as(u32, a) << 24);
}

fn rgbFromU32(color: u32) ghostty.color.RGB {
    return .{
        .r = @intCast((color >> 16) & 0xFF),
        .g = @intCast((color >> 8) & 0xFF),
        .b = @intCast(color & 0xFF),
    };
}

fn cursorStyleToAbi(style: CursorVisualStyle) u8 {
    return switch (style) {
        .block => 0,
        .bar => 1,
        .underline => 2,
        .block_hollow => 3,
    };
}

fn ensureScrollingRegion(h: *Restty) void {
    const cols = h.term.cols;
    const rows = h.term.rows;
    if (cols == 0 or rows == 0) return;
    const region = h.term.scrolling_region;
    const invalid =
        region.left >= cols or
        region.right >= cols or
        region.left >= region.right or
        region.top >= rows or
        region.bottom >= rows or
        region.top >= region.bottom;
    if (invalid) {
        h.term.scrolling_region = .{
            .top = 0,
            .bottom = rows - 1,
            .left = 0,
            .right = cols - 1,
        };
    }
}

fn clampI16Unsigned(value: u16) i16 {
    const max = std.math.maxInt(i16);
    const max_u16: u16 = @intCast(max);
    if (value > max_u16) return max;
    return @intCast(value);
}

fn activeScreenKeyInt(h: *Restty) i32 {
    return @intCast(@intFromEnum(h.term.screens.active_key));
}

fn clearSearch(h: *Restty) void {
    h.search.deinit(h.alloc);
}

fn initSearch(h: *Restty, query: []const u8) !void {
    clearSearch(h);
    if (query.len == 0) return;

    try h.search.setQuery(h.alloc, query);
    h.search.status.active = 1;
    h.search.status.pending = 1;
    h.search.status.complete = 0;
    h.search.status.total_matches = 0;
    h.search.status.selected_index = -1;
    h.search.active_screen_key = activeScreenKeyInt(h);
    h.search.viewport_search = try .init(h.alloc, query);
    h.search.screen_search = try .init(
        h.alloc,
        h.term.screens.active,
        query,
    );
    if (h.search.viewport_search) |*vp| vp.active_dirty = true;
    h.search.viewport_dirty = true;
    h.search.active_dirty = true;
    h.search.bumpGeneration();
}

fn ensureSearchActiveScreen(h: *Restty) !void {
    if (!h.search.isActive()) return;
    if (h.search.active_screen_key == activeScreenKeyInt(h) and
        h.search.screen_search != null and
        h.search.viewport_search != null) return;
    try initSearch(h, h.search.query.items);
}

fn refreshSearchMetadata(h: *Restty) void {
    const s = if (h.search.screen_search) |*s| s else {
        h.search.status.total_matches = 0;
        h.search.status.selected_index = -1;
        h.search.status.pending = 0;
        h.search.status.complete = 1;
        return;
    };
    h.search.status.total_matches = @intCast(s.matchesLen());
    h.search.status.selected_index = if (s.selected) |sel| @intCast(sel.idx) else -1;
}

fn refreshViewportMatches(h: *Restty, force_refresh: bool) !void {
    const vp = if (h.search.viewport_search) |*vp| vp else {
        h.search.viewport_matches.clearRetainingCapacity();
        return;
    };
    if (force_refresh) vp.reset();
    vp.active_dirty = true;
    const changed = try vp.update(&h.term.screens.active.pages);
    if (!changed and !force_refresh and !h.search.viewport_dirty) return;

    h.search.viewport_matches.clearRetainingCapacity();
    const selected = if (h.search.screen_search) |*screen_search|
        screen_search.selectedMatch()
    else
        null;
    while (vp.next()) |hl| {
        const slice = hl.chunks.slice();
        const chunk_len = slice.len;
        for (0..chunk_len) |chunk_idx| {
            const row_start = slice.items(.start)[chunk_idx];
            const row_end = slice.items(.end)[chunk_idx];
            const node = slice.items(.node)[chunk_idx];
            var row = row_start;
            while (row < row_end) : (row += 1) {
                const viewport_pt = h.term.screens.active.pages.pointFromPin(.viewport, .{
                    .node = node,
                    .x = 0,
                    .y = row,
                }) orelse continue;
                const start_col: u16 = @intCast(if (chunk_idx == 0 and row == row_start) hl.top_x else 0);
                const end_col_exclusive: u16 = @intCast(if (chunk_idx + 1 == chunk_len and row + 1 == row_end) hl.bot_x + 1 else h.cols);
                if (end_col_exclusive <= start_col) continue;
                try h.search.viewport_matches.append(h.alloc, .{
                    .row = @intCast(viewport_pt.viewport.y),
                    .start_col = start_col,
                    .end_col = end_col_exclusive,
                    .selected = if (selected) |sel|
                        @intFromBool(sel.untracked().eql(hl.untracked()))
                    else
                        0,
                });
            }
        }
    }
    h.search.viewport_dirty = false;
}

fn stepSearch(h: *Restty, budget: u32) !void {
    if (!h.search.isActive()) return;
    try ensureSearchActiveScreen(h);
    const screen_search = if (h.search.screen_search) |*s| s else return;

    // Keep active-area and viewport state fresh while search is active.
    try screen_search.reloadActive();
    h.search.active_dirty = false;

    var remaining: u32 = if (budget == 0) 64 else budget;
    var force_viewport_refresh = h.search.viewport_dirty;
    while (remaining > 0) : (remaining -= 1) {
        screen_search.tick() catch |err| switch (err) {
            error.OutOfMemory => return error.OutOfMemory,
            error.FeedRequired => {
                try screen_search.feed();
            },
            error.SearchComplete => {
                h.search.status.complete = 1;
                h.search.status.pending = 0;
                force_viewport_refresh = true;
                break;
            },
        };
    }

    if (h.search.status.complete == 0) {
        h.search.status.pending = 1;
    }
    refreshSearchMetadata(h);
    try refreshViewportMatches(h, force_viewport_refresh);
    h.search.bumpGeneration();
}

fn scrollToSelectedSearchMatch(h: *Restty) void {
    const screen_search = if (h.search.screen_search) |*s| s else return;
    const selected = screen_search.selectedMatch() orelse return;
    h.term.screens.active.scroll(.{ .pin = selected.startPin() });
    h.search.viewport_dirty = true;
}

fn kittyFormatToAbi(format: anytype) u8 {
    return switch (format) {
        .gray => 1,
        .gray_alpha => 2,
        .rgb => 3,
        .rgba => 4,
        .png => 100,
    };
}

fn appendKittyPlacement(
    h: *Restty,
    image: ghostty.kitty.graphics.Image,
    placement_id: u32,
    placement_external: u8,
    x: i32,
    y: i32,
    z: i32,
    width: u32,
    height: u32,
    cell_offset_x: u32,
    cell_offset_y: u32,
    source_x: u32,
    source_y: u32,
    source_width: u32,
    source_height: u32,
) !void {
    const data_ptr: u32 = if (image.data.len == 0) 0 else @intCast(@intFromPtr(image.data.ptr));
    const data_len: u32 = @intCast(image.data.len);

    try h.kitty_placements.append(h.alloc, .{
        .image_id = image.id,
        .image_format = kittyFormatToAbi(image.format),
        .image_width = image.width,
        .image_height = image.height,
        .image_data_ptr = data_ptr,
        .image_data_len = data_len,
        .x = x,
        .y = y,
        .z = z,
        .width = width,
        .height = height,
        .cell_offset_x = cell_offset_x,
        .cell_offset_y = cell_offset_y,
        .source_x = source_x,
        .source_y = source_y,
        .source_width = source_width,
        .source_height = source_height,
        .placement_id = placement_id,
        .placement_external = placement_external,
    });
}

fn collectKittyPlacements(h: *Restty) !void {
    h.kitty_placements.clearRetainingCapacity();
    if (comptime !kitty_graphics_enabled) return;

    const storage = &h.term.screens.active.kitty_images;
    if (!storage.enabled()) return;

    const pages = &h.term.screens.active.pages;
    const top = pages.getTopLeft(.viewport);
    const bot = pages.getBottomRight(.viewport) orelse return;
    const top_screen = pages.pointFromPin(.screen, top) orelse return;
    const bot_screen = pages.pointFromPin(.screen, bot) orelse return;
    const top_y: u32 = top_screen.screen.y;
    const bot_y: u32 = bot_screen.screen.y;

    var it = storage.placements.iterator();
    while (it.next()) |entry| {
        const p = entry.value_ptr;
        switch (p.location) {
            .pin => {},
            .virtual => continue,
        }

        const image = storage.imageById(entry.key_ptr.image_id) orelse continue;
        const rect = p.rect(image, &h.term) orelse continue;
        const img_top = pages.pointFromPin(.screen, rect.top_left) orelse continue;
        const img_bot = pages.pointFromPin(.screen, rect.bottom_right) orelse continue;
        const img_top_y: u32 = img_top.screen.y;
        const img_bot_y: u32 = img_bot.screen.y;
        if (img_top_y > bot_y or img_bot_y < top_y) continue;

        const dest_size = p.pixelSize(image, &h.term);
        if (dest_size.width == 0 or dest_size.height == 0) continue;

        const source_x: u32 = @min(image.width, p.source_x);
        const source_y: u32 = @min(image.height, p.source_y);
        const source_width: u32 = if (p.source_width > 0)
            @min(image.width - source_x, p.source_width)
        else
            image.width;
        const source_height: u32 = if (p.source_height > 0)
            @min(image.height - source_y, p.source_height)
        else
            image.height;
        if (source_width == 0 or source_height == 0) continue;

        const y_pos: i32 = @as(i32, @intCast(img_top_y)) - @as(i32, @intCast(top_y));
        try appendKittyPlacement(
            h,
            image,
            entry.key_ptr.placement_id.id,
            @intFromBool(entry.key_ptr.placement_id.tag == .external),
            @intCast(rect.top_left.x),
            y_pos,
            p.z,
            dest_size.width,
            dest_size.height,
            p.x_offset,
            p.y_offset,
            source_x,
            source_y,
            source_width,
            source_height,
        );
    }

    const cell_width: u32 = if (h.term.cols > 0) @max(1, h.term.width_px / h.term.cols) else 0;
    const cell_height: u32 = if (h.term.rows > 0) @max(1, h.term.height_px / h.term.rows) else 0;
    if (cell_width == 0 or cell_height == 0) return;

    var v_it = ghostty.kitty.graphics.unicode.placementIterator(top, bot);
    while (v_it.next()) |virtual_p| {
        const image = storage.imageById(virtual_p.image_id) orelse continue;
        const rp = virtual_p.renderPlacement(storage, &image, cell_width, cell_height) catch continue;
        if (rp.dest_width == 0 or rp.dest_height == 0) continue;
        const viewport = pages.pointFromPin(.viewport, rp.top_left) orelse continue;

        try appendKittyPlacement(
            h,
            image,
            virtual_p.placement_id,
            if (virtual_p.placement_id == 0) 0 else 1,
            @intCast(rp.top_left.x),
            @intCast(viewport.viewport.y),
            -1,
            rp.dest_width,
            rp.dest_height,
            rp.offset_x,
            rp.offset_y,
            rp.source_x,
            rp.source_y,
            rp.source_width,
            rp.source_height,
        );
    }

    std.mem.sortUnstable(
        KittyPlacementAbi,
        h.kitty_placements.items,
        {},
        struct {
            fn lessThan(ctx: void, lhs: KittyPlacementAbi, rhs: KittyPlacementAbi) bool {
                _ = ctx;
                if (lhs.z != rhs.z) return lhs.z < rhs.z;
                if (lhs.image_id != rhs.image_id) return lhs.image_id < rhs.image_id;
                if (lhs.placement_external != rhs.placement_external) {
                    return lhs.placement_external < rhs.placement_external;
                }
                if (lhs.placement_id != rhs.placement_id) return lhs.placement_id < rhs.placement_id;
                if (lhs.y != rhs.y) return lhs.y < rhs.y;
                return lhs.x < rhs.x;
            }
        }.lessThan,
    );
}

pub export fn restty_create(cols: u16, rows: u16, max_scrollback: u32) ?*Restty {
    if (cols == 0 or rows == 0) return null;
    const alloc = std.heap.wasm_allocator;

    var colors: ghostty.Terminal.Colors = .default;
    colors.background = ghostty.color.DynamicRGB.init(.{ .r = 0, .g = 0, .b = 0 });
    colors.foreground = ghostty.color.DynamicRGB.init(.{ .r = 0xFF, .g = 0xFF, .b = 0xFF });
    colors.cursor = ghostty.color.DynamicRGB.init(.{ .r = 0xFF, .g = 0xFF, .b = 0xFF });

    var term = ghostty.Terminal.init(alloc, .{
        .cols = cols,
        .rows = rows,
        .max_scrollback = max_scrollback,
        .colors = colors,
    }) catch return null;
    errdefer term.deinit(alloc);
    term.width_px = cols;
    term.height_px = rows;

    var buffers = CellBuffers.init(alloc, rows, cols) catch return null;
    errdefer buffers.deinit(alloc);

    const handle = alloc.create(Restty) catch return null;
    errdefer alloc.destroy(handle);
    handle.* = .{
        .alloc = alloc,
        .term = term,
        .stream = undefined,
        .render_state = .empty,
        .buffers = buffers,
        .rows = rows,
        .cols = cols,
    };
    handle.stream = TerminalStream.initAlloc(
        alloc,
        StreamHandler.init(alloc, &handle.term, &handle.output),
    );
    return handle;
}

pub export fn restty_destroy(handle: ?*Restty) void {
    const h = handle orelse return;
    h.stream.deinit();
    h.render_state.deinit(h.alloc);
    h.search.deinit(h.alloc);
    h.term.deinit(h.alloc);
    h.buffers.deinit(h.alloc);
    h.graphemes.deinit(h.alloc);
    h.link_offsets.deinit(h.alloc);
    h.link_lengths.deinit(h.alloc);
    h.link_buffer.deinit(h.alloc);
    h.kitty_placements.deinit(h.alloc);
    h.output.deinit(h.alloc);
    h.alloc.destroy(h);
}

pub export fn restty_write(handle: ?*Restty, ptr: [*]const u8, len: usize) u32 {
    const h = handle orelse return @intFromEnum(ErrorCode.invalid_handle);
    if (len == 0) return @intFromEnum(ErrorCode.ok);
    const slice = ptr[0..len];
    ensureScrollingRegion(h);
    h.stream.nextSlice(slice);
    if (h.search.isActive()) {
        h.search.viewport_dirty = true;
        h.search.active_dirty = true;
    }
    return @intFromEnum(ErrorCode.ok);
}

pub export fn restty_scroll_viewport(handle: ?*Restty, delta: i32) u32 {
    const h = handle orelse return @intFromEnum(ErrorCode.invalid_handle);
    h.term.scrollViewport(.{ .delta = delta });
    if (h.search.isActive()) {
        h.search.viewport_dirty = true;
    }
    return @intFromEnum(ErrorCode.ok);
}

pub export fn restty_search_set_query(handle: ?*Restty, ptr: [*]const u8, len: usize) u32 {
    const h = handle orelse return @intFromEnum(ErrorCode.invalid_handle);
    const query = ptr[0..len];
    if (len == 0) {
        clearSearch(h);
        return @intFromEnum(ErrorCode.ok);
    }
    if (h.search.isActive() and h.search.isQueryEqual(query)) return @intFromEnum(ErrorCode.ok);
    initSearch(h, query) catch |err| return switch (err) {
        error.OutOfMemory => @intFromEnum(ErrorCode.out_of_memory),
    };
    return @intFromEnum(ErrorCode.ok);
}

pub export fn restty_search_clear(handle: ?*Restty) u32 {
    const h = handle orelse return @intFromEnum(ErrorCode.invalid_handle);
    clearSearch(h);
    return @intFromEnum(ErrorCode.ok);
}

pub export fn restty_search_step(handle: ?*Restty, budget: u32) u32 {
    const h = handle orelse return @intFromEnum(ErrorCode.invalid_handle);
    stepSearch(h, budget) catch |err| return switch (err) {
        error.OutOfMemory => @intFromEnum(ErrorCode.out_of_memory),
    };
    return @intFromEnum(ErrorCode.ok);
}

pub export fn restty_search_status_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(&h.search.status);
}

pub export fn restty_search_viewport_match_count(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return @intCast(h.search.viewport_matches.items.len);
}

pub export fn restty_search_viewport_matches_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return if (h.search.viewport_matches.items.len == 0) 0 else @intFromPtr(h.search.viewport_matches.items.ptr);
}

pub export fn restty_search_select_next(handle: ?*Restty) u32 {
    const h = handle orelse return @intFromEnum(ErrorCode.invalid_handle);
    const screen_search = if (h.search.screen_search) |*s| s else return @intFromEnum(ErrorCode.ok);
    _ = screen_search.select(.next) catch |err| return switch (err) {
        error.OutOfMemory => @intFromEnum(ErrorCode.out_of_memory),
    };
    refreshSearchMetadata(h);
    scrollToSelectedSearchMatch(h);
    refreshViewportMatches(h, true) catch |err| return switch (err) {
        error.OutOfMemory => @intFromEnum(ErrorCode.out_of_memory),
    };
    h.search.bumpGeneration();
    return @intFromEnum(ErrorCode.ok);
}

pub export fn restty_search_select_prev(handle: ?*Restty) u32 {
    const h = handle orelse return @intFromEnum(ErrorCode.invalid_handle);
    const screen_search = if (h.search.screen_search) |*s| s else return @intFromEnum(ErrorCode.ok);
    _ = screen_search.select(.prev) catch |err| return switch (err) {
        error.OutOfMemory => @intFromEnum(ErrorCode.out_of_memory),
    };
    refreshSearchMetadata(h);
    scrollToSelectedSearchMatch(h);
    refreshViewportMatches(h, true) catch |err| return switch (err) {
        error.OutOfMemory => @intFromEnum(ErrorCode.out_of_memory),
    };
    h.search.bumpGeneration();
    return @intFromEnum(ErrorCode.ok);
}

pub export fn restty_scrollbar_total(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    const sb = h.term.screens.active.pages.scrollbar();
    return @intCast(sb.total);
}

pub export fn restty_scrollbar_offset(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    const sb = h.term.screens.active.pages.scrollbar();
    return @intCast(sb.offset);
}

pub export fn restty_scrollbar_len(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    const sb = h.term.screens.active.pages.scrollbar();
    return @intCast(sb.len);
}

pub export fn restty_output_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return if (h.output.items.len == 0) 0 else @intFromPtr(h.output.items.ptr);
}

pub export fn restty_output_len(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return @intCast(h.output.items.len);
}

pub export fn restty_output_consume(handle: ?*Restty, len: u32) u32 {
    const h = handle orelse return @intFromEnum(ErrorCode.invalid_handle);
    if (len == 0 or h.output.items.len == 0) return @intFromEnum(ErrorCode.ok);

    const n: usize = @min(@as(usize, len), h.output.items.len);
    if (n >= h.output.items.len) {
        h.output.clearRetainingCapacity();
        return @intFromEnum(ErrorCode.ok);
    }

    const remaining = h.output.items.len - n;
    std.mem.copyForwards(u8, h.output.items[0..remaining], h.output.items[n..]);
    h.output.items.len = remaining;
    return @intFromEnum(ErrorCode.ok);
}

pub export fn restty_kitty_keyboard_flags(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return h.term.screens.active.kitty_keyboard.current().int();
}

pub export fn restty_set_default_colors(handle: ?*Restty, fg: u32, bg: u32, cursor: u32) u32 {
    const h = handle orelse return @intFromEnum(ErrorCode.invalid_handle);
    if (fg != 0xFFFF_FFFF) {
        const rgb = rgbFromU32(fg);
        h.term.colors.foreground.default = rgb;
        h.term.colors.foreground.override = null;
    }
    if (bg != 0xFFFF_FFFF) {
        const rgb = rgbFromU32(bg);
        h.term.colors.background.default = rgb;
        h.term.colors.background.override = null;
    }
    if (cursor != 0xFFFF_FFFF) {
        const rgb = rgbFromU32(cursor);
        h.term.colors.cursor.default = rgb;
        h.term.colors.cursor.override = null;
    }
    h.term.flags.dirty.palette = true;
    return @intFromEnum(ErrorCode.ok);
}

pub export fn restty_set_palette(handle: ?*Restty, ptr: [*]const u8, len: usize) u32 {
    const h = handle orelse return @intFromEnum(ErrorCode.invalid_handle);
    if (len == 0) return @intFromEnum(ErrorCode.ok);
    const count: usize = if (len > 256) 256 else len;
    var i: usize = 0;
    while (i < count) : (i += 1) {
        const base = i * 3;
        const rgb = ghostty.color.RGB{
            .r = ptr[base],
            .g = ptr[base + 1],
            .b = ptr[base + 2],
        };
        h.term.colors.palette.set(@intCast(i), rgb);
    }
    h.term.flags.dirty.palette = true;
    return @intFromEnum(ErrorCode.ok);
}

pub export fn restty_reset_palette(handle: ?*Restty) u32 {
    const h = handle orelse return @intFromEnum(ErrorCode.invalid_handle);
    h.term.colors.palette.resetAll();
    h.term.flags.dirty.palette = true;
    return @intFromEnum(ErrorCode.ok);
}

pub export fn restty_resize(handle: ?*Restty, cols: u16, rows: u16) u32 {
    const h = handle orelse return @intFromEnum(ErrorCode.invalid_handle);
    if (cols == 0 or rows == 0) return @intFromEnum(ErrorCode.invalid_arg);
    h.term.resize(h.alloc, cols, rows) catch return @intFromEnum(ErrorCode.internal);
    ensureScrollingRegion(h);
    if (h.search.isActive()) {
        h.search.viewport_dirty = true;
        h.search.active_dirty = true;
    }
    return @intFromEnum(ErrorCode.ok);
}

pub export fn restty_set_pixel_size(handle: ?*Restty, width_px: u32, height_px: u32) u32 {
    const h = handle orelse return @intFromEnum(ErrorCode.invalid_handle);
    if (width_px == 0 or height_px == 0) return @intFromEnum(ErrorCode.invalid_arg);
    h.term.width_px = width_px;
    h.term.height_px = height_px;
    return @intFromEnum(ErrorCode.ok);
}

pub export fn restty_render_update(handle: ?*Restty) u32 {
    const h = handle orelse return @intFromEnum(ErrorCode.invalid_handle);
    collectKittyPlacements(h) catch return @intFromEnum(ErrorCode.out_of_memory);
    h.render_state.update(h.alloc, &h.term) catch return @intFromEnum(ErrorCode.internal);

    const new_rows: u16 = @intCast(h.render_state.rows);
    const new_cols: u16 = @intCast(h.render_state.cols);
    const expected_len: usize = @as(usize, new_rows) * @as(usize, new_cols);

    if (new_rows != h.rows or new_cols != h.cols or h.buffers.codepoints.len != expected_len) {
        const new_buffers = CellBuffers.init(h.alloc, new_rows, new_cols) catch
            return @intFromEnum(ErrorCode.out_of_memory);
        h.buffers.deinit(h.alloc);
        h.buffers = new_buffers;
        h.rows = new_rows;
        h.cols = new_cols;
    }

    h.graphemes.clearRetainingCapacity();
    h.link_offsets.clearRetainingCapacity();
    h.link_lengths.clearRetainingCapacity();
    h.link_buffer.clearRetainingCapacity();

    const row_data = h.render_state.row_data.slice();
    const row_pins = row_data.items(.pin);
    const row_cells = row_data.items(.cells);
    const row_selection = row_data.items(.selection);

    const palette = &h.render_state.colors.palette;
    const default_fg = h.render_state.colors.foreground;
    const default_bg = h.render_state.colors.background;

    var link_map: std.StringHashMapUnmanaged(u32) = .{};
    defer link_map.deinit(h.alloc);

    var idx: usize = 0;
    var r: usize = 0;
    while (r < h.rows) : (r += 1) {
        if (row_selection[r]) |sel| {
            h.buffers.row_selection_start[r] = clampI16Unsigned(sel[0]);
            h.buffers.row_selection_end[r] = clampI16Unsigned(sel[1]);
        } else {
            h.buffers.row_selection_start[r] = -1;
            h.buffers.row_selection_end[r] = -1;
        }

        const list = row_cells[r];
        const cell_slice = list.slice();
        const raw_cells = cell_slice.items(.raw);
        const cell_graphemes = cell_slice.items(.grapheme);
        const cell_styles = cell_slice.items(.style);
        const pin = row_pins[r];
        const page_ptr = &pin.node.data;

        var c: usize = 0;
        while (c < h.cols) : (c += 1) {
            const raw = raw_cells[c];
            const raw_codepoint = raw.codepoint();
            const is_kitty_placeholder = if (comptime kitty_graphics_enabled)
                raw_codepoint == ghostty.kitty.graphics.unicode.placeholder
            else
                false;

            h.buffers.codepoints[idx] = @intCast(raw_codepoint);
            h.buffers.content_tags[idx] = @intFromEnum(raw.content_tag);
            h.buffers.wide[idx] = @intFromEnum(raw.wide);

            var flags: u16 = 0;
            if (raw.hyperlink) flags |= CellFlags.hyperlink;
            if (raw.hasGrapheme() and !is_kitty_placeholder) flags |= CellFlags.has_grapheme;
            if (raw.protected) flags |= CellFlags.protected;
            h.buffers.flags[idx] = flags;

            var style: ghostty.Style = .{};
            if (raw.style_id != 0) {
                style = cell_styles[c];
            }

            h.buffers.style_flags[idx] = @as(u16, @bitCast(style.flags));
            h.buffers.underline_styles[idx] = @intFromEnum(style.flags.underline);
            h.buffers.link_ids[idx] = 0;

            const fg = style.fg(.{ .default = default_fg, .palette = palette, .bold = null });
            const bg = style.bg(&raw, palette) orelse default_bg;
            const ul = style.underlineColor(palette) orelse fg;

            h.buffers.fg_rgba[idx] = packRGBA(fg, 0xFF);
            h.buffers.bg_rgba[idx] = packRGBA(bg, 0xFF);
            h.buffers.ul_rgba[idx] = packRGBA(ul, 0xFF);

            if (raw.hasGrapheme() and !is_kitty_placeholder) {
                const grapheme_slice = cell_graphemes[c];
                const offset = h.graphemes.items.len;
                if (grapheme_slice.len > 0) {
                    h.graphemes.ensureUnusedCapacity(h.alloc, grapheme_slice.len) catch
                        return @intFromEnum(ErrorCode.out_of_memory);
                    for (grapheme_slice) |cp| {
                        h.graphemes.appendAssumeCapacity(@intCast(cp));
                    }
                }
                h.buffers.grapheme_offsets[idx] = @intCast(offset);
                h.buffers.grapheme_lengths[idx] = @intCast(grapheme_slice.len);
            } else {
                h.buffers.grapheme_offsets[idx] = 0;
                h.buffers.grapheme_lengths[idx] = 0;
            }

            if (raw.hyperlink) {
                const rac = page_ptr.getRowAndCell(@intCast(c), pin.y);
                if (page_ptr.lookupHyperlink(rac.cell)) |link_id| {
                    const link = page_ptr.hyperlink_set.get(page_ptr.memory, link_id);
                    const uri = link.uri.slice(page_ptr.memory);
                    if (uri.len > 0) {
                        const existing = link_map.get(uri);
                        const link_index: u32 = if (existing) |val| val else blk: {
                            const offset: usize = h.link_buffer.items.len;
                            h.link_buffer.appendSlice(h.alloc, uri) catch
                                return @intFromEnum(ErrorCode.out_of_memory);
                            h.link_offsets.append(h.alloc, @intCast(offset)) catch
                                return @intFromEnum(ErrorCode.out_of_memory);
                            h.link_lengths.append(h.alloc, @intCast(uri.len)) catch
                                return @intFromEnum(ErrorCode.out_of_memory);
                            const new_index: u32 = @intCast(h.link_offsets.items.len);
                            link_map.put(h.alloc, uri, new_index) catch
                                return @intFromEnum(ErrorCode.out_of_memory);
                            break :blk new_index;
                        };
                        h.buffers.link_ids[idx] = link_index;
                    }
                }
            }

            idx += 1;
        }
    }

    const cursor_state = h.render_state.cursor;
    const cursor_visible = cursor_state.visible and cursor_state.viewport != null;
    if (cursor_state.viewport) |vp| {
        h.cursor.row = @intCast(vp.y);
        h.cursor.col = @intCast(vp.x);
        h.cursor.wide_tail = if (vp.wide_tail) 1 else 0;
    } else {
        h.cursor.row = 0;
        h.cursor.col = 0;
        h.cursor.wide_tail = 0;
    }
    h.cursor.visible = if (cursor_visible) 1 else 0;
    h.cursor.style = cursorStyleToAbi(cursor_state.visual_style);
    h.cursor.blinking = if (cursor_state.blinking) 1 else 0;
    h.cursor.color_rgba = if (h.render_state.colors.cursor) |c| packRGBA(c, 0xFF) else 0;

    return @intFromEnum(ErrorCode.ok);
}

pub export fn restty_cells_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.codepoints.ptr);
}

pub export fn restty_cells_len(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return @intCast(h.buffers.codepoints.len);
}

pub export fn restty_cell_codepoints_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.codepoints.ptr);
}

pub export fn restty_cell_content_tags_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.content_tags.ptr);
}

pub export fn restty_cell_wide_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.wide.ptr);
}

pub export fn restty_cell_flags_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.flags.ptr);
}

pub export fn restty_cell_style_flags_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.style_flags.ptr);
}

pub export fn restty_cell_underline_styles_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.underline_styles.ptr);
}

pub export fn restty_cell_link_ids_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.link_ids.ptr);
}

pub export fn restty_cell_fg_rgba_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.fg_rgba.ptr);
}

pub export fn restty_cell_bg_rgba_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.bg_rgba.ptr);
}

pub export fn restty_cell_ul_rgba_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.ul_rgba.ptr);
}

pub export fn restty_link_offsets_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return if (h.link_offsets.items.len == 0) 0 else @intFromPtr(h.link_offsets.items.ptr);
}

pub export fn restty_link_lengths_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return if (h.link_lengths.items.len == 0) 0 else @intFromPtr(h.link_lengths.items.ptr);
}

pub export fn restty_link_buffer_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return if (h.link_buffer.items.len == 0) 0 else @intFromPtr(h.link_buffer.items.ptr);
}

pub export fn restty_link_count(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return @intCast(h.link_offsets.items.len);
}

pub export fn restty_link_buffer_len(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return @intCast(h.link_buffer.items.len);
}

pub export fn restty_cell_grapheme_offsets_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.grapheme_offsets.ptr);
}

pub export fn restty_cell_grapheme_lengths_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.grapheme_lengths.ptr);
}

pub export fn restty_grapheme_buffer_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return if (h.graphemes.items.len == 0) 0 else @intFromPtr(h.graphemes.items.ptr);
}

pub export fn restty_grapheme_buffer_len(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return @intCast(h.graphemes.items.len);
}

pub export fn restty_row_selection_start_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.row_selection_start.ptr);
}

pub export fn restty_row_selection_end_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(h.buffers.row_selection_end.ptr);
}

pub export fn restty_cursor_info_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return @intFromPtr(&h.cursor);
}

pub export fn restty_rows(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return h.rows;
}

pub export fn restty_cols(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return h.cols;
}

pub export fn restty_active_cursor_x(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return @intCast(h.term.screens.active.cursor.x);
}

pub export fn restty_active_cursor_y(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return @intCast(h.term.screens.active.cursor.y);
}

pub export fn restty_debug_scroll_left(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return @intCast(h.term.scrolling_region.left);
}

pub export fn restty_debug_scroll_right(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return @intCast(h.term.scrolling_region.right);
}

pub export fn restty_debug_term_cols(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return h.term.cols;
}

pub export fn restty_debug_term_rows(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return h.term.rows;
}

pub export fn restty_debug_page_cols(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return h.term.screens.active.pages.cols;
}

pub export fn restty_debug_page_rows(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return h.term.screens.active.pages.rows;
}

pub export fn restty_kitty_placement_stride() u32 {
    return @sizeOf(KittyPlacementAbi);
}

pub export fn restty_kitty_placement_count(handle: ?*Restty) u32 {
    const h = handle orelse return 0;
    return @intCast(h.kitty_placements.items.len);
}

pub export fn restty_kitty_placements_ptr(handle: ?*Restty) usize {
    const h = handle orelse return 0;
    return if (h.kitty_placements.items.len == 0) 0 else @intFromPtr(h.kitty_placements.items.ptr);
}

pub export fn restty_alloc(len: usize) usize {
    if (len == 0) return 0;
    const buf = std.heap.wasm_allocator.alloc(u8, len) catch return 0;
    return @intFromPtr(buf.ptr);
}

pub export fn restty_free(ptr: usize, len: usize) void {
    if (ptr == 0 or len == 0) return;
    const buf = @as([*]u8, @ptrFromInt(ptr));
    std.heap.wasm_allocator.free(buf[0..len]);
}
