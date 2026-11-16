const ENDPOINT = 'https://wangfuk-court-refresh.hermanchan-925.workers.dev/refresh';
const WORKFLOW = 'https://github.com/herman925/wangfuk-court/actions/workflows/publish.yml';

export async function requestRefresh(fetcher = fetch) {
  const response = await fetcher(ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    credentials: 'omit', signal: AbortSignal.timeout(25000)
  });
  const data = await response.json();
  const nextAllowedAt = Number.isFinite(data.nextAllowedAt) ? data.nextAllowedAt : 0;
  const runUrl = /^https:\/\/github\.com\/herman925\/wangfuk-court\/actions\/runs\/\d+$/.test(data.runUrl) ? data.runUrl : WORKFLOW;
  const messages = {
    accepted: '已提出更新要求，正在抓取及驗證資料。完成後請重新整理本網站。',
    running: '已有更新流程執行中，毋須重複提出要求。完成後請重新整理本網站。',
    cooldown: '全站更新冷卻中，請查看執行紀錄及稍後再試。',
    'not-configured': '更新服務尚未完成設定，請稍後再試。',
    'upstream-failed': '未能確認更新要求是否成功，請先查看執行紀錄，避免重複執行。'
  };
  return {
    message: messages[data.status] || '更新服務暫時未能使用，請稍後再試。',
    nextAllowedAt, runUrl
  };
}

export function mountRefresh(button, feedback, progress) {
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    feedback.textContent = '正在提出更新要求…';
    let until = 0;
    try {
      const result = await requestRefresh();
      until = result.nextAllowedAt;
      feedback.textContent = result.message;
      progress.href = result.runUrl;
      if (until > Date.now()) feedback.textContent += ` 下次可提出要求：${new Date(until).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour12: false })}（香港時間）。`;
    } catch {
      feedback.textContent = '未能確認更新要求是否送達。請先查看執行紀錄；伺服器仍會限制重複要求。';
    } finally {
      button.removeAttribute('aria-busy');
      if (until > Date.now()) setTimeout(() => { button.disabled = false; }, Math.min(until - Date.now(), 1800000));
      else button.disabled = false;
    }
  });
  button.disabled = false;
}
