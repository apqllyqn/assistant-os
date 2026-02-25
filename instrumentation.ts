export async function register() {
  // Only run cron on the server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = await import('node-cron');
    const { refreshTasks } = await import('./lib/refresh');

    // Run every 4 hours: at minute 0 of hours 0,4,8,12,16,20
    cron.default.schedule('0 */4 * * *', async () => {
      console.log('[cron] Auto-refreshing tasks from Day.ai...');
      try {
        const result = await refreshTasks();
        console.log(`[cron] Refresh complete: ${result.added} new tasks, ${result.total} total`);
      } catch (err) {
        console.error('[cron] Refresh failed:', err);
      }
    });

    console.log('[cron] Task auto-refresh scheduled (every 4 hours)');
  }
}
