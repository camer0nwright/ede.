// The ede. iPhone app (SPEC decision 80): a native shell around the live site,
// so every screen, AI call and database read stays on the server as it is now.
// CAP_SERVER_URL points the app at a local dev server instead, for the Simulator
// (npm run ios:dev).
import type { CapacitorConfig } from "@capacitor/cli";

const devServer = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.trainwithede.app",
  appName: "ede.",
  // Lets the site tell the app from a browser (src/lib/app-client.ts).
  appendUserAgent: "ede-app",
  // Shown only if the site can't be reached when the app opens.
  webDir: "mobile/www",
  server: {
    url: devServer ?? "https://trainwithede.com",
    ...(devServer?.startsWith("http://") && { cleartext: true }),
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#121410",
  },
};

export default config;
