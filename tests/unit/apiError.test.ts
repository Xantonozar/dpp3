import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "@/lib/apiError";

describe("apiErrorMessage", () => {
  it("passes the plain message through when there are no details", () => {
    expect(apiErrorMessage({ error: "Save failed" })).toBe("Save failed");
    expect(apiErrorMessage(null)).toBe("Save failed");
    expect(apiErrorMessage(undefined, {}, "Custom")).toBe("Custom");
    expect(apiErrorMessage({ error: "No carbon result", details: {} })).toBe("No carbon result");
  });

  it("names each bad field with friendly labels", () => {
    const out = apiErrorMessage(
      {
        error: "Invalid environmental inputs",
        details: {
          formErrors: [],
          fieldErrors: {
            garmentWeightKg: ["Expected number, received null"],
            gridSharePct: ["Number must be less than or equal to 100"],
          },
        },
      },
      { garmentWeightKg: "Garment weight", gridSharePct: "Grid share" }
    );
    expect(out).toContain("Garment weight: Expected number, received null");
    expect(out).toContain("Grid share: Number must be less than or equal to 100");
    expect(out.startsWith("Invalid environmental inputs")).toBe(true);
  });

  it("shows unmapped keys as-is and appends form errors", () => {
    const out = apiErrorMessage({
      error: "Invalid packaging",
      details: { formErrors: ["Too many materials"], fieldErrors: { mysteryField: ["Bad"] } },
    });
    expect(out).toContain("mysteryField: Bad");
    expect(out).toContain("Too many materials");
  });
});
