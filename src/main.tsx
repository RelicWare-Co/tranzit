import { createTheme, MantineProvider } from "@mantine/core";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { routeTree } from "./routeTree.gen";

import "@mantine/core/styles.css";

const theme = createTheme({
	primaryColor: "red",
	fontFamily: "Inter, system-ui, sans-serif",
	headings: {
		fontFamily: "Inter, system-ui, sans-serif",
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
		<MantineProvider theme={theme} forceColorScheme="light">
			<RouterProvider router={router} />
		</MantineProvider>,
	);
}
