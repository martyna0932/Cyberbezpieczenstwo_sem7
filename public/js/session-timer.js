(function () {
  const idleSeconds = Number(document.body.dataset.idleSeconds);
  if (!idleSeconds) return;

  const timerEl = document.getElementById('session-timer');
  const end = Date.now() + idleSeconds * 1000;

  function update() {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    const min = Math.floor(left / 60);
    const sec = String(left % 60).padStart(2, '0');

    timerEl.textContent = `Sesja wygaśnie za ${min}:${sec}`;
    timerEl.classList.toggle('warn', left <= 60);

    if (left === 0) {
      clearInterval(interval);
      setTimeout(() => location.reload(), 2000);
    }
  }

  const interval = setInterval(update, 1000);
  update();
})();
