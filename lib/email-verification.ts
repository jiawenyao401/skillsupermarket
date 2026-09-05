export class EmailVerificationRequiredError extends Error {
  readonly code = "EMAIL_VERIFICATION_REQUIRED";
  constructor() {
    super("请先验证邮箱后再使用评测额度");
    this.name = "EmailVerificationRequiredError";
  }
}

export function assertVerifiedEmail(user: { emailVerified?: boolean } | null | undefined): void {
  if (user?.emailVerified !== true) throw new EmailVerificationRequiredError();
}
