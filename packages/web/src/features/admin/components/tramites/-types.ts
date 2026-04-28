type OrpcClient = typeof import("../../../lib/orpc-client").orpcClient;

export type ProcedureType = Awaited<
	ReturnType<OrpcClient["admin"]["procedures"]["list"]>
>[number];

export type ProcedureCreateInput = Parameters<
	OrpcClient["admin"]["procedures"]["create"]
>[0];
