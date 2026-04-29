import { Modal, type ModalProps } from "@mantine/core";
import { cx } from "#/shared/lib/cx";

interface PremiumModalProps extends Omit<ModalProps, "title"> {
	title: string;
	subtitle?: string;
	size?: "sm" | "md" | "lg" | "xl";
	children: React.ReactNode;
}

const sizeMap = {
	sm: 420,
	md: 520,
	lg: 640,
	xl: 780,
};

export function PremiumModal({
	title,
	subtitle,
	size = "md",
	children,
	className,
	styles,
	...props
}: PremiumModalProps) {
	return (
		<Modal
			{...props}
			size={sizeMap[size]}
			radius="md"
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
					padding: "16px",
				},
				content: {
					border: "1px solid rgba(24, 24, 27, 0.08)",
					boxShadow:
						"0 20px 40px -12px rgba(9, 9, 11, 0.25)",
					borderRadius: "12px",
					maxHeight: "calc(100dvh - 32px)",
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
				<div className="space-y-0.5">
					<h2 className="text-base font-semibold tracking-tight text-zinc-900">
						{title}
					</h2>
					{subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
				</div>
			}
			className={cx(className)}
		>
			{children}
		</Modal>
	);
}
