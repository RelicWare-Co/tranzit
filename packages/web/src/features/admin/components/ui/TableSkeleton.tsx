import { Group, Skeleton, Table } from "@mantine/core";

export function TableSkeleton() {
	return (
		<Table.Tr>
			<Table.Td>
				<Skeleton height={20} width={80} />
			</Table.Td>
			<Table.Td>
				<Skeleton height={20} width={40} />
			</Table.Td>
			<Table.Td>
				<Skeleton height={20} width={40} />
			</Table.Td>
			<Table.Td>
				<Skeleton height={20} width={60} />
			</Table.Td>
			<Table.Td>
				<Skeleton height={20} width={120} />
			</Table.Td>
			<Table.Td>
				<Skeleton height={20} width={60} />
			</Table.Td>
			<Table.Td>
				<Group gap={8}>
					<Skeleton height={28} width={60} />
					<Skeleton height={28} width={60} />
				</Group>
			</Table.Td>
		</Table.Tr>
	);
}
