import app from "../server/index.mjs";

export default (req, res) => {
  if (typeof req.url === "string" && !req.url.startsWith("/api")) {
    const normalizedPath = req.url.startsWith("/") ? req.url : `/${req.url}`;
    req.url = `/api${normalizedPath}`;
  }

  return app(req, res);
};
