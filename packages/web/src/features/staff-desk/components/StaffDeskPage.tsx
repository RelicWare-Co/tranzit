import {
	ActionIcon,
	Alert,
	Badge,
	Box,
	Card,
	Group,
	Loader,
	SegmentedControl,
	Skeleton,
	Text,
	TextInput,
	Title,
	Tooltip,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	CalendarDays,
	ChevronRight,
	CircleAlert,
	Clock3,
	FileCheck2,
	LogOut,
	RefreshCw,
	Search,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useAuth } from "#/features/auth/components/AuthContext";
import { orpcClient } from "#/shared/lib/orpc-client";
import classes from "./StaffDesk.module.css";
import { StaffDeskCaseDrawer } from "./StaffDeskCaseDrawer";
import {
	getBogotaIsoDate,
	getCasePhase,
	getErrorMessage,
	PHASE_DETAILS,
} from "./staff-desk-utils";

type StaffDeskCase = Awaited<
	ReturnType<typeof orpcClient.staffDesk.queue>
>["cases"][number];

type QueueFilter = "all" | "ready" | "in_progress" | "completed" | "incidents";

function matchesFilter(deskCase: StaffDeskCase, filter: QueueFilter) {
	const phase = getCasePhase(deskCase);
	if (filter === "all") return true;
	if (filter === "ready") return phase === "ready";
	if (filter === "in_progress") {
		return phase === "reviewing" || phase === "ready_to_complete";
	}
	if (filter === "completed") return phase === "completed";
	return phase === "cancelled" || phase === "expired";
}

function QueueCard({
	deskCase,
	isSelected,
	onClick,
}: {
	deskCase: StaffDeskCase;
	isSelected: boolean;
	onClick: () => void;
}) {
	const phase = getCasePhase(deskCase);
	const details = PHASE_DETAILS[phase];

	return (
		<button
			type="button"
			className={classes.queueCard}
			data-selected={isSelected || undefined}
			onClick={onClick}
		>
			<div className={classes.queueCardTopline}>
				<span className={classes.queueTime}>{deskCase.slot.startTime}</span>
				<Badge color={details.color} variant="light" radius="sm" size="sm">
					{details.label}
				</Badge>
			</div>
			<strong>{deskCase.request.applicantName}</strong>
			<span className={classes.queueProcedure}>
				{deskCase.request.procedure.name}
			</span>
			<span className={classes.queueReference}>
				Solicitud {deskCase.request.id.slice(0, 8)}
			</span>
			<ChevronRight
				className={classes.queueChevron}
				size={18}
				aria-hidden="true"
			/>
		</button>
	);
}

function QueueLoadingState() {
	return (
		<div
			className={classes.queueSkeleton}
			role="status"
			aria-label="Cargando agenda del funcionario"
		>
			<Skeleton height={82} radius="md" />
			<Skeleton height={82} radius="md" />
			<Skeleton height={82} radius="md" />
			<Skeleton height={82} radius="md" />
		</div>
	);
}

