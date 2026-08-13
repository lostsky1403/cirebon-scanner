import { describe, expect, it, vi } from "vitest";
import { cleanupCameraResources } from "./ScannerPage";

describe("cleanup kamera", () => {
  it("menghentikan decoder, seluruh track, timer, dan melepas video", () => {
    vi.useFakeTimers();
    const stopDecoder = vi.fn();
    const stopVideo = vi.fn();
    const stopAudio = vi.fn();
    const mediaStream = { getTracks: () => [{ stop: stopVideo }, { stop: stopAudio }] } as unknown as MediaStream;
    const element = { srcObject: mediaStream } as unknown as HTMLVideoElement;
    const callback = vi.fn();
    const timer = globalThis.setTimeout(callback, 100);
    cleanupCameraResources(mediaStream, { stop: stopDecoder }, element, timer);
    vi.runAllTimers();
    expect(stopDecoder).toHaveBeenCalledOnce();
    expect(stopVideo).toHaveBeenCalledOnce();
    expect(stopAudio).toHaveBeenCalledOnce();
    expect(element.srcObject).toBeNull();
    expect(callback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
