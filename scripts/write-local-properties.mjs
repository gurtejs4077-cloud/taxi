/**
 * Writes android/local.properties with sdk.dir for command-line Gradle builds.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;

if (!sdk) {
  console.error("Set ANDROID_HOME or ANDROID_SDK_ROOT to your Android SDK path.");
  process.exit(1);
}

const androidDir = path.join(root, "android");
if (!fs.existsSync(androidDir)) {
  console.error("Run: npm run android:add   (or: npx cap add android)");
  process.exit(1);
}

fs.writeFileSync(
  path.join(androidDir, "local.properties"),
  `sdk.dir=${sdk.replace(/\\/g, "\\\\")}\n`
);
console.log("[local.properties] sdk.dir=" + sdk);
