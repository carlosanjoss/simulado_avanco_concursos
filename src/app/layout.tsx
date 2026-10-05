import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClerkProviders } from '@/components/providers';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Simulado PDF Generator - Gere simulados interativos a partir de PDFs',
  description: 'Transforme seus PDFs em simulados interativos com IA. 30 questões de múltipla escolha e feedback imediato.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ClerkProviders>
          <ThemeProvider>
            {children}
            <Toaster position="top-right" />
          </ThemeProvider>
        </ClerkProviders>
      </body>
    </html>
  );
}
