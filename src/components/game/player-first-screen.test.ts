import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoundScreen } from "./round-screen";

describe("opening word screen", () => {
  it("shows a blank opening with an enabled input and a reveal action", () => {
    const html = renderToStaticMarkup(createElement(RoundScreen, {
      round: { number: 1, wordA: "", wordB: "", opening: true, ready: true },
      submitting: false, preparing: false, prepareError: null, submitError: null,
      onRetryPrepare: () => {}, onSubmit: () => {},
    }));
    expect(html).toContain("Start with your word.");
    expect(html).toContain("Reveal our words");
    expect(html).toContain("Any starting word");
    expect(html.match(/<input[^>]+>/)?.[0]).not.toMatch(/\sdisabled(?:=|\s|>)/);
    expect(html).not.toContain("↔");
  });

  it("keeps typing available while a later AI answer is preparing", () => {
    const html = renderToStaticMarkup(createElement(RoundScreen, {
      round: { number: 2, wordA: "donkey", wordB: "zebra", ready: false },
      submitting: false, preparing: true, prepareError: null, submitError: null,
      onRetryPrepare: () => {}, onSubmit: () => {},
    }));
    expect(html).toContain("donkey");
    expect(html).toContain("zebra");
    expect(html).toContain("Your connecting word");
    expect(html.match(/<input[^>]+>/)?.[0]).not.toMatch(/\sdisabled(?:=|\s|>)/);
  });
});
