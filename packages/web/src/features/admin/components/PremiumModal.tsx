import { Modal, type ModalProps } from "@mantine/core";
import { cx } from "#/shared/lib/cx";

interface PremiumModalProps extends Omit<ModalProps, "title" | "styles"> {
	title: string;
	subtitle?: string;
	size?: "sm" | "md" | "lg" | "xl" | "2xl";
	children: React.ReactNode;
	styles?: Partial<Record<string, React.CSSProperties>>;
}

const sizeMap = {
	sm: 420,
	md: 520,
	lg: 640,
	xl: 780,
	"2xl": 960,
};

export function PremiumModal({
	title,
	subtitle,
	size = "md",
	children,
	className,
	styles,
	fullScreen,
	closeButtonProps,
	...props
}: PremiumModalProps) {
	return (
		<Modal
			{...props}
			fullScreen={fullScreen}
			closeButtonProps={{ "aria-label": "Cerrar", ...closeButtonProps }}
			size={sizeMap[size]}
			radius={fullScreen ? 0 : "md"}
			centered
			yOffset="5vh"
			scrollAreaComponent={undefined}
			overlayProps={{
				backgroundOpacity: 0.55,
				blur: 3,
			}}
			styles={{
				root: {
					overflow: "hidden",
				},
				inner: {
					padding: fullScreen ? 0 : "16px",
				},
				content: {
					border: fullScreen ? 0 : "1px solid rgba(24, 24, 27, 0.08)",
					boxShadow: fullScreen
						? "none"
						: "0 20px 40px -12px rgba(9, 9, 11, 0.25)",
					borderRadius: fullScreen ? 0 : "12px",
					maxHeight: fullScreen ? "100dvh" : "calc(100dvh - 32px)",
					overflow: "hidden",
					display: "flex",
					flexDirection: "column",
					...(styles?.content || {}),
				},
				header: {
					borderBottom: "1px solid rgba(228, 228, 231, 0.9)",
					paddingBottom: 12,
					paddingTop: 16,
					paddingLeft: 20,
					paddingRight: 20,
					flexShrink: 0,
					...(styles?.header || {}),
				},
				body: {
					paddingTop: 16,
					paddingBottom: 16,
					paddingLeft: 20,
					paddingRight: 20,
					overflowY: "auto",
					overflowX: "hidden",
					flex: 1,
					...(styles?.body || {}),
				},
			}}
			title={
				<span className="block space-y-0.5">
					<span className="block text-base font-semibold tracking-tight text-zinc-900">
						{title}
					</span>
					{subtitle ? (
						<span className="block text-sm font-normal text-zinc-500">
							{subtitle}
						</span>
					) : null}
				</span>
			}
			className={cx(className)}
		>
			{children}
		</Modal>
	);
}
