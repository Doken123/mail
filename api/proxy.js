export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const target = req.query.url;
  if (!target || (!target.startsWith("https://api.mail.tm") &&
                  !target.startsWith("https://api.mail.gw"))) {
    res.status(400).json({ error: "invalid target" });
    return;
  }

  const headers = { "Content-Type": "application/json" };
  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }

  const init = { method: req.method, headers };
  if (req.method === "POST" && req.body) {
    init.body = typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body);
  }

  try {
    const r = await fetch(target, init);
    const text = await r.text();
    res.status(r.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
