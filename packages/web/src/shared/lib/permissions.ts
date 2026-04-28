import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

const statement = {
	...defaultStatements,
	schedule: ["create", "read", "update", "delete"],
	staff: ["create", "read", "update", "delete"],
	booking: [
		"create",
		"read",
		"update",
		"delete",
		"confirm",
		"release",
		"reassign",
	],
	"reservation-series": [
		"create",
		"read",
		"update",
		"delete",
		"move",
		"release",
	],
	audit: ["read"],
} as const;

const ac = createAccessControl(statement);

export const admin = ac.newRole({
	...adminAc.statements,
	schedule: ["create", "read", "update", "delete"],
	staff: ["create", "read", "update", "delete"],
	booking: [
		"create",
		"read",
		"update",
		"delete",
		"confirm",
		"release",
		"reassign",
	],
	"reservation-series": [
		"create",
		"read",
		"update",
		"delete",
		"move",
		"release",
	],
	audit: ["read"],
});

export const staff = ac.newRole({
	schedule: ["read"],
	staff: ["read"],
	booking: ["create", "read", "update", "confirm", "release", "reassign"],
	"reservation-series": ["create", "read", "update", "move", "release"],
});

export const auditor = ac.newRole({
	schedule: ["read"],
	staff: ["read"],
	booking: ["read"],
	"reservation-series": ["read"],
	audit: ["read"],
});

export { ac, statement };
