// instrumentation.ts
//
// Next.js server startup hook — runs once per process in each
// runtime. We only bootstrap Socket.IO in the Node.js runtime;
// edge runtime has no http.Server to attach to.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    const { startSocketServer } = await import("./server/bootstrap");
    await startSocketServer();
    const { installGracefulShutdown } = await import("./server/lifecycle");
    installGracefulShutdown();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
