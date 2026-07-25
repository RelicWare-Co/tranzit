import { Alert, Badge, Button, NumberInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { useState } from "react";
import classes from "#/features/admin/components/configuracion/Configuracion.module.css";
import { ConfigurationSectionHeader } from "#/features/admin/components/configuracion/ConfigurationSectionHeader";
import { useConfigMutations } from "#/features/admin/components/hooks/useConfigMutations";

interface SlotGenerationSectionProps {
	onRefresh: () => Promise<void>;
}

type GenerationResult = {
	generated?: number;
	errors?: string[];
};

export function SlotGenerationSection({
	onRefresh,
}: SlotGenerationSectionProps) {
	const mutations = useConfigMutations({ onSuccess: onRefresh });
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [result, setResult] = useState<GenerationResult | null>(null);

	const form = useForm({
		initialValues: {
			dateFrom: "",
			dateTo: "",
			maxDays: 31,
		},
		validate: {
			dateFrom: (value) => (!value ? "Fecha inicial requerida" : null),
			dateTo: (value, values) => {
				if (!value) return "Fecha final requerida";
				if (values.dateFrom && value < values.dateFrom) {
					return "Debe ser igual o posterior a la fecha inicial";
				}
				return null;
			},
			maxDays: (value) =>
				value < 1 || value > 365 ? "Debe estar entre 1 y 365" : null,
		},
	});

	const handleSubmit = async (values: typeof form.values) => {
		setIsSubmitting(true);
		setResult(null);
		try {
			const response = await mutations.generateSlots(values);
			setResult(response);
		} catch {
			// Mutation hooks display the request error in a notification.
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className={classes.sectionStack}>
			<ConfigurationSectionHeader
				title="Generar disponibilidad"
				description="Materializa los slots que la ciudadanía podrá reservar a partir de las reglas semanales y sus excepciones."
				meta="Operación manual"
			/>

			<div className={classes.generationLayout}>
				<aside className={classes.generationAside}>
					<h3 className={classes.utilityTitle}>Antes de generar</h3>
					<ol className={classes.processList}>
						<li className={classes.processItem}>
							<span className={classes.processNumber}>1</span>
							<span>
								Revisa que la agenda semanal tenga duración, capacidad y
								horarios correctos.
							</span>
						</li>
						<li className={classes.processItem}>
							<span className={classes.processNumber}>2</span>
							<span>
								Confirma cierres y jornadas especiales en las excepciones de
								calendario.
							</span>
						</li>
						<li className={classes.processItem}>
							<span className={classes.processNumber}>3</span>
							<span>
								Selecciona un rango acotado. El backend evita duplicar slots ya
								existentes.
							</span>
						</li>
					</ol>
				</aside>

				<form
					onSubmit={form.onSubmit(handleSubmit)}
					className={classes.generationForm}
				>
					<div className={classes.formSectionHeading}>
						<h3 className={classes.formSectionTitle}>Rango de generación</h3>
						<p className={classes.formSectionDescription}>
							El límite de días protege la operación ante rangos demasiado
							amplios.
						</p>
					</div>
					<div className={classes.formGridThree}>
						<DatePickerInput
							label="Desde"
							placeholder="Fecha inicial"
							locale="es"
							valueFormat="DD/MM/YYYY"
							clearable
							disabled={isSubmitting}
							value={form.values.dateFrom || null}
							onChange={(value) => {
								form.setFieldValue("dateFrom", value || "");
								setResult(null);
							}}
							error={form.errors.dateFrom}
						/>
						<DatePickerInput
							label="Hasta"
							placeholder="Fecha final"
							locale="es"
							valueFormat="DD/MM/YYYY"
							clearable
							disabled={isSubmitting}
							value={form.values.dateTo || null}
							onChange={(value) => {
								form.setFieldValue("dateTo", value || "");
								setResult(null);
							}}
							error={form.errors.dateTo}
						/>
						<NumberInput
							label="Máximo de días"
							description="Detiene el proceso al alcanzar este límite"
							min={1}
							max={365}
							disabled={isSubmitting}
							{...form.getInputProps("maxDays")}
						/>
					</div>

					{result ? (
						<Alert
							color={result.errors?.length ? "yellow" : "teal"}
							icon={
								result.errors?.length ? (
									<AlertCircle size={17} />
								) : (
									<CheckCircle2 size={17} />
								)
							}
							title="Generación completada"
						>
							<Badge variant="light" color="teal" radius="sm" mr="xs">
								{result.generated ?? 0} slots
							</Badge>
							{result.errors?.length
								? `${result.errors.length} fechas requieren revisión.`
								: "El rango quedó disponible para reservas."}
						</Alert>
					) : null}

					<div className={classes.sectionActions}>
						<Button
							type="submit"
							leftSection={<Sparkles size={16} />}
							loading={isSubmitting}
						>
							Generar slots
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
