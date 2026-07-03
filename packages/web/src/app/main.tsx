import "@fontsource/geist-sans";
import "@fontsource/public-sans";
import "@fontsource/sora";
import { Badge, createTheme, MantineProvider, Modal, Table } from "@mantine/core";
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
	components: {
		Badge: Badge.extend({
			styles: {
				root: {
					textTransform: "none",
					fontWeight: 600,
				},
			},
		}),
		Modal: Modal.extend({
			styles: {
				content: {
					border: "1px solid var(--neutral-200)",
					boxShadow: "0 16px 48px -12px rgba(0, 0, 0, 0.18)",
					borderRadius: "16px",
				},
				header: {
					borderBottom: "1px solid var(--neutral-200)",
					paddingBottom: "14px",
					marginBottom: "4px",
				},
				body: { paddingTop: "12px" },
			},
		}),
		Table: Table.extend({
			styles: {
				thead: {
					backgroundColor: "var(--bg-secondary)",
				},
			},
		}),
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
