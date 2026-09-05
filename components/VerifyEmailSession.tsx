"use client";

import { VerifyEmailForm } from "@/components/VerifyEmailForm";

export function VerifyEmailSession({ email, returnTo, siteKey }: { email: string; returnTo: string; siteKey: string | null }) {
  return <VerifyEmailForm email={email} siteKey={siteKey} alreadySent={false} onVerified={() => window.location.replace(new URL(returnTo, window.location.origin).href)} />;
}
