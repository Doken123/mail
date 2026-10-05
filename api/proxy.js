const ALLOWED = ["https://api.mail.tm/", "https://api.mail.gw/"];

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const raw = req.query && req.query.url;
  const target = Array.isArray(raw) ? raw[0] : raw;

  const send = (code, obj) => {
    res.statusCode = code;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(obj));
  };

  if (!target || !ALLOWED.some((a) => target.startsWith(a))) {
    return send(400, { error: "invalid target", got: target || null });
  }

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; TempMail/1.0)",
  };
  if (req.headers.authorization) headers.Authorization = req.headers.authorization;

  const init = { method: req.method, headers };
  if (!["GET", "HEAD", "DELETE"].includes(req.method) && req.body) {
    init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  try {
    const r = await fetch(target, init);
    const text = await r.text();
    res.statusCode = r.status;
    res.setHeader("Content-Type", "application/json");
    res.end(text || "");
  } catch (e) {
    send(502, { error: "upstream failed", message: String((e && e.message) || e) });
  }
};
