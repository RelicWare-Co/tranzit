import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import {
	createTanstackQueryUtils,
	TANSTACK_QUERY_OPERATION_CONTEXT_SYMBOL,
	type TanstackQueryOperationContext,
} from "@orpc/tanstack-query";

type SessionResponse = {
	user: {
		id: string;
		name: string;
		email: string;
		role?: string | null;
		image?: string | null;
	};
	session: {
		id: string;
	};
};

type OnboardingStatusResponse = {
	adminExists: boolean;
};

type OnboardingBootstrapResponse = {
	success: boolean;
	role: string;
};

type RpcProcedure<TOutput> = (input?: undefined) => Promise<TOutput>;

export interface TranzitRpcClient {
	session: {
		get: RpcProcedure<SessionResponse>;
	};
	admin: {
		onboarding: {
			status: RpcProcedure<OnboardingStatusResponse>;
			bootstrap: RpcProcedure<OnboardingBootstrapResponse>;
		};
	};
}

type RpcQueryContext = TanstackQueryOperationContext;

export const orpcClient = createORPCClient<TranzitRpcClient>(
	new RPCLink<RpcQueryContext>({
		url: "/api/rpc",
		method: ({ context }) => {
			const operationType =
				context[TANSTACK_QUERY_OPERATION_CONTEXT_SYMBOL]?.type;

			// TanStack Query marks reads as non-mutations, so keep them on GET.
			if (operationType && operationType !== "mutation") {
				return "GET";
			}

			return "POST";
		},
	}),
);

export const orpc = createTanstackQueryUtils(orpcClient);
