import { auth } from "../../features/auth/auth.config";
import { throwRpcError } from "../../shared/orpc";
import { rpc } from "../../shared/orpc/context";

export function createSessionRouter() {
	return {
		get: rpc.handler(async ({ context }) => {
			const session = await auth.api.getSession({ headers: context.headers });

			if (!session) {
				throwRpcError("UNAUTHENTICATED", 401, "Debes iniciar sesion");
			}

			return session;
		}),
	};
}
