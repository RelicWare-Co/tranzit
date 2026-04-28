import { Button, Card, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Filter, Search, XCircle } from "lucide-react";
import { useEffect } from "react";
import { type BookingFilters, defaultBookingFilters } from "../types";

interface BookingFiltersProps {
	filters: BookingFilters;
	onApply: (filters: BookingFilters) => void;
	isLoading: boolean;
}

export function BookingFilters({ filters, onApply, isLoading }: BookingFiltersProps) {
	const form = useForm({
		mode: "uncontrolled",
		initialValues: filters,
	});

	useEffect(() => {
		form.setValues(filters);
	}, [filters.dateFrom, filters.dateTo, filters.status, filters.isActive]);

	const handleApply = () => {
		onApply(form.getValues());
	};

	const handleClear = () => {
		form.setValues(defaultBookingFilters);
		onApply(defaultBookingFilters);
	};

	return (
		<Card className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]" radius="lg" p="md" shadow="none">
			<Stack gap="md">
				<Group gap="sm" wrap="nowrap">
					<Filter
						size={16}
						className="text-[var(--text-secondary)]"
						strokeWidth={1.75}
					/>
					<Text fw={600} size="sm" className="text-[var(--text-primary)]">
						Filtros
					</Text>
				</Group>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<TextInput
						label="Desde"
						type="date"
						size="sm"
						key={form.key("dateFrom")}
						{...form.getInputProps("dateFrom")}
					/>
					<TextInput
						label="Hasta"
						type="date"
						size="sm"
						key={form.key("dateTo")}
						{...form.getInputProps("dateTo")}
					/>
					<TextInput
						label="Estado"
						placeholder="confirmed / held"
						size="sm"
						key={form.key("status")}
						{...form.getInputProps("status")}
					/>
					<Select
						label="Activo"
						size="sm"
						key={form.key("isActive")}
						{...form.getInputProps("isActive")}
						data={[
							{ value: "all", label: "Todos" },
							{ value: "true", label: "Sí" },
							{ value: "false", label: "No" },
						]}
					/>
				</div>
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
						loading={isLoading}
						leftSection={<Search size={14} />}
					>
						Aplicar filtros
					</Button>
				</Group>
			</Stack>
		</Card>
	);
}
