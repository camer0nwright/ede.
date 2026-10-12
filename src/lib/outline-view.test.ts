import { describe, expect, it } from "vitest";
import { demoOutline } from "./demo-athlete";
import { sessionItems } from "./outline-view";

describe("sessionItems", () => {
  const week = demoOutline.weeks[4];
  const items = sessionItems(week, "low");

  it("lists every run and lift in the week", () => {
    expect(items.filter((i) => i.type === "run")).toHaveLength(week.runs.length);
    expect(items.filter((i) => i.type === "strength")).toHaveLength(week.strength.length);
  });

  it("puts quality sessions first, then the long run, then easy runs", () => {
    const roles = items.flatMap((i) => (i.type === "run" ? [i.role] : []));
    expect(roles).toEqual([...roles].sort((a, b) => ["quality", "long", "easy"].indexOf(a) - ["quality", "long", "easy"].indexOf(b)));
  });

  it("gives runs steps that add up to their length", () => {
    for (const i of items) {
      if (i.type === "run") expect(i.steps.reduce((s, x) => s + x.minutes, 0)).toBe(i.minutes);
    }
  });

  it("describes strength sessions by focus and volume", () => {
    const lift = items.find((i) => i.type === "strength");
    expect(lift && lift.type === "strength" && lift.summary).toMatch(/2 working sets each/);
  });
});
