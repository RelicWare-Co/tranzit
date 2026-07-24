import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		env: {
			NODE_ENV: "test",
		},
		globalSetup: ["./src/test-global-setup.ts"],
		setupFiles: ["./src/test-setup.ts"],
		maxWorkers: 1,
	},
});
