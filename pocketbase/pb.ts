import { $ } from "bun";
import { join } from "path";
import { existsSync } from "fs";

// Constants
const PB_VERSION = "0.36.7";
const PB_DIR = import.meta.dir;
const PB_EXE = process.platform === "win32" ? join(PB_DIR, "pocketbase.exe") : join(PB_DIR, "pocketbase");

/**
 * Detects the OS and architecture to map to PocketBase release artifact names
 */
function getPlatformConfig() {
  const platformMap: Record<string, string> = {
    darwin: "darwin",
    linux: "linux",
    win32: "windows"
  };

  const archMap: Record<string, string> = {
    x64: "amd64",
    arm64: "arm64",
    arm: "armv7",
    ppc64: "ppc64le",
    s390x: "s390x"
  };

  const os = platformMap[process.platform];
  const arch = archMap[process.arch];

  if (!os || !arch) {
    console.error(`❌ Unsupported platform or architecture: ${process.platform} ${process.arch}`);
    process.exit(1);
  }

  return { os, arch };
}

/**
 * Downloads and extracts the correct PocketBase binary for the local machine
 */
async function downloadPocketBase() {
  if (existsSync(PB_EXE)) {
    console.log("✅ PocketBase is already installed.");
    return;
  }

  const { os, arch } = getPlatformConfig();
  const filename = `pocketbase_${PB_VERSION}_${os}_${arch}.zip`;
  const url = `https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${filename}`;
  const zipPath = join(PB_DIR, "pb.zip");

  console.log(`📥 Downloading PocketBase v${PB_VERSION} for ${os}-${arch}...`);
  
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`❌ Failed to download PocketBase. HTTP Status: ${response.status}`);
    process.exit(1);
  }
  
  await Bun.write(zipPath, response);
  
  console.log("📦 Extracting...");
  if (process.platform === "win32") {
    await $`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${PB_DIR}' -Force"`.quiet();
    await $`del ${zipPath}`.quiet();
  } else {
    await $`unzip -o ${zipPath} -d ${PB_DIR}`.quiet();
    await $`chmod +x ${PB_EXE}`;
    await $`rm ${zipPath}`.quiet();
  }
  console.log("✨ PocketBase installed successfully.");
}

/**
 * Command registry to make it highly scalable
 */
const commands: Record<string, (args: string[]) => Promise<void>> = {
  // Install / Download binary explicitly
  install: async () => {
    await downloadPocketBase();
  },
  
  // Start server
  start: async (args) => {
    if (!existsSync(PB_EXE)) await downloadPocketBase();
    console.log("🚀 Starting PocketBase...");
    await $`${PB_EXE} serve ${args}`;
  },
  
  // Manage Migrations
  migrate: async (args) => {
    if (!existsSync(PB_EXE)) await downloadPocketBase();
    console.log(`🛠️ Running migration command...`);
    await $`${PB_EXE} migrate ${args}`;
  },

  // ADD NEW COMMANDS HERE
  // backup: async (args) => { ... },
};

/**
 * Main cli entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "start";
  const commandArgs = args.slice(1);

  // Auto-route to our custom mapped commands
  if (commands[command]) {
    await commands[command](commandArgs);
  } else {
    // Fallback: Pass the command directly to PocketBase binary
    if (!existsSync(PB_EXE)) await downloadPocketBase();
    await $`${PB_EXE} ${command} ${commandArgs}`;
  }
}

main().catch((err) => {
  console.error("❌ An error occurred:", err);
  process.exit(1);
});
