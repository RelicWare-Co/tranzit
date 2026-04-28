import { Box, Text } from "@mantine/core";
import { rem } from "@mantine/core";

interface EmptyStateProps {
	icon: React.ElementType;
	title: string;
	description: string;
	action?: React.ReactNode;
}

export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
}: EmptyStateProps) {
	return (
		<Box className="flex flex-col items-center justify-center py-12 px-4 text-center">
			<Box className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-100 mb-4">
				<Icon
					style={{ width: rem(28), height: rem(28) }}
					className="text-zinc-400"
					strokeWidth={1.5}
				/>
			</Box>
			<Text className="text-base font-semibold text-zinc-900 mb-1">
				{title}
			</Text>
			<Text className="text-sm text-zinc-500 max-w-sm">{description}</Text>
			{action && <Box className="mt-4">{action}</Box>}
		</Box>
	);
}
