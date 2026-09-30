let appPromise;

module.exports = async function handler(req, res) {
  try {
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