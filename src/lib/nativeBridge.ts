import { App as CapacitorApp } from "@capacitor/app"
import { Capacitor } from "@capacitor/core"
import { Haptics, ImpactStyle } from "@capacitor/haptics"
import { StatusBar, Style } from "@capacitor/status-bar"
import { dispatchHardwareBack } from "./backStack"

/**
 * Configures Android native chrome (StatusBar light theme + hardware back button
 * integration) when running inside Capacitor. Safe no-op on web browsers.
 */
export function initNativeAndroidChrome(options: {
  onRootBack: () => void
}): () => void {
  if (!Capacitor.isNativePlatform()) {
    return () => {}
  }

  StatusBar.setStyle({ style: Style.Light }).catch(() => undefined)
  StatusBar.setBackgroundColor({ color: "#f8fafc" }).catch(() => undefined)

  let removed = false
  let handle: { remove: () => Promise<void> } | null = null

  void CapacitorApp.addListener("backButton", () => {
    if (!dispatchHardwareBack()) {
      options.onRootBack()
    }
  }).then((listener) => {
    if (removed) {
      void listener.remove()
    } else {
      handle = listener
    }
  })

  return () => {
    removed = true
    if (handle) {
      void handle.remove()
      handle = null
    }
  }
}

export function triggerLightHaptic(): void {
  if (!Capacitor.isNativePlatform()) return
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)
}

export function exitNativeApp(): void {
  if (!Capacitor.isNativePlatform()) return
  void CapacitorApp.exitApp().catch(() => undefined)
}

export function setCookModeStatusBar(
  active: boolean,
  backgroundHex = "#FAF5ED",
  lightBackground = true,
): void {
  if (!Capacitor.isNativePlatform()) return
  if (active) {
    StatusBar.setStyle({
      style: lightBackground ? Style.Light : Style.Dark,
    }).catch(() => undefined)
    StatusBar.setBackgroundColor({ color: backgroundHex }).catch(() => undefined)
  } else {
    StatusBar.setStyle({ style: Style.Light }).catch(() => undefined)
    StatusBar.setBackgroundColor({ color: "#f8fafc" }).catch(() => undefined)
  }
}
