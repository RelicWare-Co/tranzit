import { frontmanPlugin } from "@frontman-ai/vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function portlessUrlPlugin() {
  return {
    name: "portless-url",
    configureServer(server) {
      const portlessUrl = process.env.PORTLESS_URL;
      if (!portlessUrl) return;

      server.httpServer?.once("listening", () => {
        setTimeout(() => {
          console.log(
            `  \x1b[32m\x1b[1m➜\x1b[22m\x1b[39m  \x1b[1mPortless:\x1b[22m \x1b[36m${portlessUrl}\x1b[39m`
          );
        }, 100);
      });
    },
  };
}

const config = defineConfig({
	server: {
		proxy: {
			"/api/auth": {
				target: "https://api.tranzit.localhost",
				changeOrigin: true,
				secure: false,
			},
			"/api/rpc": {
				target: "https://api.tranzit.localhost",
				changeOrigin: true,
				secure: false,
			},
		},
	},
	plugins: [
		portlessUrlPlugin(),
		frontmanPlugin({ host: "api.frontman.sh" }),
		devtools(),
		tailwindcss(),
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		viteReact(),
	],
});

export default config;
