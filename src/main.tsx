import "@fontsource/geist-sans";
import { createTheme, MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./lib/AuthContext";
import { queryClient } from "./lib/query-client";
import { routeTree } from "./routeTree.gen";

import "@mantine/core/styles.css";
import "@mantine/schedule/styles.css";

const theme = createTheme({
	primaryColor: "red",
	fontFamily: "Geist, system-ui, sans-serif",
	headings: {
		fontFamily: "Geist, system-ui, sans-serif",
	},
});

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	scrollRestoration: true,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById("app");

if (rootElement && !rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<QueryClientProvider client={queryClient}>
			<MantineProvider theme={theme} forceColorScheme="light">
				<AuthProvider>
					<RouterProvider router={router} />
				</AuthProvider>
			</MantineProvider>
		</QueryClientProvider>,
	);
}
