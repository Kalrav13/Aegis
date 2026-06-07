import React from 'react';
import Head from 'next/head';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
      <Head>
        <title>TestLens Dashboard</title>
        <meta name="description" content="AI-powered QA Analyst platform" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
          TestLens
        </h1>
        <p className="text-xl text-slate-400 font-medium">
          Foundational Workspace Successfully Scaffolder.
        </p>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2 text-indigo-400 font-semibold justify-center">
            <span className="h-2 w-2 bg-indigo-400 rounded-full animate-ping"></span>
            <span>Platform Status: V1 MVP Initialized</span>
          </div>
          <p className="text-sm text-slate-500">
            TypeScript Strict Mode | Turborepo | NestJS API Gateway | PostgreSQL with Prisma | TailwindCSS styling
          </p>
        </div>
      </main>
    </div>
  );
}
