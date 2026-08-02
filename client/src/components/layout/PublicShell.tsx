import type { ReactNode } from 'react';
import PageNavbar from './PageNavbar';
import PageContainer from './PageContainer';

export default function PublicShell({
  children,
  transparentNav = false,
}: {
  children: ReactNode;
  transparentNav?: boolean;
}) {
  return (
    <div className="min-h-screen surface-shell text-theme-primary">
      <PageNavbar transparent={transparentNav} />
      <main className="pt-24 pb-8">
        <PageContainer className="pt-2 pb-2">
          {children}
        </PageContainer>
      </main>
    </div>
  );
}

