export default {
  async scheduled(_event, env, ctx) {
    const base = String(env.ACTA_API_BASE_URL || "").replace(/\/$/, "");
    const secret = String(env.ACTA_CRON_SECRET || "");
    if (!base || !secret) {
      console.error("ACTA_API_BASE_URL or ACTA_CRON_SECRET is missing.");
      return;
    }
    ctx.waitUntil((async () => {
      const response = await fetch(`${base}/api/notifications/daily-digest/run-due`, {
        method: "POST",
        headers: { "X-ACTA-CRON-SECRET": secret },
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`ACTA daily digest returned ${response.status}: ${body.slice(0, 500)}`);
      }
      console.log(`ACTA daily digest scheduler: ${body}`);
    })());
  },
};
