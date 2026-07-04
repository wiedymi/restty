const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    retargetMacOS27Host(b);

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

    const ghostty_dep = b.dependency("ghostty", .{
        .target = target,
        .optimize = optimize,
        .simd = false,
    });
    exe.root_module.addImport("ghostty-vt", ghostty_dep.module("ghostty-vt"));

    b.installArtifact(exe);
}

fn retargetMacOS27Host(b: *std.Build) void {
    const host = b.graph.host.result;
    if (host.os.tag != .macos) return;

    const version_range = host.os.version_range.semver;
    if (version_range.min.major < 27) return;

    const macos_15: std.SemanticVersion = .{
        .major = 15,
        .minor = 0,
        .patch = 0,
    };
    b.graph.host = b.resolveTargetQuery(.{
        .cpu_arch = host.cpu.arch,
        .os_tag = .macos,
        .os_version_min = .{ .semver = macos_15 },
        .os_version_max = .{ .semver = macos_15 },
        .abi = host.abi,
    });
}
