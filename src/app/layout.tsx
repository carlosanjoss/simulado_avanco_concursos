import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/providers';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'Avanço Simulados — Transforme seus PDFs em simulados com IA',
  description: 'Envie seus materiais de estudo (PDF) e receba 30 questões de múltipla escolha personalizadas, com justificativas detalhadas e acompanhamento de desempenho.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="font-sans">
        <AuthProvider>
          <ThemeProvider>
            {children}
            <Toaster position="top-right" />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
