import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import { createTheme, MantineProvider } from "@mantine/core";
import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

const theme = createTheme({
	primaryColor: "red",
});

export function renderWithProviders(
	ui: ReactElement,
	options?: Omit<RenderOptions, "wrapper">,
) {
	function Wrapper({ children }: { children: ReactNode }) {
		return (
			<MantineProvider theme={theme} forceColorScheme="light">
				{children}
			</MantineProvider>
		);
	}

	return render(ui, { wrapper: Wrapper, ...options });
}
