import "@fontsource/geist-sans";
import { createTheme, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "#/features/auth/components/AuthContext";
import { queryClient } from "#/shared/lib/query-client";
import { routeTree } from "../routeTree.gen";

import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/schedule/styles.css";
import "@mantine/notifications/styles.css";

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
				<Notifications position="top-right" zIndex={1000} />
				<AuthProvider>
					<RouterProvider router={router} />
				</AuthProvider>
			</MantineProvider>
		</QueryClientProvider>,
	);
}
