import { Box, Group, Paper, Stack, Text, Title, rem } from "@mantine/core";

interface SectionCardProps {
	children: React.ReactNode;
	title: string;
	subtitle?: string;
	icon?: React.ElementType;
	action?: React.ReactNode;
}

export function SectionCard({
	children,
	title,
	subtitle,
	icon: Icon,
	action,
}: SectionCardProps) {
	return (
		<Paper withBorder radius="lg" p="md" shadow="sm">
			<Stack gap="md">
				<Group justify="space-between" wrap="nowrap">
					<Group gap="md" wrap="nowrap">
						{Icon && (
							<Box className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
								<Icon
									style={{ width: rem(20), height: rem(20) }}
									className="text-red-700"
									strokeWidth={1.75}
								/>
							</Box>
						)}
						<Stack gap={0}>
							<Title
								order={4}
								className="text-base font-semibold text-zinc-900"
							>
								{title}
							</Title>
							{subtitle && (
								<Text size="sm" className="text-zinc-500">
									{subtitle}
								</Text>
							)}
						</Stack>
					</Group>
					{action && <Group gap="xs">{action}</Group>}
				</Group>
				{children}
			</Stack>
		</Paper>
	);
}
