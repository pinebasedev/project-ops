import { Hono } from "hono";
import { health } from "./health";

export function routes() {
  return new Hono().route("/", health);
}
