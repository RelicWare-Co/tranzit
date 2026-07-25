import { Button, Select, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Search, X } from "lucide-react";
import { useEffect } from "react";
import classes from "../Reportes.module.css";
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

	const handleClear = () => {
		form.setValues(defaultBookingFilters);
		onApply(defaultBookingFilters);
	};

	return (
		<form
			className={classes.filterBar}
			onSubmit={form.onSubmit((values) => onApply(values))}
		>
			<div className={classes.filterFields}>
				<TextInput
					label="Desde"
					type="date"
					key={form.key("dateFrom")}
					{...form.getInputProps("dateFrom")}
				/>
				<TextInput
					label="Hasta"
					type="date"
					key={form.key("dateTo")}
					{...form.getInputProps("dateTo")}
				/>
				<Select
					label="Estado de la cita"
					placeholder="Todos los estados"
					clearable
					key={form.key("status")}
					{...form.getInputProps("status")}
					data={[
						{ value: "confirmed", label: "Confirmada" },
						{ value: "held", label: "Hold temporal" },
						{ value: "cancelled", label: "Cancelada" },
						{ value: "expired", label: "Expirada" },
						{ value: "attended", label: "Atendida" },
					]}
				/>
				<Select
					label="Consumo de capacidad"
					key={form.key("isActive")}
					{...form.getInputProps("isActive")}
					data={[
						{ value: "all", label: "Todas" },
						{ value: "true", label: "Solo activas" },
						{ value: "false", label: "Solo inactivas" },
					]}
				/>
			</div>

			<div className={classes.filterActions}>
				<Button
					type="button"
					variant="default"
					onClick={handleClear}
					leftSection={<X size={15} />}
				>
					Restablecer
				</Button>
				<Button
					type="submit"
					loading={isLoading}
					leftSection={<Search size={15} />}
				>
					Consultar
				</Button>
			</div>
		</form>
	);
}
