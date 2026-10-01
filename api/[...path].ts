import { app } from "../src/app";

export default function handler(req: Parameters<typeof app>[0], res: Parameters<typeof app>[1]) {
	if (req.url && !req.url.startsWith("/api/")) {
		req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
	}

	return app(req, res);
}
