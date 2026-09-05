import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="flex h-full min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Choose a new password</CardTitle>
          <CardDescription>Your new password takes effect immediately and signs out any other devices.</CardDescription>
        </CardHeader>
        <CardContent>
          {token ? <ResetPasswordForm token={token} /> : <p className="text-sm text-destructive">Missing reset token.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
