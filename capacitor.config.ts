import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "lk.udenisspecials.bakery",
  appName: "Udeni's Specials",
  webDir: "dist",
  android: {
    backgroundColor: "#f8fafc",
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: "LIGHT",
      backgroundColor: "#f8fafc",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
}

export default config
