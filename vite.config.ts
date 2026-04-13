import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
	server: {
		proxy: {
			"/api/auth": {
				target: "http://localhost:3001",
				changeOrigin: true,
				secure: false,
			},
			"/api/admin": {
				target: "http://localhost:3001",
				changeOrigin: true,
				secure: false,
			},
		},
	},
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		viteReact(),
	],
});

export default config;
