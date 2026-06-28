import http from "http";

export function startWorkerHealthServer(port: number) {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "grade-stack-worker" }));
  });

  server.listen(port, () => {
    console.log(`[grade-stack-worker] health listening on :${port}`);
  });

  return server;
}
