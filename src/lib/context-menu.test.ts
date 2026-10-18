import { describe, expect, it } from "vitest";
import { disableContextMenu } from "@/lib/context-menu";

function rightClick(): boolean {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("disableContextMenu", () => {
  it("no hace nada en la web, en Android ni en desarrollo", () => {
    expect(disableContextMenu({ tauri: false, platform: "windows", dev: false })).toBeNull();
    expect(disableContextMenu({ tauri: true, platform: "android", dev: false })).toBeNull();
    expect(disableContextMenu({ tauri: true, platform: "windows", dev: true })).toBeNull();
    expect(rightClick()).toBe(false);
  });

  it("bloquea el clic derecho en la app de Windows", () => {
    const restore = disableContextMenu({ tauri: true, platform: "windows", dev: false });
    expect(rightClick()).toBe(true);
    restore?.();
    expect(rightClick()).toBe(false);
  });
});
