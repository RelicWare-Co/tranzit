import { Button, Grid, Group, Paper, Select, Stack, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Filter, Search, XCircle } from "lucide-react";
import { useEffect } from "react";
import { entityTypes, actions } from "./constants";

export interface AuditFilters {
	entityType: string;
	actorUserId: string;
	action: string;
	dateFrom: string;
	dateTo: string;
}

export const defaultFilters: AuditFilters = {
	entityType: "",
	actorUserId: "",
	action: "",
	dateFrom: "",
	dateTo: "",
};

interface AuditFilterBarProps {
	appliedFilters: AuditFilters;
	onApply: (filters: AuditFilters) => void;
}

export function AuditFilterBar({ appliedFilters, onApply }: AuditFilterBarProps) {
	const form = useForm({
		mode: "uncontrolled",
		initialValues: appliedFilters,
	});

	// Sync form with applied filters when they change externally
	useEffect(() => {
		form.setValues(appliedFilters);
	}, [appliedFilters.entityType, appliedFilters.action, appliedFilters.actorUserId, appliedFilters.dateFrom, appliedFilters.dateTo]);

	const handleApply = () => {
		onApply(form.getValues());
	};

	const handleClear = () => {
		form.setValues(defaultFilters);
		onApply(defaultFilters);
	};

	return (
		<Paper withBorder radius="lg" p="md" shadow="sm">
			<Stack gap="md">
				<Group gap="sm" wrap="nowrap">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
						<Filter size={16} className="text-red-700" strokeWidth={1.75} />
					</div>
					<Title order={5} className="text-sm font-semibold text-zinc-900">
						Filtros de auditoría
					</Title>
				</Group>

				<Grid gap="md">
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<Select
							label="Tipo de entidad"
							placeholder="Todas las entidades"
							key={form.key("entityType")}
							{...form.getInputProps("entityType")}
							data={entityTypes}
							clearable
							size="sm"
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<Select
							label="Acción"
							placeholder="Todas las acciones"
							key={form.key("action")}
							{...form.getInputProps("action")}
							data={actions}
							clearable
							size="sm"
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<TextInput
							label="ID de actor"
							placeholder="Filtrar por usuario"
							key={form.key("actorUserId")}
							{...form.getInputProps("actorUserId")}
							size="sm"
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<TextInput
							label="Desde"
							type="date"
							key={form.key("dateFrom")}
							{...form.getInputProps("dateFrom")}
							size="sm"
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<TextInput
							label="Hasta"
							type="date"
							key={form.key("dateTo")}
							{...form.getInputProps("dateTo")}
							size="sm"
						/>
					</Grid.Col>
				</Grid>

				<Group justify="flex-end" gap="sm">
					<Button
						variant="default"
						size="sm"
						onClick={handleClear}
						leftSection={<XCircle size={14} />}
					>
						Limpiar
					</Button>
					<Button
						size="sm"
						onClick={handleApply}
						leftSection={<Search size={14} />}
					>
						Aplicar filtros
					</Button>
				</Group>
			</Stack>
		</Paper>
	);
}
