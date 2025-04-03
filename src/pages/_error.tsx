import { NextPage } from 'next';
import { ErrorProps } from 'next/error';
import Head from 'next/head';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

const ErrorPage: NextPage<ErrorProps> = ({ statusCode }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Head>
        <title>Error | Waboku.gg</title>
      </Head>
      <div className="w-full max-w-md p-6 rounded-lg border border-destructive/20 bg-card shadow-lg">
        <div className="flex flex-col items-center text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h1 className="text-2xl font-bold">
            {statusCode
              ? `Error ${statusCode}`
              : 'An error occurred'}
          </h1>
          <p className="text-muted-foreground">
            {statusCode
              ? `A server-side error occurred. Our team has been notified.`
              : 'An unexpected error occurred. Please try again later.'}
          </p>
          <div className="flex space-x-4 pt-4">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
            <Button
              onClick={() => window.location.href = '/'}
            >
              Go Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

ErrorPage.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default ErrorPage;