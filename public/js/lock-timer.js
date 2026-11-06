(function () {
  const box = document.getElementById('lock-info');
  if (!box) return;

  const timer = document.getElementById('lock-timer');
  const end = Date.now() + Number(box.dataset.seconds) * 1000;

  function update() {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    timer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

    if (left === 0) {
      clearInterval(interval);
      box.className = 'alert alert-info';
      box.textContent = 'Blokada minęła. Możesz spróbować zalogować się ponownie.';
    }
  }

  const interval = setInterval(update, 1000);
  update();
})();
