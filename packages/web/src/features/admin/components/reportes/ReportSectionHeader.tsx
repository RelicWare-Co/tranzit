import type { ReactNode } from "react";
import classes from "./Reportes.module.css";

interface ReportSectionHeaderProps {
	title: string;
	description: string;
	count?: number;
	countLabel?: string;
	actions?: ReactNode;
}

export function ReportSectionHeader({
	title,
	description,
	count,
	countLabel = "registros",
	actions,
}: ReportSectionHeaderProps) {
	return (
		<header className={classes.sectionHeader}>
			<div className={classes.sectionHeading}>
				<div className={classes.sectionTitleRow}>
					<h2 className={classes.sectionTitle}>{title}</h2>
					{typeof count === "number" ? (
						<span className={classes.sectionMeta}>
							{count} {count === 1 ? countLabel.replace(/s$/, "") : countLabel}
						</span>
					) : null}
				</div>
				<p className={classes.sectionDescription}>{description}</p>
			</div>
			{actions ? <div className={classes.sectionActions}>{actions}</div> : null}
		</header>
	);
}
