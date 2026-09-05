const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{ .default_target = .{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
        .cpu_features_add = std.Target.wasm.featureSet(&.{.simd128}),
    } });
    const optimize = b.standardOptimizeOption(.{});

    const exe_mod = b.createModule(.{
        .root_source_file = b.path("src/restty.zig"),
        .target = target,
        .optimize = optimize,
        .strip = optimize != .Debug,
    });

    const exe = b.addExecutable(.{
        .name = "restty",
        .root_module = exe_mod,
    });

    exe.entry = .disabled;
    exe.rdynamic = true;
    exe.stack_size = 128 * 1024;

    const ghostty_dep = b.dependency("ghostty", .{
        .target = target,
        .optimize = optimize,
        .simd = false,
        .@"wasm-kitty-graphics" = true,
    });
    exe.root_module.addImport("ghostty-vt", ghostty_dep.module("ghostty-vt"));

    exe.root_module.addImport("wuffs", ghostty_dep.module("ghostty-vt").import_table.get("wuffs").?);

    b.installArtifact(exe);
}
