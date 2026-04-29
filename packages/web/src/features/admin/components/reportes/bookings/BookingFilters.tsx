import { Button, Group, Select, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Calendar, Filter, Search, XCircle } from "lucide-react";
import { useEffect } from "react";
import {
	type BookingFilters as BookingFiltersType,
	defaultBookingFilters,
} from "../types";

interface BookingFiltersProps {
	filters: BookingFiltersType;
	onApply: (filters: BookingFiltersType) => void;
	isLoading: boolean;
}

export function BookingFilters({
	filters,
	onApply,
	isLoading,
}: BookingFiltersProps) {
	const form = useForm({
		mode: "uncontrolled",
		initialValues: filters,
	});

	const { dateFrom, dateTo, status, isActive } = filters;
	useEffect(() => {
		form.setValues({ dateFrom, dateTo, status, isActive });
	}, [dateFrom, dateTo, status, isActive, form.setValues]);

	const handleApply = () => {
		onApply(form.getValues());
	};

	const handleClear = () => {
		form.setValues(defaultBookingFilters);
		onApply(defaultBookingFilters);
	};

	return (
		<div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-end">
				<div className="flex items-center gap-2 text-[var(--text-secondary)] lg:pb-2">
					<Filter size={14} strokeWidth={1.75} />
					<span className="text-xs font-semibold uppercase tracking-wider">
						Filtros
					</span>
				</div>

				<div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<TextInput
						label="Desde"
						type="date"
						size="sm"
						leftSection={
							<Calendar size={14} className="text-[var(--text-secondary)]" />
						}
						key={form.key("dateFrom")}
						{...form.getInputProps("dateFrom")}
					/>
					<TextInput
						label="Hasta"
						type="date"
						size="sm"
						leftSection={
							<Calendar size={14} className="text-[var(--text-secondary)]" />
						}
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

				<Group gap="xs" className="lg:pb-0.5">
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
						Aplicar
					</Button>
				</Group>
			</div>
		</div>
	);
}
