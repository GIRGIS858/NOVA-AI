export class ProviderError extends Error {
  constructor(
    public code:
      | "provider_error"
      | "invalid_output"
      | "timeout"
      | "cancelled"
      | "not_configured"
      | "free_model_required"
      | "free_model_unavailable"
      | "catalog_unavailable"
      | "rate_limited"
      | "auth_failed",
  ) {
    super(code);
    this.name = "ProviderError";
  }
}
