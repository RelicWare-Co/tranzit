import type { ReactNode } from "react";
import classes from "./Configuracion.module.css";

interface ConfigurationSectionHeaderProps {
	title: string;
	description: string;
	meta?: string;
	actions?: ReactNode;
}

export function ConfigurationSectionHeader({
	title,
	description,
	meta,
	actions,
}: ConfigurationSectionHeaderProps) {
	return (
		<header className={classes.sectionHeader}>
			<div className={classes.sectionHeading}>
				<div className={classes.sectionTitleRow}>
					<h2 className={classes.sectionTitle}>{title}</h2>
					{meta ? <span className={classes.sectionMeta}>{meta}</span> : null}
				</div>
				<p className={classes.sectionDescription}>{description}</p>
			</div>
			{actions ? <div className={classes.sectionActions}>{actions}</div> : null}
		</header>
	);
}
