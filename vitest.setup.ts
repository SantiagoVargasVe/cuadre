import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// React Testing Library's auto-cleanup detects a *global* afterEach; this
// repo never sets `test.globals: true` (every test file imports afterEach
// explicitly from "vitest" instead), so the auto-detection never fires and
// component trees from one test leak into the next. Registering it here
// explicitly — first surfaced by T014's first .test.tsx files, since no
// earlier test rendered more than one component per file.
afterEach(() => {
  cleanup();
});

// jsdom has no PointerEvent constructor. Base UI's Checkbox (and other
// press-interaction primitives) dispatch one internally on click, so any
// test that clicks a Checkbox throws `ownerWindow(...).PointerEvent is not
// a constructor` without this — first surfaced by T064's payer editor
// tests, the first ones in this repo to click a Checkbox rather than a
// plain button. A thin MouseEvent subclass is enough; nothing here reads
// real pointer/pressure data.
if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent implements PointerEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    readonly width: number;
    readonly height: number;
    readonly pressure: number;
    readonly tangentialPressure: number;
    readonly tiltX: number;
    readonly tiltY: number;
    readonly twist: number;
    readonly altitudeAngle: number;
    readonly azimuthAngle: number;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? true;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
      this.altitudeAngle = params.altitudeAngle ?? 0;
      this.azimuthAngle = params.azimuthAngle ?? 0;
    }

    getCoalescedEvents(): PointerEvent[] {
      return [];
    }
    getPredictedEvents(): PointerEvent[] {
      return [];
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}
