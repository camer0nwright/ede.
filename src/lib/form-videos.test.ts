import { describe, expect, it } from "vitest";
import { EXERCISES } from "./exercise-library";
import { embedUrl, FORM_VIDEOS, formVideo } from "./form-videos";

// Form videos (SPEC decision 78).

describe("form videos", () => {
  it("cover every exercise in the library, and nothing else", () => {
    expect(Object.keys(FORM_VIDEOS).sort()).toEqual(EXERCISES.map((e) => e.name).sort());
  });

  it("are YouTube video ids", () => {
    for (const [name, id] of Object.entries(FORM_VIDEOS)) expect(id, name).toMatch(/^[A-Za-z0-9_-]{11}$/);
  });

  it("are found by an exercise's other names too", () => {
    expect(formVideo("Hex bar deadlift")).toBe(FORM_VIDEOS["Trap bar deadlift"]);
    expect(formVideo("Not an exercise")).toBeUndefined();
  });

  it("play through YouTube's privacy-enhanced domain", () => {
    expect(embedUrl("rrJIyZGlK8c")).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/rrJIyZGlK8c\?/);
  });
});
