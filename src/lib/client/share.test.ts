import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText, shareText } from "./share";

afterEach(() => vi.unstubAllGlobals());

describe("sharing", () => {
  it("calls native share immediately with the whole message in one text item", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    const operation = shareText("Zonkey #2\n2/8\n\n⬜⬜ 🟩🟩", "https://example.com");
    expect(share).toHaveBeenCalledWith({
      title: "Zonkey #2",
      text: "Zonkey #2\n2/8\n\n⬜⬜ 🟩🟩\nhttps://example.com",
    });
    expect(await operation).toBe("shared");
  });

  it("does not copy or report a failure when the share sheet is cancelled", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")), clipboard: { writeText } });
    expect(await shareText("result")).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("reports blocked embedding without silently copying", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(new DOMException("Blocked", "NotAllowedError")), clipboard: { writeText } });
    expect(await shareText("result")).toBe("blocked");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies text with a link when native share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await shareText("result", "https://example.com")).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("result\nhttps://example.com");
  });

  it("reports unavailable clipboard so the UI can offer manual copy", async () => {
    vi.stubGlobal("navigator", {});
    expect(await copyText("result")).toBe("failed");
  });
});
