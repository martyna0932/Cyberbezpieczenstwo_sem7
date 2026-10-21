(function () {
  const form = document.getElementById('password-form');
  if (!form) return;

  const minLength = Number(form.dataset.minLength);
  const minWords = Number(form.dataset.minWords);
  const passphrase = form.dataset.passphrase === '1';
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');

  function mark(rule, ok) {
    const item = form.querySelector(`[data-rule="${rule}"]`);
    if (!item) return;
    item.classList.toggle('ok', ok);
    item.classList.toggle('fail', !ok);
  }

  function update() {
    const value = newPassword.value;
    const words = value.split(/[ -]+/).filter((w) => w.length > 0).length;

    mark('length', [...value].length >= minLength);
    if (passphrase) mark('words', words >= minWords);
    mark('match', value.length > 0 && value === confirmPassword.value);
  }

  newPassword.addEventListener('input', update);
  confirmPassword.addEventListener('input', update);
})();
