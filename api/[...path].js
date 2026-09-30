let appPromise;

module.exports = async function handler(req, res) {
  try {
    // Depending on the Vercel routing mode, catch-all functions can receive
    // either "/api/..." or just the portion after "/api". The Express app
    // mounts its router at "/api", so normalize the latter before dispatch.
    if (typeof req.url === "string") {
      const requestPath = req.url.startsWith("/") ? req.url : `/${req.url}`;
      if (!requestPath.startsWith("/api")) {
        req.url = `/api${requestPath}`;
      }
    }
    appPromise ??= import("../artifacts/api-server/dist/app.mjs");
    const { default: app } = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error("Unable to load the API server:", error);
    return res.status(500).json({
      message: "The API server could not be started.",
    });
  }
};