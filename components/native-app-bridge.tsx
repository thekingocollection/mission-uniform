"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";

/**
 * Native Android integration for the existing Next.js student portal.
 * This component is inert in a normal desktop/mobile browser.
 */
export function NativeAppBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);
  const [native, setNative] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    setNative(true);
    let active = true;

    const removeBack = App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack && window.history.length > 1) {
        window.history.back();
        return;
      }
      if (pathname !== "/") {
        router.replace("/");
        return;
      }
      App.minimizeApp();
    });

    const updateNetwork = (connected: boolean) => {
      if (active) setOffline(!connected);
    };

    Network.getStatus().then((status) => updateNetwork(status.connected));
    const networkListener = Network.addListener("networkStatusChange", (status) => {
      updateNetwork(status.connected);
    });

    return () => {
      active = false;
      void removeBack.then((listener) => listener.remove());
      void networkListener.then((listener) => listener.remove());
    };
  }, [pathname, router]);

  if (!native || !offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 2000,
        padding: "9px 14px",
        textAlign: "center",
        background: "#7f1d1d",
        color: "#fff",
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      You are offline. Reconnect to continue tests and sync your progress.
    </div>
  );
}
