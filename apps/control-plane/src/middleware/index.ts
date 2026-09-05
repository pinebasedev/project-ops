import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";

export const requestIdMiddleware = requestId();
export const secureHeadersMiddleware = secureHeaders();
