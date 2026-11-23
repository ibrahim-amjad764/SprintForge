// instrumentation.ts
//
// Next.js server startup hook — runs once per process in each
// runtime. We only bootstrap Socket.IO in the Node.js runtime;
// edge runtime has no http.Server to attach to.

export async function register() {
  // DISABLE_SOCKET_SERVER=true (e.g. Netlify/serverless hosts with no
  // persistent process or second port) skips the dedicated Socket.IO
  // server entirely. All socket code, clients, rooms, and providers
  // remain intact — hosts that can bind SOCKET_PORT get full realtime
  // by simply leaving the flag unset.
  const socketDisabled = process.env.DISABLE_SOCKET_SERVER === "true";

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    if (!socketDisabled) {
      const { startSocketServer } = await import("./server/bootstrap");
      await startSocketServer();
    }
    const { installGracefulShutdown } = await import("./server/lifecycle");
    installGracefulShutdown();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
