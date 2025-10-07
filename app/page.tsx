export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl shadow-emerald-500/5">
        <h2 className="text-2xl font-semibold text-emerald-300">Welcome to Kitchen Sync</h2>
        <p className="mt-4 text-slate-300">
          This Next.js scaffold combines Tailwind CSS styling, next-auth authentication hooks, and Prisma ORM integrations.
          It serves as the foundation for orchestrating Google-to-Google calendar synchronization using the CalendarSync CLI.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-5">
            <h3 className="text-lg font-semibold text-emerald-200">Authentication Ready</h3>
            <p className="mt-2 text-sm text-slate-400">
              next-auth will power Google sign-in, enabling multi-account linking and secure session management.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-5">
            <h3 className="text-lg font-semibold text-emerald-200">Database Connected</h3>
            <p className="mt-2 text-sm text-slate-400">
              Prisma acts as the data access layer for PostgreSQL, giving us type-safe models for users, calendars, and jobs.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-5">
            <h3 className="text-lg font-semibold text-emerald-200">Tailwind Styling</h3>
            <p className="mt-2 text-sm text-slate-400">
              TailwindCSS provides a composable design system so future dashboards and configuration flows stay consistent.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-5">
            <h3 className="text-lg font-semibold text-emerald-200">Docker Friendly</h3>
            <p className="mt-2 text-sm text-slate-400">
              A production-ready Dockerfile packages the app, paving the way for docker-compose orchestration in later tasks.
            </p>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
        <h3 className="text-xl font-semibold text-emerald-300">Next Steps</h3>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm text-slate-300">
          <li>Define Prisma schema and database migrations.</li>
          <li>Introduce docker-compose services for database and scheduler workers.</li>
          <li>Wire up next-auth Google provider and secure token handling.</li>
          <li>Integrate CalendarSync CLI execution pipelines.</li>
        </ol>
      </section>
    </div>
  );
}
