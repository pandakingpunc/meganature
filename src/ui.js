const keyActions = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE', 'KeyF', 'KeyP',
]);

export function createUI(canvas, meta, actions) {
  const find = (id) => document.getElementById(id);
  const hud = find('hud');
  const dialog = find('details');
  const explore = find('explore');
  const touchHeight = find('touch-height');
  const status = find('control-status');
  const flight = find('flight');
  const restore = find('restore-ui');
  const keys = new Set();
  const touch = { x: 0, z: 0, rise: false, lower: false };
  let photo = false;
  let drag = null;

  function clearInput() {
    keys.clear();
    touch.x = touch.z = 0;
    touch.rise = touch.lower = false;
    find('joystick').firstElementChild.style.transform = '';
  }

  function togglePhoto() {
    const returnFocus = document.activeElement === restore || document.activeElement === find('photo');
    photo = !photo;
    hud.hidden = photo;
    restore.hidden = !photo;
    if (!photo && returnFocus) find('photo').focus({ preventScroll: true });
  }

  function openDetails(section) {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    clearInput();
    find('details-controls').hidden = section !== 'controls';
    find('details-sources').hidden = section !== 'sources';
    dialog.showModal();
  }

  function activateLook() {
    if (document.pointerLockElement || dialog.open) return;
    try {
      const result = canvas.requestPointerLock();
      result?.catch(() => { status.textContent = 'Fare kilitlenemedi. Bakmak için fareyi sürükleyebilirsiniz.'; });
    } catch {
      status.textContent = 'Fare kilitlenemedi. Bakmak için fareyi sürükleyebilirsiniz.';
    }
  }

  explore.addEventListener('click', activateLook);
  flight.addEventListener('click', actions.toggleFlight);
  find('photo').addEventListener('click', togglePhoto);
  restore.addEventListener('click', togglePhoto);
  find('controls').addEventListener('click', () => openDetails('controls'));
  find('sources').addEventListener('click', () => openDetails('sources'));
  dialog.querySelector('.close').addEventListener('click', () => dialog.close());
  find('attribution').textContent = meta.attribution;
  find('dem-license').href = meta.licenseUrl;
  find('osm').href = meta.lighthouse.source;

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    hud.classList.toggle('locked', locked);
    if (!locked) clearInput();
  });
  document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === canvas) actions.look(event.movementX, event.movementY);
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || drag || document.pointerLockElement === canvas) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, type: event.pointerType };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (dx || dy) drag.moved = true;
    actions.look(dx, dy);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  canvas.addEventListener('pointerup', (event) => {
    if (drag?.id !== event.pointerId) return;
    if (drag.type === 'mouse' && !drag.moved) activateLook();
    drag = null;
  });
  canvas.addEventListener('lostpointercapture', (event) => {
    if (drag?.id === event.pointerId) drag = null;
  });

  window.addEventListener('keydown', (event) => {
    if (dialog.open || !keyActions.has(event.code) || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'KeyF') actions.toggleFlight();
    if (event.code === 'KeyP') togglePhoto();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });

  const stick = find('joystick');
  let activeStick = null;
  function steer(event) {
    const rect = stick.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const z = event.clientY - rect.top - rect.height / 2;
    const radius = rect.width * 0.34;
    const divisor = Math.max(radius, Math.hypot(x, z));
    touch.x = x / divisor;
    touch.z = z / divisor;
    stick.firstElementChild.style.transform = `translate(${touch.x * radius}px, ${touch.z * radius}px)`;
  }
  stick.addEventListener('pointerdown', (event) => {
    if (activeStick !== null) return;
    activeStick = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    steer(event);
  });
  stick.addEventListener('pointermove', (event) => { if (event.pointerId === activeStick) steer(event); });
  stick.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId !== activeStick) return;
    activeStick = null;
    touch.x = touch.z = 0;
    stick.firstElementChild.style.transform = '';
  });
  for (const id of ['rise', 'lower']) {
    const button = find(id);
    button.addEventListener('pointerdown', (event) => {
      button.setPointerCapture(event.pointerId);
      touch[id] = true;
    });
    button.addEventListener('lostpointercapture', () => { touch[id] = false; });
  }

  const elevation = find('elevation');
  const coordinates = find('coordinates');
  const heading = find('heading');
  const mode = find('mode');
  const landmark = find('landmark');
  const cardinal = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
  const tr = new Intl.NumberFormat('tr', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
  const pressed = (...codes) => codes.some((code) => keys.has(code));
  return {
    show() {
      find('loading').hidden = true;
      hud.hidden = false;
    },
    get photo() { return photo; },
    movement() {
      return {
        forward: Number(pressed('KeyW', 'ArrowUp')) - Number(pressed('KeyS', 'ArrowDown')) - touch.z,
        right: Number(pressed('KeyD', 'ArrowRight')) - Number(pressed('KeyA', 'ArrowLeft')) + touch.x,
        vertical: Number(pressed('KeyE') || touch.rise) - Number(pressed('KeyQ') || touch.lower),
        fast: pressed('ShiftLeft', 'ShiftRight'),
      };
    },
    update({ latitude, longitude, altitude, bearing, flying, nearLighthouse }) {
      elevation.textContent = `${Math.round(altitude)} m`;
      coordinates.textContent = `${tr.format(Math.abs(latitude))}° ${latitude >= 0 ? 'K' : 'G'}  ${tr.format(Math.abs(longitude))}° ${longitude >= 0 ? 'D' : 'B'}`;
      heading.textContent = `${String(Math.round(bearing) % 360).padStart(3, '0')}° ${cardinal[Math.round(bearing / 45) % 8]}`;
      landmark.textContent = nearLighthouse ? 'Kallur Feneri' : 'Kuzey Faroe';
      if (flight.getAttribute('aria-pressed') !== String(flying)) {
        flight.setAttribute('aria-pressed', String(flying));
        mode.value = flying ? 'Uçuş' : 'Yürüyüş';
        mode.parentElement.dataset.flying = String(flying);
        touchHeight.hidden = !flying;
        if (!flying) touch.rise = touch.lower = false;
      }
    },
  };
}
