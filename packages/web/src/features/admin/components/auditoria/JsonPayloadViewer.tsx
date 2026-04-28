import { Button, Collapse, Paper, Stack, Text } from "@mantine/core";
import { rem } from "@mantine/core";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface JsonPayloadViewerProps {
	payload: Record<string, unknown>;
}

function stringifyJson(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

export function JsonPayloadViewer({ payload }: JsonPayloadViewerProps) {
	const [expanded, setExpanded] = useState(false);
	const hasPayload = Object.keys(payload).length > 0;

	if (!hasPayload) {
		return (
			<Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
				Sin payload adicional
			</Text>
		);
	}

	return (
		<Stack gap="xs">
			<Button
				variant="subtle"
				size="compact-xs"
				onClick={() => setExpanded(!expanded)}
				leftSection={
					expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />
				}
			>
				{expanded ? "Ocultar payload JSON" : "Ver payload JSON"}
			</Button>
			<Collapse expanded={expanded}>
				<Paper withBorder p="sm" bg="gray.0" radius="md">
					<pre
						style={{
							fontSize: rem(11),
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
							margin: 0,
							maxHeight: 300,
							overflow: "auto",
							fontFamily: "monospace",
						}}
					>
						{stringifyJson(payload)}
					</pre>
				</Paper>
			</Collapse>
		</Stack>
	);
}
