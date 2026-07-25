import { ActionIcon, Tooltip } from "@mantine/core";
import { CheckCircle2, X } from "lucide-react";
import classes from "./Reportes.module.css";

export interface ReportActionResult {
	actionId: string;
	response: unknown;
	message: string;
}

interface ResultFact {
	label: string;
	value: string;
}

const FACT_LABELS: Record<string, string> = {
	available: "Disponibilidad",
	canReassign: "Reasignación",
	globalCapacity: "Capacidad total",
	globalUsed: "Cupos usados",
	globalRemaining: "Cupos disponibles",
	staffCapacity: "Capacidad del funcionario",
	staffUsed: "Asignaciones del funcionario",
	staffRemaining: "Disponibilidad del funcionario",
	activeInstanceCount: "Instancias activas",
	dryRun: "Tipo de consulta",
	staleSource: "Datos de origen",
};

function formatValue(key: string, value: unknown): string | null {
	if (typeof value === "boolean") {
		if (key === "available") return value ? "Disponible" : "Sin disponibilidad";
		if (key === "canReassign") return value ? "Es viable" : "No es viable";
		if (key === "dryRun") return value ? "Vista previa" : "Operación aplicada";
		if (key === "staleSource") return value ? "Desactualizados" : "Vigentes";
		return value ? "Sí" : "No";
	}
	if (typeof value === "number")
		return new Intl.NumberFormat("es-CO").format(value);
	if (typeof value === "string" && value.trim()) return value;
	return null;
}

function getFacts(response: unknown): ResultFact[] {
	if (!response || typeof response !== "object" || Array.isArray(response)) {
		return [];
	}

	const record = response as Record<string, unknown>;
	return Object.entries(FACT_LABELS)
		.map(([key, label]) => {
			const value = formatValue(key, record[key]);
			return value ? { label, value } : null;
		})
		.filter((fact): fact is ResultFact => fact !== null)
		.slice(0, 6);
}

export function OperationResult({
	result,
	onClose,
}: {
	result: ReportActionResult;
	onClose: () => void;
}) {
	const facts = getFacts(result.response);

	return (
		<section className={classes.operationResult} aria-live="polite">
			<div className={classes.resultIcon}>
				<CheckCircle2 size={20} aria-hidden="true" />
			</div>
			<div className={classes.resultBody}>
				<p className={classes.resultTitle}>Operación completada</p>
				<p className={classes.resultDescription}>{result.message}</p>
				{facts.length > 0 ? (
					<dl className={classes.resultFacts}>
						{facts.map((fact) => (
							<div className={classes.resultFact} key={fact.label}>
								<dt>{fact.label}</dt>
								<dd>{fact.value}</dd>
							</div>
						))}
					</dl>
				) : null}
			</div>
			<Tooltip label="Cerrar resultado">
				<ActionIcon
					variant="subtle"
					color="gray"
					size={44}
					aria-label="Cerrar resultado de la operación"
					onClick={onClose}
				>
					<X size={17} />
				</ActionIcon>
			</Tooltip>
		</section>
	);
}
