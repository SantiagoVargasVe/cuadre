import { Header } from "../_shell/Header";
import { VerifyEmailPrompt } from "../_shell/VerifyEmailPrompt";

/**
 * Auth itself is enforced by src/middleware.ts, which runs before this
 * layout and can see the pathname to build the post-login redirect — a
 * Server Component here can't. This layout only supplies the chrome.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <VerifyEmailPrompt />
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}
