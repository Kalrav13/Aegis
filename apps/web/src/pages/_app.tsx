import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/Toast';
import { FrontendHealthProvider } from '@/providers/FrontendHealthProvider';

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 5000
      }
    }
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <FrontendHealthProvider>
        <ToastProvider>
          <Component {...pageProps} />
        </ToastProvider>
      </FrontendHealthProvider>
    </QueryClientProvider>
  );
}
