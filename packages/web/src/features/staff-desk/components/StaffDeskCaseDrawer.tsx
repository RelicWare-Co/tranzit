import {
	Alert,
	Badge,
	Box,
	Button,
	Checkbox,
	Divider,
	Drawer,
	Group,
	Modal,
	Stack,
	Text,
	Textarea,
	Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
	AlertTriangle,
	BadgeCheck,
	CalendarClock,
	CheckCircle2,
	CircleAlert,
	ClipboardCheck,
	FileCheck2,
	IdCard,
	Play,
	ShieldCheck,
	UserRoundCheck,
	XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { orpcClient } from "#/shared/lib/orpc-client";
import classes from "./StaffDesk.module.css";
import {
	formatDateTime,
	getBogotaIsoDate,
	getCasePhase,
	getDeskEvidence,
	PHASE_DETAILS,
} from "./staff-desk-utils";

type StaffDeskCase = Awaited<
	ReturnType<typeof orpcClient.staffDesk.queue>
>["cases"][number];

interface StaffDeskCaseDrawerProps {
	deskCase: StaffDeskCase | null;
	opened: boolean;
	onClose: () => void;
	runningAction: string | null;
	actionError: string | null;
	onCheckIn: (bookingId: string) => Promise<void>;
	onReview: (input: {
		bookingId: string;
		identityConfirmed: boolean;
		requirements: Array<{ id: string; present: boolean; note?: string }>;
		observations?: string;
	}) => Promise<void>;
	onComplete: (bookingId: string) => Promise<void>;
	onCancel: (input: { bookingId: string; reason: string }) => Promise<void>;
}

function StatusBadge({ deskCase }: { deskCase: StaffDeskCase }) {
	const phase = getCasePhase(deskCase);
	const details = PHASE_DETAILS[phase];
	return (
		<Badge color={details.color} variant="light" radius="sm">
			{details.label}
		</Badge>
	);
}

export function StaffDeskCaseDrawer({
	deskCase,
	opened,
	onClose,
	runningAction,
	actionError,
	onCheckIn,
	onReview,
	onComplete,
	onCancel,
}: StaffDeskCaseDrawerProps) {
	const [identityConfirmed, setIdentityConfirmed] = useState(false);
	const [reviews, setReviews] = useState<Record<string, boolean>>({});
	const [observations, setObservations] = useState("");
	const [cancellationReason, setCancellationReason] = useState("");
	const [completionOpened, completionModal] = useDisclosure(false);
	const [cancellationOpened, cancellationModal] = useDisclosure(false);

	useEffect(() => {
		if (!deskCase?.id) return;
		setIdentityConfirmed(false);
		setObservations("");
		setCancellationReason("");
		setReviews({});
	}, [deskCase?.id]);

	const missingRequired = useMemo(
		() =>
			deskCase?.request.requirements.filter(
				(requirement) => requirement.isRequired && !reviews[requirement.id],
			) ?? [],
		[deskCase?.request.requirements, reviews],
	);

	if (!deskCase) return null;

	const phase = getCasePhase(deskCase);
	const evidence = getDeskEvidence(deskCase);
	const isOperationalDate = deskCase.slot.slotDate === getBogotaIsoDate();
	const canCheckIn =
		isOperationalDate &&
		phase === "ready" &&
		deskCase.status === "confirmed" &&
		deskCase.isActive;
	const isReviewing = isOperationalDate && phase === "reviewing";
	const isReadyToComplete = isOperationalDate && phase === "ready_to_complete";
	const canCancel =
		isOperationalDate &&
		deskCase.isActive &&
		deskCase.status === "confirmed" &&
		!["completed", "cancelled", "expired"].includes(phase);
	const isActionRunning = runningAction !== null;

	const runReview = async () => {
		await onReview({
			bookingId: deskCase.id,
			identityConfirmed,
			requirements: deskCase.request.requirements.map((requirement) => ({
				id: requirement.id,
				present: reviews[requirement.id] === true,
			})),
			observations: observations.trim() || undefined,
		});
	};

	return (
		<>
			<Drawer
				opened={opened}
				onClose={onClose}
				position="right"
				size="xl"
				title="Atención del ciudadano"
				classNames={{
					content: classes.drawerContent,
					header: classes.drawerHeader,
				}}
				overlayProps={{ backgroundOpacity: 0.24, blur: 1 }}
			>
				<Stack gap="lg" className={classes.drawerStack}>
					<section aria-labelledby="case-title">
						<Group
							justify="space-between"
							align="flex-start"
							gap="sm"
							wrap="nowrap"
						>
							<div>
								<Text className={classes.eyebrow}>
									Solicitud {deskCase.request.id.slice(0, 8)}
								</Text>
								<Title order={2} id="case-title" className={classes.caseTitle}>
									{deskCase.request.applicantName}
								</Title>
								<Text className={classes.caseProcedure}>
									{deskCase.request.procedure.name}
								</Text>
							</div>
							<StatusBadge deskCase={deskCase} />
						</Group>
						<div className={classes.appointmentStrip}>
							<Text fw={650} size="sm">
								{deskCase.slot.slotDate} · {deskCase.slot.startTime} –{" "}
								{deskCase.slot.endTime}
							</Text>
							<Text c="dimmed" size="xs">
								Cita {deskCase.id.slice(0, 8)}
							</Text>
						</div>
					</section>

					{actionError ? (
						<Alert
							color="red"
							icon={<CircleAlert size={18} />}
							title="No se pudo registrar la operación"
						>
							{actionError}
						</Alert>
					) : null}

					<section
						className={classes.detailSection}
						aria-labelledby="citizen-data-title"
					>
						<div className={classes.sectionHeading}>
							<IdCard size={17} aria-hidden="true" />
							<h3 id="citizen-data-title">Identificación y contacto</h3>
						</div>
						<div className={classes.detailsGrid}>
							<div>
								<span>Documento</span>
								<strong>
									{deskCase.request.documentType ?? "Documento"}{" "}
									{deskCase.request.documentNumber ?? "Sin registrar"}
								</strong>
							</div>
							<div>
								<span>Correo</span>
								<strong>{deskCase.request.email}</strong>
							</div>
							{deskCase.request.phone ? (
								<div>
									<span>Teléfono</span>
									<strong>{deskCase.request.phone}</strong>
								</div>
							) : null}
							{deskCase.request.plate ? (
								<div>
									<span>Placa</span>
									<strong>{deskCase.request.plate}</strong>
								</div>
							) : null}
						</div>
					</section>

					{!isOperationalDate &&
					phase !== "completed" &&
					phase !== "cancelled" &&
					phase !== "expired" ? (
						<Alert
							color="blue"
							variant="light"
							icon={<CalendarClock size={18} />}
							title="Consulta de solo lectura"
						>
							La recepción, validación y cierre solo están disponibles el día de
							la cita en horario de Colombia.
						</Alert>
					) : null}

					{canCheckIn ? (
						<section
							className={classes.actionStage}
							aria-labelledby="checkin-title"
						>
							<div className={classes.stageIcon} data-tone="blue">
								<UserRoundCheck size={20} aria-hidden="true" />
							</div>
							<div>
								<h3 id="checkin-title">1. Recibir al ciudadano</h3>
								<p>
									Confirma que la persona está presente para abrir la revisión
									de identidad y requisitos de esta cita confirmada.
								</p>
							</div>
							<Button
								leftSection={<Play size={16} />}
								onClick={() => void onCheckIn(deskCase.id)}
								loading={runningAction === "check-in"}
								disabled={isActionRunning}
							>
								Registrar recepción
							</Button>
						</section>
					) : null}

					{isReviewing ? (
						<section
							className={classes.reviewSection}
							aria-labelledby="review-title"
						>
							<div className={classes.sectionHeading}>
								<ClipboardCheck size={18} aria-hidden="true" />
								<h3 id="review-title">2. Validar requisitos físicos</h3>
							</div>
							<Text c="dimmed" size="sm">
								La lista proviene de la versión del trámite con la que el
								ciudadano agendó. No se modifica si la configuración actual
								cambia.
							</Text>
							<Checkbox
								checked={identityConfirmed}
								onChange={(event) =>
									setIdentityConfirmed(event.currentTarget.checked)
								}
								label="Verifiqué la identidad del ciudadano contra su documento físico"
								className={classes.identityCheck}
							/>
							<div className={classes.requirementsList}>
								{deskCase.request.requirements.length === 0 ? (
									<Alert
										color="gray"
										variant="light"
										icon={<FileCheck2 size={17} />}
									>
										Este trámite no tiene requisitos físicos configurados. Aún
										debes verificar la identidad y registrar la validación.
									</Alert>
								) : (
									deskCase.request.requirements.map((requirement) => (
										<Checkbox
											key={requirement.id}
											checked={reviews[requirement.id] === true}
onChange={(event) => {
											const checked = event.currentTarget.checked;
											setReviews((current) => ({
												...current,
												[requirement.id]: checked,
											}));
										}}
											label={
												<Box>
													<Text component="span" fw={600} size="sm">
														{requirement.name}
														{requirement.isRequired
															? " · Obligatorio"
															: " · Opcional"}
													</Text>
													{requirement.description ? (
														<Text
															component="span"
															className={classes.requirementDescription}
														>
															{requirement.description}
														</Text>
													) : null}
												</Box>
											}
										/>
									))
								)}
							</div>
							<Textarea
								label="Observaciones de la revisión"
								placeholder="Registra solo información necesaria para la trazabilidad de esta atención"
								value={observations}
								onChange={(event) => setObservations(event.currentTarget.value)}
								maxLength={2000}
								autosize
								minRows={3}
							/>
							{missingRequired.length > 0 ? (
								<Alert color="yellow" icon={<AlertTriangle size={17} />}>
									Faltan {missingRequired.length} requisito
									{missingRequired.length === 1 ? "" : "s"} obligatorio
									{missingRequired.length === 1 ? "" : "s"} por validar.
								</Alert>
							) : null}
							<Group justify="flex-end">
								<Button
									leftSection={<ShieldCheck size={16} />}
									onClick={() => void runReview()}
									loading={runningAction === "review"}
									disabled={
										isActionRunning ||
										!identityConfirmed ||
										missingRequired.length > 0
									}
								>
									Validar y continuar
								</Button>
							</Group>
						</section>
					) : null}

					{isReadyToComplete ? (
						<section
							className={classes.actionStage}
							data-ready
							aria-labelledby="completion-title"
						>
							<div className={classes.stageIcon} data-tone="green">
								<BadgeCheck size={20} aria-hidden="true" />
							</div>
							<div>
								<h3 id="completion-title">3. Finalizar trámite</h3>
								<p>
									Los requisitos ya fueron validados. Al completar, se cierra la
									solicitud y se libera el cupo de la agenda en una sola
									operación trazable.
								</p>
							</div>
							<Button
								color="teal"
								leftSection={<CheckCircle2 size={16} />}
								onClick={completionModal.open}
								disabled={isActionRunning}
							>
								Completar trámite
							</Button>
						</section>
					) : null}

					{phase === "completed" ? (
						<Alert
							color="teal"
							icon={<CheckCircle2 size={18} />}
							title="Trámite finalizado"
						>
							La atención quedó registrada el{" "}
							{formatDateTime(deskCase.attendedAt)}. El cupo ya no consume
							capacidad.
						</Alert>
					) : null}

					{phase === "cancelled" || phase === "expired" ? (
						<Alert
							color="gray"
							icon={<XCircle size={18} />}
							title={PHASE_DETAILS[phase].label}
						>
							{deskCase.statusReason ?? "Esta atención no se encuentra activa."}
						</Alert>
					) : null}

					<section
						className={classes.traceSection}
						aria-labelledby="trace-title"
					>
						<Divider />
						<div className={classes.sectionHeading}>
							<ClipboardCheck size={17} aria-hidden="true" />
							<h3 id="trace-title">Trazabilidad de la atención</h3>
						</div>
						<ul className={classes.traceList}>
							<li>
								<span className={classes.traceDot} />
								<div>
									<strong>Cita programada</strong>
									<span>
										{deskCase.slot.slotDate} · {deskCase.slot.startTime}
									</span>
								</div>
							</li>
							{evidence.checkedInAt ? (
								<li>
									<span className={classes.traceDot} />
									<div>
										<strong>Recepción registrada</strong>
										<span>{formatDateTime(evidence.checkedInAt)}</span>
									</div>
								</li>
							) : null}
							{evidence.reviewedAt ? (
								<li>
									<span className={classes.traceDot} />
									<div>
										<strong>Requisitos validados</strong>
										<span>{formatDateTime(evidence.reviewedAt)}</span>
									</div>
								</li>
							) : null}
							{deskCase.attendedAt ? (
								<li>
									<span className={classes.traceDot} />
									<div>
										<strong>Atención finalizada</strong>
										<span>{formatDateTime(deskCase.attendedAt)}</span>
									</div>
								</li>
							) : null}
						</ul>
					</section>

					{canCancel ? (
						<Group justify="flex-end" className={classes.cancelAction}>
							<Button
								variant="subtle"
								color="red"
								leftSection={<XCircle size={16} />}
								onClick={cancellationModal.open}
								disabled={isActionRunning}
							>
								Cerrar sin completar
							</Button>
						</Group>
					) : null}
				</Stack>
			</Drawer>

			<Modal
				opened={completionOpened}
				onClose={completionModal.close}
				title="Confirmar finalización del trámite"
				centered
				closeOnClickOutside={!isActionRunning}
				closeOnEscape={!isActionRunning}
			>
				<Stack gap="md">
					<Text>
						Se cerrará el trámite de {deskCase.request.applicantName} y la cita
						dejará de consumir capacidad. La operación queda registrada en
						auditoría.
					</Text>
					<Group justify="flex-end">
						<Button
							variant="default"
							onClick={completionModal.close}
							disabled={isActionRunning}
						>
							Volver
						</Button>
						<Button
							color="teal"
							leftSection={<CheckCircle2 size={16} />}
							loading={runningAction === "complete"}
							onClick={() => {
								completionModal.close();
								void onComplete(deskCase.id);
							}}
						>
							Confirmar finalización
						</Button>
					</Group>
				</Stack>
			</Modal>

			<Modal
				opened={cancellationOpened}
				onClose={cancellationModal.close}
				title="Cerrar atención sin completar"
				centered
				closeOnClickOutside={!isActionRunning}
				closeOnEscape={!isActionRunning}
			>
				<Stack gap="md">
					<Alert color="yellow" icon={<AlertTriangle size={18} />}>
						La cita se cancelará y el cupo se liberará. Indica una razón
						objetiva para la trazabilidad institucional.
					</Alert>
					<Textarea
						label="Razón del cierre"
						placeholder="Ej. El ciudadano no presentó el documento de identidad requerido"
						value={cancellationReason}
						onChange={(event) =>
							setCancellationReason(event.currentTarget.value)
						}
						maxLength={1000}
						autosize
						minRows={3}
						required
					/>
					<Group justify="flex-end">
						<Button
							variant="default"
							onClick={cancellationModal.close}
							disabled={isActionRunning}
						>
							Conservar atención
						</Button>
						<Button
							color="red"
							loading={runningAction === "cancel"}
							disabled={cancellationReason.trim().length < 3}
							onClick={() => {
								cancellationModal.close();
								void onCancel({
									bookingId: deskCase.id,
									reason: cancellationReason,
								});
							}}
						>
							Cerrar atención
						</Button>
					</Group>
				</Stack>
			</Modal>
		</>
	);
}
