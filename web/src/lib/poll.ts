// 앞 요청이 끝난 뒤에 다음 요청을 잡아 느린 연결에서 요청이 쌓이지 않게 합니다.
// 숨겨진 탭에서는 멈췄다가, 다시 보이면 바로 한 번 받고 이어 갑니다.
export function pollWhileVisible(load: () => Promise<unknown>, intervalMs = 15000): () => void {
  let stopped = false;
  let loading = false;
  let timer: number | undefined;

  const schedule = () => {
    window.clearTimeout(timer);
    if (!stopped && !document.hidden) timer = window.setTimeout(run, intervalMs);
  };
  function run() {
    if (loading) return;
    loading = true;
    load().catch(() => undefined).finally(() => { loading = false; schedule(); });
  }
  const onVisibilityChange = () => {
    window.clearTimeout(timer);
    if (!document.hidden) run();
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  schedule();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
