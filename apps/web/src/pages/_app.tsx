import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/Toast';
import { FrontendHealthProvider } from '@/providers/FrontendHealthProvider';
import { Loader2 } from 'lucide-react';

const publicPages = ['/login', '/signup'];

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 5000
      }
    }
  }));

  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('testlens_auth_token');
    const isPublicPath = publicPages.includes(router.pathname);

    if (!token && !isPublicPath) {
      router.push('/login');
    } else if (token && isPublicPath) {
      router.push('/');
    } else {
      setAuthChecked(true);
    }
  }, [router.pathname]);

  const isPublic = publicPages.includes(router.pathname);
  const showPageContent = authChecked || isPublic;

  return (
    <QueryClientProvider client={queryClient}>
      <FrontendHealthProvider>
        <ToastProvider>
          {showPageContent ? (
            <Component {...pageProps} />
          ) : (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Loading Session...</span>
            </div>
          )}
        </ToastProvider>
      </FrontendHealthProvider>
    </QueryClientProvider>
  );
}
