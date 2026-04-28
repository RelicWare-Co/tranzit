import { os } from "@orpc/server";

export type RpcContext = {
	headers: Headers;
};

export const rpc = os.$context<RpcContext>();
