import { describe, expect, it } from "vitest";
import { phaseLabels, phaseSegments } from "./phase-strip";

describe("phase timeline", () => {
  it("folds recovery weeks into the phase around them", () => {
    const phases = ["base", "base", "base", "recovery", "build", "build", "recovery", "build", "peak", "taper", "taper"] as const;
    expect(phaseSegments(phases.map((phase) => ({ phase })))).toEqual([
      { phase: "base", from: 0, weeks: 4 },
      { phase: "build", from: 4, weeks: 4 },
      { phase: "peak", from: 8, weeks: 1 },
      { phase: "taper", from: 9, weeks: 2 },
    ]);
  });

  it("gives a plan that starts with a recovery week to the first real phase", () => {
    expect(phaseSegments([{ phase: "recovery" }, { phase: "build" }])).toEqual([{ phase: "build", from: 0, weeks: 2 }]);
  });

  it("shares one label between short neighbouring phases", () => {
    const segments = [
      { phase: "base" as const, from: 0, weeks: 6 },
      { phase: "build" as const, from: 6, weeks: 8 },
      { phase: "peak" as const, from: 14, weeks: 2 },
      { phase: "taper" as const, from: 16, weeks: 2 },
    ];
    expect(phaseLabels(segments).map((l) => l.text)).toEqual(["Base", "Build", "Peak · Taper"]);
    expect(phaseLabels(segments).at(-1)).toMatchObject({ from: 14, weeks: 4 });
  });
});
