import { describe, expect, it } from "vitest";
import { graphqlErrorMessages } from "@/modules/shopify/client";

describe("graphqlErrorMessages", () => {
  it("reads array GraphQL errors", () => {
    expect(graphqlErrorMessages([{ message: "Access denied" }, { message: "Missing scope" }])).toEqual([
      "Access denied",
      "Missing scope",
    ]);
  });

  it("reads string errors without throwing", () => {
    expect(graphqlErrorMessages("[API] Invalid API key or access token")).toEqual([
      "[API] Invalid API key or access token",
    ]);
  });

  it("reads single object errors", () => {
    expect(graphqlErrorMessages({ message: "Field denied" })).toEqual(["Field denied"]);
  });

  it("reads REST-style keyed errors", () => {
    expect(graphqlErrorMessages({ base: ["Shop is unavailable"] })).toEqual(["Shop is unavailable"]);
  });

  it("returns empty for nullish input", () => {
    expect(graphqlErrorMessages(null)).toEqual([]);
    expect(graphqlErrorMessages(undefined)).toEqual([]);
  });
});