export function StaffDeskPage() {
	const { user, isAuthenticated, isLoading, hasRole, logout } = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [date, setDate] = useState(getBogotaIsoDate);
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<QueueFilter>("all");
	const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
	const [runningAction, setRunningAction] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [actionNotice, setActionNotice] = useState<string | null>(null);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const deferredQuery = useDeferredValue(
		query.trim().toLocaleLowerCase("es-CO"),
	);
	const hasDeskAccess = hasRole("staff");

	useEffect(() => {
		if (isLoading) return;
		if (!isAuthenticated) {
			navigate({ to: "/login", replace: true });
			return;
		}
		if (!hasDeskAccess) {
			navigate({ to: "/admin", replace: true });
		}
	}, [hasDeskAccess, isAuthenticated, isLoading, navigate]);

	const deskQueueQuery = useQuery({
		queryKey: ["staff-desk", "queue", date],
		enabled: isAuthenticated && hasDeskAccess,
		queryFn: async () => await orpcClient.staffDesk.queue({ date }),
		staleTime: 15_000,
		refetchInterval: 30_000,
		refetchOnWindowFocus: true,
	});

	const allCases = deskQueueQuery.data?.cases ?? [];
	const filteredCases = useMemo(() => {
		return allCases.filter((deskCase) => {
			if (!matchesFilter(deskCase, filter)) return false;
			if (!deferredQuery) return true;
			return [
				deskCase.request.applicantName,
				deskCase.request.documentNumber ?? "",
				deskCase.request.procedure.name,
				deskCase.request.id,
			]
				.join(" ")
				.toLocaleLowerCase("es-CO")
				.includes(deferredQuery);
		});
	}, [allCases, deferredQuery, filter]);

	const counts = useMemo(() => {
		const next = { ready: 0, inProgress: 0, completed: 0, incidents: 0 };
		for (const deskCase of allCases) {
			const phase = getCasePhase(deskCase);
			if (phase === "ready") next.ready += 1;
			else if (phase === "reviewing" || phase === "ready_to_complete")
				next.inProgress += 1;
			else if (phase === "completed") next.completed += 1;
			else next.incidents += 1;
		}
		return next;
	}, [allCases]);

	const selectedCase =
		allCases.find((deskCase) => deskCase.id === selectedCaseId) ?? null;

	useEffect(() => {
		if (selectedCaseId && !selectedCase) setSelectedCaseId(null);
	}, [selectedCase, selectedCaseId]);

	const invalidateQueue = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: ["staff-desk", "queue", date],
		});
	}, [date, queryClient]);

	const runAction = useCallback(
		async (
			action: string,
			operation: () => Promise<{ action: string; alreadyProcessed: boolean }>,
			successMessage: string,
		) => {
			setRunningAction(action);
			setActionError(null);
			setActionNotice(null);
			try {
				const response = await operation();
				setActionNotice(
					response.alreadyProcessed
						? "La operación ya se encontraba registrada."
						: successMessage,
				);
				await invalidateQueue();
			} catch (error) {
				setActionError(
					getErrorMessage(
						error,
						"No se pudo registrar la operación. Intenta de nuevo.",
					),
				);
			} finally {
				setRunningAction(null);
			}
		},
		[invalidateQueue],
	);

	const handleLogout = useCallback(async () => {
		setIsLoggingOut(true);
		try {
			await logout();
			await navigate({ to: "/login", replace: true });
		} finally {
			setIsLoggingOut(false);
		}
	}, [logout, navigate]);

	const handleCheckIn = useCallback(
		async (bookingId: string) =>
			await runAction(
				"check-in",
				async () => await orpcClient.staffDesk.checkIn({ bookingId }),
				"Recepción registrada. Puedes revisar los requisitos físicos.",
			),
		[runAction],
	);

	const handleReview = useCallback(
		async (input: Parameters<typeof orpcClient.staffDesk.review>[0]) =>
			await runAction(
				"review",
				async () => await orpcClient.staffDesk.review(input),
				"Requisitos validados. El trámite está listo para finalizar.",
			),
		[runAction],
	);

	const handleComplete = useCallback(
		async (bookingId: string) =>
			await runAction(
				"complete",
				async () => await orpcClient.staffDesk.complete({ bookingId }),
				"Trámite finalizado y cupo liberado correctamente.",
			),
		[runAction],
	);

	const handleCancel = useCallback(
		async (input: { bookingId: string; reason: string }) =>
			await runAction(
				"cancel",
				async () => await orpcClient.staffDesk.cancel(input),
				"La atención se cerró y el cupo fue liberado.",
			),
		[runAction],
	);

	if (isLoading) {
		return (
			<Box className={classes.accessLoading}>
				<Loader color="red" size="sm" />
			</Box>
		);
	}
	if (!isAuthenticated || !hasDeskAccess) return null;

	return (
		<Box className={classes.page}>
			<header className={classes.topbar}>
				<Group
					justify="space-between"
					maw={1440}
					mx="auto"
					w="100%"
					wrap="nowrap"
					gap="md"
				>
					<Link to="/atencion" className={classes.brand}>
						<span className={classes.brandMark} aria-hidden="true" />
						<span>SIMUT</span>
						<Badge color="red" variant="light" size="sm">
							Atención
						</Badge>
					</Link>
					<Group gap="sm" wrap="nowrap">
						<Text className={classes.userName}>{user?.name}</Text>
						<Badge variant="outline" color="gray" size="sm">
							Funcionario
						</Badge>
						<Tooltip label="Cerrar sesión">
							<ActionIcon
								variant="default"
								size="lg"
								loading={isLoggingOut}
								onClick={() => void handleLogout()}
								aria-label="Cerrar sesión"
							>
								<LogOut size={17} aria-hidden="true" />
							</ActionIcon>
						</Tooltip>
					</Group>
				</Group>
			</header>

			<main className={classes.main}>
				<section className={classes.hero} aria-labelledby="desk-title">
					<div>
						<p className={classes.eyebrow}>Mesa de atención</p>
						<Title order={1} id="desk-title">
							Tu jornada de atención
						</Title>
						<Text c="dimmed" className={classes.heroDescription}>
							Recibe ciudadanos, valida requisitos físicos y finaliza los
							trámites asignados sin salir de tu agenda.
						</Text>
					</div>
					<div className={classes.heroActions}>
						<TextInput
							type="date"
							label="Fecha de agenda"
							value={date}
							onChange={(event) => {
								setDate(event.currentTarget.value || getBogotaIsoDate());
								setSelectedCaseId(null);
							}}
							leftSection={<CalendarDays size={16} />}
						/>
						<Tooltip label="Actualizar agenda">
							<ActionIcon
								variant="default"
								size="lg"
								onClick={() => void deskQueueQuery.refetch()}
								loading={deskQueueQuery.isFetching}
								aria-label="Actualizar agenda"
							>
								<RefreshCw size={17} />
							</ActionIcon>
						</Tooltip>
					</div>
				</section>

				{actionNotice ? (
					<Alert
						color="teal"
						icon={<ShieldCheck size={18} />}
						title="Operación registrada"
						className={classes.notice}
					>
						{actionNotice}
					</Alert>
				) : null}

				{deskQueueQuery.isError ? (
					<Alert
						color="red"
						icon={<CircleAlert size={18} />}
						title="No pudimos cargar tu agenda"
					>
						{getErrorMessage(
							deskQueueQuery.error,
							"Verifica tu conexión e intenta actualizar la agenda.",
						)}
					</Alert>
				) : null}

				<section className={classes.statGrid} aria-label="Resumen de jornada">
					<div className={classes.statCard}>
						<span className={classes.statIcon} data-tone="blue">
							<UserRound size={18} />
						</span>
						<div>
							<strong>{counts.ready}</strong>
							<span>Por recibir</span>
						</div>
					</div>
					<div className={classes.statCard}>
						<span className={classes.statIcon} data-tone="violet">
							<FileCheck2 size={18} />
						</span>
						<div>
							<strong>{counts.inProgress}</strong>
							<span>En atención</span>
						</div>
					</div>
					<div className={classes.statCard}>
						<span className={classes.statIcon} data-tone="green">
							<ShieldCheck size={18} />
						</span>
						<div>
							<strong>{counts.completed}</strong>
							<span>Finalizados</span>
						</div>
					</div>
					<div className={classes.statCard}>
						<span className={classes.statIcon} data-tone="orange">
							<Clock3 size={18} />
						</span>
						<div>
							<strong>{counts.incidents}</strong>
							<span>Incidencias</span>
						</div>
					</div>
				</section>

				<Card
					withBorder
					radius="lg"
					padding={0}
					className={classes.queueWorkspace}
				>
					<div className={classes.queueToolbar}>
						<div>
							<Title order={2} className={classes.queueTitle}>
								Agenda asignada
							</Title>
							<Text c="dimmed" size="sm">
								Solo ves las citas asignadas a tu perfil operativo.
							</Text>
						</div>
						<TextInput
							placeholder="Buscar por nombre, documento o trámite"
							value={query}
							onChange={(event) => setQuery(event.currentTarget.value)}
							leftSection={<Search size={16} />}
							className={classes.searchInput}
							aria-label="Buscar en la agenda asignada"
						/>
					</div>
					<div className={classes.filterRow}>
						<SegmentedControl
							value={filter}
							onChange={(value) => setFilter(value as QueueFilter)}
							data={[
								{ value: "all", label: `Todas (${allCases.length})` },
								{ value: "ready", label: `Por recibir (${counts.ready})` },
								{
									value: "in_progress",
									label: `En atención (${counts.inProgress})`,
								},
								{
									value: "completed",
									label: `Finalizadas (${counts.completed})`,
								},
								{
									value: "incidents",
									label: `Incidencias (${counts.incidents})`,
								},
							]}
							className={classes.filters}
						/>
					</div>

					<div className={classes.queueList}>
						{deskQueueQuery.isPending ? <QueueLoadingState /> : null}
						{!deskQueueQuery.isPending && filteredCases.length === 0 ? (
							<div className={classes.emptyState}>
								<CalendarDays size={28} aria-hidden="true" />
								<Title order={3}>
									{allCases.length === 0
										? "No tienes citas asignadas"
										: "No hay coincidencias"}
								</Title>
								<Text c="dimmed">
									{allCases.length === 0
										? "Selecciona otra fecha o consulta con la coordinación operativa si esperabas citas en esta jornada."
										: "Prueba otro filtro o término de búsqueda."}
								</Text>
							</div>
						) : null}
						{!deskQueueQuery.isPending
							? filteredCases.map((deskCase) => (
									<QueueCard
										key={deskCase.id}
										deskCase={deskCase}
										isSelected={deskCase.id === selectedCaseId}
										onClick={() => {
											setActionError(null);
											setSelectedCaseId(deskCase.id);
										}}
									/>
								))
							: null}
					</div>
				</Card>
			</main>

			<StaffDeskCaseDrawer
				deskCase={selectedCase}
				opened={selectedCase !== null}
				onClose={() => setSelectedCaseId(null)}
				runningAction={runningAction}
				actionError={actionError}
				onCheckIn={handleCheckIn}
				onReview={handleReview}
				onComplete={handleComplete}
				onCancel={handleCancel}
			/>
		</Box>
	);
}
