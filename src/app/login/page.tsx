import { login } from "@/lib/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/", error } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form action={login} className="card p-8 w-full max-w-[380px] flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B4321F" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 1v5M12 18v5M1 12h5M18 12h5" /></svg>
          <h1 className="m-0 text-lg font-bold">Signal Hunter</h1>
        </div>
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1.5 text-[13px] text-mute">Password
          <input type="password" name="password" autoFocus required className="field h-11" />
        </label>
        {error && <p className="m-0 text-sm text-accent">That password didn&apos;t match.</p>}
        <button className="btn btn-dark h-11">Sign in</button>
      </form>
    </main>
  );
}
