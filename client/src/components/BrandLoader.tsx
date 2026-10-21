/**
 * Full-screen loading state while the portal works out what to show (session, access, terms).
 * It looks like the last frame of the opening screen in index.html, so one flows into the other,
 * and that screen waits for this one to go away before lifting (see finishIntro in lib/motion.ts).
 */
export function BrandLoader() {
  return (
    <main className="brand-loader" role="status" aria-label="Carregando o portal">
      <img src="/icons/icon-512.png" alt="" />
      <span className="brand-loader-bar" aria-hidden="true"><i /></span>
    </main>
  );
}
