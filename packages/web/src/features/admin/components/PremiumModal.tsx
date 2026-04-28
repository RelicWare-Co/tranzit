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
			radius="xl"
			centered
			yOffset="5vh"
			overlayProps={{
				backgroundOpacity: 0.55,
				blur: 8,
			}}
			styles={{
				content: {
					border: "1px solid rgba(24, 24, 27, 0.08)",
					boxShadow:
						"0 28px 56px -28px rgba(9, 9, 11, 0.35), 0 0 0 1px rgba(255,255,255,0.5) inset",
					...(styles?.content || {}),
				},
				header: {
					borderBottom: "1px solid rgba(228, 228, 231, 0.9)",
					paddingBottom: 16,
					...(styles?.header || {}),
				},
				body: {
					paddingTop: 20,
					...(styles?.body || {}),
				},
			}}
			title={
				<div className="space-y-1">
					<h2 className="text-lg font-semibold tracking-tight text-zinc-900">
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
