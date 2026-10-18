import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DOWNLOAD_URLS } from "@/lib/config";
import { detectPlatform } from "@/lib/platform";
import { renderWithQuery } from "@/test/render";
import { DownloadApp } from "./download-app";

const UA = {
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
  android:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
  linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
};

describe("detectPlatform", () => {
  it("reconoce cada sistema", () => {
    expect(detectPlatform(UA.windows, 0)).toBe("windows");
    expect(detectPlatform(UA.android, 5)).toBe("android");
    expect(detectPlatform(UA.iphone, 5)).toBe("ios");
    expect(detectPlatform(UA.mac, 0)).toBe("mac");
    // iPad reciente: se anuncia como Mac pero es táctil
    expect(detectPlatform(UA.mac, 5)).toBe("ios");
    expect(detectPlatform(UA.linux, 0)).toBe("other");
  });
});

describe("DownloadApp", () => {
  const link = (name: string) => screen.getByRole("link", { name });
  // Cada test espera a que termine la consulta de la versión: si el archivo acaba con la
  // petición en vuelo, al cerrar MSW el worker de Vitest puede abortar (SIGABRT en Linux)
  const versionLoaded = () => screen.findByText(/versión 0\.1\.0/);

  it("en Windows ofrece el instalador del último release y muestra la versión", async () => {
    renderWithQuery(<DownloadApp platform="windows" />);
    expect(link("Descargar para Windows")).toHaveAttribute("href", DOWNLOAD_URLS.windows);
    expect(screen.queryByRole("link", { name: "Descargar para Android" })).not.toBeInTheDocument();
    expect(await versionLoaded()).toBeInTheDocument();
  });

  it("en Android ofrece el APK", async () => {
    renderWithQuery(<DownloadApp platform="android" />);
    expect(link("Descargar para Android")).toHaveAttribute("href", DOWNLOAD_URLS.android);
    await versionLoaded();
  });

  it("en iPhone y macOS avisa de que aún no está disponible", async () => {
    const { unmount } = renderWithQuery(<DownloadApp platform="ios" />);
    expect(screen.getByRole("note")).toHaveTextContent("no está disponible para iPhone y iPad");
    expect(screen.queryByRole("link", { name: /Descargar para/ })).not.toBeInTheDocument();
    await versionLoaded();
    unmount();
    renderWithQuery(<DownloadApp platform="mac" />);
    expect(screen.getByRole("note")).toHaveTextContent("no está disponible para macOS");
    await versionLoaded();
  });

  it("en otros sistemas ofrece las dos descargas", async () => {
    renderWithQuery(<DownloadApp platform="other" />);
    expect(link("Descargar para Windows")).toBeInTheDocument();
    expect(link("Descargar para Android")).toBeInTheDocument();
    await versionLoaded();
  });
});
