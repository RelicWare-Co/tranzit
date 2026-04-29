import { app } from "./app";

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3001;

export default {
	port,
	fetch: app.fetch,
};
