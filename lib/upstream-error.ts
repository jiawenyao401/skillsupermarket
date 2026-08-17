export class UpstreamServiceError extends Error {
  constructor(
    public readonly service: "github" | "npm" | "pypi",
    public readonly status?: number,
    message?: string
  ) {
    super(message ?? `${service} upstream service is unavailable`);
    this.name = "UpstreamServiceError";
  }
}
