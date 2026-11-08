
// Repost-it! — Prototype isométrique

const CONFIG = {
  workDuration: 6,
  parcelReward: 35,
  dailyWage: 45,
  dayDuration: 90,
  entryCapacity: 3,
  spawnMin: 10,
  spawnMax: 12
};

const state = {
  money: 500,
  day: 1,
  dayTime: 0,
  shipped: 0,
  revenue: 0,
  paused: false,
  speed: 1,

  nextParcelId: 4,
  parcelSpawnTimer: 0,
  parcelSpawnInterval: randomSpawnInterval(),

  stations: {
    entry: [1, 2, 3],
    work: {
      active: null,
      waiting: null,
      progress: 0,
      done: false
    },
    storage: [],
    output: []
  },

  operator: {
    x: 50,
    y: 58,
    destination: null,
    stationedAt: null,
    carrying: null,
    moving: false
  },

  shipTimer: 0,
  elapsed: 0,
  stats: { received: 3, processed: 0, wages: 0 },
  processed: new Set()    // numéros des colis déjà traités
};

const stationPositions = {
  // Points où se tient l'opérateur (en % du plan isométrique)
  entry: { x: 20, y: 40 },
  work: { x: 50, y: 40 },
  storage: { x: 80, y: 40 },
  output: { x: 67, y: 70 }
};

const $ = id => document.getElementById(id);

const stationNames = {
  entry: "la zone d'entrée",
  work: "le poste de traitement",
  storage: "le stockage",
  output: "le quai d'expédition"
};

function randomSpawnInterval() {
  return CONFIG.spawnMin +
    Math.random() * (CONFIG.spawnMax - CONFIG.spawnMin);
}

// Message d'avertissement affiché quelques secondes dans la barre du bas.
const notice = { text: "", until: 0 };

function notify(text) {
  notice.text = text;
  notice.until = performance.now() + 3000;
  render();
}

// Seuls les colis déjà passés au poste de traitement peuvent être expédiés.
function refusesUnprocessed(key, parcel) {
  return key === "output" && parcel !== null && !state.processed.has(parcel);
}

function log(_message) {
  // Journal désactivé.
}

// Couleurs des colis selon leur état
const PARCEL_COLORS = {
  entry: "#b8c0c8",       // à l'entrée
  waiting: "#e76b6b",     // en attente au poste
  processing: "#f1c66e",  // en traitement
  transit: "#4a9be8",     // non traité, hors entrée (transporté / déposé en sortie)
  stock: "#ed9b45",       // non traité, en stockage
  ready: "#58c78a"        // traité
};

// Un colis est une caisse 3D alignée le long du poste.
function parcelMarkup(parcel, status, index = 0) {
  if (parcel === null || parcel === undefined) return "";

  const x = 1 + index * 20;

  return `<span class="blk pbox" style="--x:${x}%;--y:10%;--w:18%;--d:80%;` +
    `--bh:14px;--c:${PARCEL_COLORS[status]}"><b>${parcel}</b></span>`;
}

function parcelStatus(key, parcel) {
  const processed = state.processed.has(parcel);

  if (key === "entry") return "entry";
  if (key === "storage") return processed ? "ready" : "stock";
  if (key === "output") return processed ? "ready" : "transit";

  return "entry";
}

function stationContents(key) {
  if (key === "entry") return state.stations.entry;
  if (key === "storage") return state.stations.storage;
  if (key === "output") return state.stations.output;

  const work = state.stations.work;

  return [work.active, work.waiting]
    .filter(parcel => parcel !== null);
}

function renderStation(key) {
  const contents = stationContents(key);

  const capacity = {
    entry: 3,
    work: 2,
    storage: 5,
    output: 3
  }[key];

  $(`${key}Count`).textContent =
    `${contents.length} / ${capacity}`;

  let html;

  if (key === "work") {
    const work = state.stations.work;

    html =
      parcelMarkup(work.active, work.done ? "ready" : "processing", 0) +
      parcelMarkup(work.waiting, "waiting", 1);

    const percentage =
      work.active !== null && !work.done
        ? (work.progress / CONFIG.workDuration) * 100
        : work.done
          ? 100
          : 0;

    $("workProgress").style.width =
      `${Math.min(100, percentage)}%`;
  } else {
    html = contents
      .map((parcel, i) => parcelMarkup(parcel, parcelStatus(key, parcel), i))
      .join("");
  }

  // On ne reconstruit les caisses que lorsqu'elles changent.
  const row = $(`${key}Parcels`);

  if (row.dataset.html !== html) {
    row.innerHTML = html;
    row.dataset.html = html;
  }
}

const coins = n =>
  `${Math.floor(n).toLocaleString("fr-FR")}<i class="coin" role="img" aria-label="pièces"></i>`;

function formatTime(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function renderStats() {
  const st = state.stats;
  const net = state.revenue - st.wages;
  const minutes = state.elapsed / 60;

  $("stShipped").textContent = state.shipped;
  $("stRevenue").innerHTML = coins(state.revenue);
  $("stWages").innerHTML = coins(st.wages);
  $("stNet").innerHTML = (net < 0 ? "−" : "") + coins(Math.abs(net));
  $("stNet").style.color = net < 0 ? "#e76b6b" : "#58c78a";

  $("stReceived").textContent = st.received;
  $("stProcessed").textContent = st.processed;
  $("stRate").textContent =
    state.elapsed >= 20 ? `${(state.shipped / minutes).toFixed(1)} colis / min` : "—";
  $("stAvgDay").innerHTML =
    state.day > 1 || state.dayTime > 20
      ? coins(state.revenue / (state.day - 1 + state.dayTime / CONFIG.dayDuration))
      : "—";
  $("stWageDay").innerHTML = coins(CONFIG.dailyWage);
  $("stTime").textContent = formatTime(state.elapsed);
}

function render() {
  $("money").innerHTML = coins(state.money);

  $("day").textContent = state.day;
  $("shipped").textContent = state.shipped;

  $("revenue").innerHTML = coins(state.revenue);

  renderStats();

  ["entry", "work", "storage", "output"].forEach(renderStation);


  const op = state.operator;

  $("operator").style.left = `${op.x}%`;
  $("operator").style.top = `${op.y}%`;

  const carried = $("carriedParcel");

  if (op.carrying === null) {
    carried.classList.add("hidden");
    carried.textContent = "";
  } else {
    carried.classList.remove("hidden");
    carried.textContent = `#${op.carrying}`;
    carried.classList.toggle("is-processed", state.processed.has(op.carrying));
  }

  $("operatorStatus").textContent =
    op.moving
      ? "En déplacement"
      : op.carrying !== null
        ? "Transporte un colis"
        : op.stationedAt === "work"
          ? "Au poste de travail"
          : "Disponible";

  $("metricEntry").textContent =
    state.stations.entry.length;

  $("metricWork").textContent =
    stationContents("work").length;

  $("metricStorage").textContent =
    state.stations.storage.length;

  $("metricOutput").textContent =
    state.stations.output.length;

  const warning = performance.now() < notice.until;
  $("factoryHint").classList.toggle("warn", warning);

  if (warning) {
    $("factoryHint").textContent = notice.text;
  } else if (state.paused) {
    $("factoryHint").textContent = "Jeu en pause";
  } else if (op.moving) {
    $("factoryHint").textContent =
      `Déplacement vers ${stationNames[op.destination]}…`;
  } else if (op.carrying !== null) {
    $("factoryHint").textContent =
      `Transport du colis #${op.carrying} · Choisis une destination`;
  } else if (op.stationedAt === "work") {
    $("factoryHint").textContent =
      "Opérateur au poste · Ramassage automatique des colis terminés";
  } else {
    $("factoryHint").textContent =
      "Opérateur disponible · Choisis une destination";
  }

  $("pauseBtn").textContent =
    state.paused ? "▶ Reprendre" : "Ⅱ Pause";

  $("speedBtn").textContent =
    `Vitesse ×${state.speed}`;
}

function capacityFor(key) {
  return {
    entry: 3,
    work: 2,
    storage: 5,
    output: 3
  }[key];
}

function canAccept(key) {
  if (key === "work") {
    return state.stations.work.active === null ||
      state.stations.work.waiting === null;
  }

  return stationContents(key).length < capacityFor(key);
}

function takeParcel(key) {
  if (key === "entry") {
    return state.stations.entry.shift() ?? null;
  }

  if (key === "storage") {
    return state.stations.storage.shift() ?? null;
  }

  if (key === "output") {
    return state.stations.output.shift() ?? null;
  }

  if (key === "work") {
    const work = state.stations.work;

    if (work.active !== null && work.done) {
      const parcel = work.active;

      work.active = work.waiting;
      work.waiting = null;
      work.progress = 0;
      work.done = false;

      return parcel;
    }

    return null;
  }

  return null;
}

function putParcel(key, parcel) {
  // INTERDICTION DE RETOURNER À L'ENTRÉE
  // Aucun colis transporté ne peut être déposé dans cette zone.

  if (key === "entry") {
    log(`Le colis #${parcel} ne peut pas retourner à l'entrée.`);
    return false;
  }

  if (key === "work") {
    const work = state.stations.work;

    if (work.active === null) {
      work.active = parcel;
      work.progress = 0;
      work.done = false;
    } else if (work.waiting === null) {
      work.waiting = parcel;
    } else {
      return false;
    }

    return true;
  }

  if (key === "storage") {
    if (state.stations.storage.length >= 5) return false;

    state.stations.storage.push(parcel);
    return true;
  }

  if (key === "output") {
    if (refusesUnprocessed("output", parcel)) return false;
    if (state.stations.output.length >= 3) return false;

    state.stations.output.push(parcel);
    return true;
  }

  return false;
}

function interactWithStation(key) {
  const op = state.operator;

  if (op.carrying !== null) {
    if (refusesUnprocessed(key, op.carrying)) {
      notify(`Le colis #${op.carrying} n'est pas traité : passe d'abord par le poste de traitement.`);
      return;
    }

    if (!canAccept(key)) {
      log(`${stationNames[key]} est pleine.`);
      render();
      return;
    }

    const parcel = op.carrying;

    if (putParcel(key, parcel)) {
      op.carrying = null;
      log(`Colis #${parcel} déposé à ${stationNames[key]}.`);
    } else {
      // Le colis reste dans les bras de l'opérateur.
      log(`Impossible de déposer le colis #${parcel} ici.`);
    }
  } else {
    // Au stockage, c'est le joueur qui choisit le colis à prendre.
    if (key === "storage") {
      openStorageMenu();
      render();
      return;
    }

    const parcel = takeParcel(key);

    if (parcel === null) {
      log(`Aucun colis disponible à ${stationNames[key]}.`);
      render();
      return;
    }

    op.carrying = parcel;
    log(`Colis #${parcel} récupéré à ${stationNames[key]}.`);
  }

  render();
}

/*
 * RAMASSAGE AUTOMATIQUE
 *
 * Si l'opérateur est au poste de travail,
 * qu'il ne transporte rien et qu'un colis est terminé,
 * il le récupère automatiquement.
 */

function autoCollectFinishedParcel() {
  const op = state.operator;
  const work = state.stations.work;

  if (op.moving) return;
  if (op.stationedAt !== "work") return;
  if (op.carrying !== null) return;
  if (work.active === null || !work.done) return;

  const parcel = takeParcel("work");

  if (parcel !== null) {
    op.carrying = parcel;
    log(`Le colis #${parcel} est automatiquement récupéré.`);
  }
}

function moveTo(key) {
  const op = state.operator;

  if (op.moving || state.paused) return;

  const target = stationPositions[key];

  if (!target) return;

  op.destination = key;
  op.stationedAt = null;
  op.moving = true;

  const startX = op.x;
  const startY = op.y;

  const distance = Math.hypot(
    target.x - startX,
    target.y - startY
  );

  const duration = Math.max(500, distance * 35);

  let simulatedElapsed = 0;
  let lastFrame = performance.now();

  function animate(now) {
    if (!op.moving) return;

    const realDelta = Math.min(
      (now - lastFrame) / 1000,
      0.1
    );

    lastFrame = now;

    if (!state.paused) {
      simulatedElapsed +=
        realDelta * state.speed * 1000;
    }

    const elapsed = Math.min(
      1,
      simulatedElapsed / duration
    );

    const eased =
      elapsed * elapsed * (3 - 2 * elapsed);

    op.x = startX + (target.x - startX) * eased;
    op.y = startY + (target.y - startY) * eased;

    render();

    if (elapsed < 1) {
      requestAnimationFrame(animate);
    } else {
      op.moving = false;
      op.x = target.x;
      op.y = target.y;
      op.stationedAt = key;

      interactWithStation(key);

      autoCollectFinishedParcel();

      render();
    }
  }

  requestAnimationFrame(animate);
}


// ARRIVÉE DES COLIS ET EXPÉDITION

function updateArrivals(delta) {
  // Si l'entrée est pleine, le compteur revient à zéro.
  // Un nouveau décompte commence dès qu'une place se libère.
  if (state.stations.entry.length >= CONFIG.entryCapacity) {
    state.parcelSpawnTimer = 0;
    return;
  }

  state.parcelSpawnTimer += delta;

  if (state.parcelSpawnTimer >= state.parcelSpawnInterval) {
    state.stations.entry.push(state.nextParcelId++);
    state.stats.received += 1;

    state.parcelSpawnTimer = 0;
    state.parcelSpawnInterval = randomSpawnInterval();
  }
}

function updateShipping(delta) {
  const output = state.stations.output;

  if (output.length === 0) {
    state.shipTimer = 0;
    return;
  }

  state.shipTimer += delta;

  if (state.shipTimer >= 3) {
    state.shipTimer = 0;

    const parcel = output.shift();

    if (parcel !== undefined) {
      state.shipped += 1;
      state.revenue += CONFIG.parcelReward;
      state.money += CONFIG.parcelReward;

      log(`Colis #${parcel} expédié : +${CONFIG.parcelReward} e-coins.`);
    }
  }
}

// CLIC SUR LES ZONES DE L'USINE

document.querySelectorAll(".station").forEach(button => {
  button.addEventListener("click", () => {
    if (state.paused) return;

    const key = button.dataset.station;

    if (!state.operator.moving &&
        refusesUnprocessed(key, state.operator.carrying)) {
      notify(`Le colis #${state.operator.carrying} n'est pas traité : passe d'abord par le poste de traitement.`);
      return;
    }

    document.querySelectorAll(".station")
      .forEach(el => el.classList.remove("target"));

    button.classList.add("target");

    moveTo(key);
  });
});

// SÉLECTION DE L'OPÉRATEUR

$("operator").addEventListener("click", () => {
  $("operator").classList.add("selected");
});

$("operator").addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    $("operator").classList.add("selected");
  }
});

// PAUSE

$("pauseBtn").addEventListener("click", () => {
  state.paused = !state.paused;
  render();
});

// VITESSE

$("speedBtn").addEventListener("click", () => {
  state.speed =
    state.speed === 1 ? 2 :
    state.speed === 2 ? 3 : 1;

  render();
});

// BOUCLE PRINCIPALE

let previousTime = performance.now();

function gameLoop(now) {
  const realDelta = Math.min(
    (now - previousTime) / 1000,
    0.1
  );

  previousTime = now;

  if (!state.paused) {
    const delta = realDelta * state.speed;

    state.dayTime += delta;
    state.elapsed += delta;

    // ARRIVÉE DES COLIS
    updateArrivals(delta);

    // TRAITEMENT DES COLIS

    const work = state.stations.work;

    if (work.active !== null && !work.done) {
      work.progress += delta;

      if (work.progress >= CONFIG.workDuration) {
        work.progress = CONFIG.workDuration;
        work.done = true;
        state.stats.processed += 1;
        state.processed.add(work.active);

        log(`Le colis #${work.active} a terminé son traitement.`);
      }
    }

    // RAMASSAGE AUTOMATIQUE DU COLIS TERMINÉ

    autoCollectFinishedParcel();

    // EXPÉDITION AUTOMATIQUE
    updateShipping(delta);

    // CHANGEMENT DE JOUR ET SALAIRE

    if (state.dayTime >= CONFIG.dayDuration) {
      state.dayTime -= CONFIG.dayDuration;
      state.day += 1;
      state.money -= CONFIG.dailyWage;
      state.stats.wages += CONFIG.dailyWage;

      log(`Salaire journalier payé : -${CONFIG.dailyWage} e-coins.`);
    }
  }

  render();
  requestAnimationFrame(gameLoop);
}

// FENÊTRE DES RÈGLES + STATISTIQUES DÉTAILLÉES

const rulesDialog = $("rulesDialog");

$("settingsBtn").addEventListener("click", () => rulesDialog.showModal());

rulesDialog.addEventListener("click", event => {
  if (event.target === rulesDialog) rulesDialog.close();
});

$("moreStatsBtn").addEventListener("click", () => {
  const panel = $("moreStats");
  const open = panel.hidden;

  panel.hidden = !open;
  $("moreStatsBtn").setAttribute("aria-expanded", String(open));
  $("moreStatsBtn").textContent =
    open ? "Moins de statistiques ▴" : "Plus de statistiques ▾";

  // Le bouton Investissements n'est accessible que menu statistiques replié.
  $("investBtn").hidden = open;
  $("manageBtn").hidden = open;
});

// INVESTISSEMENTS (fenêtre vide pour le moment)

const investDialog = $("investDialog");

$("investBtn").addEventListener("click", () => investDialog.showModal());

investDialog.addEventListener("click", event => {
  if (event.target === investDialog) investDialog.close();
});

// MENU DU STOCKAGE : choix du colis à prendre

const storageDialog = $("storageDialog");

function choiceMarkup(parcel, color, label) {
  return `<button type="button" class="parcel-choice" data-id="${parcel}" style="--c:${color}">` +
    `<span class="pc-box"></span><b>Colis #${parcel}</b><span>${label}</span></button>`;
}

function openStorageMenu() {
  const items = state.stations.storage;
  const ready = items.filter(p => state.processed.has(p));
  const raw = items.filter(p => !state.processed.has(p));

  const fill = (id, list, color, label) => {
    $(id).innerHTML = list.length
      ? list.map(p => choiceMarkup(p, color, label)).join("")
      : '<p class="choices-empty">Aucun colis</p>';
  };

  fill("choicesReady", ready, PARCEL_COLORS.ready, "traité");
  fill("choicesRaw", raw, PARCEL_COLORS.stock, "à traiter");

  $("storageIntro").textContent = items.length
    ? "Quel colis veux-tu prendre ? Clique sur un colis pour le prendre."
    : "Le stockage est vide.";

  if (!storageDialog.open) storageDialog.showModal();
}

storageDialog.addEventListener("click", event => {
  const choice = event.target.closest(".parcel-choice");

  if (choice) {
    const parcel = Number(choice.dataset.id);
    const index = state.stations.storage.indexOf(parcel);

    if (index !== -1 && state.operator.carrying === null) {
      state.stations.storage.splice(index, 1);
      state.operator.carrying = parcel;
    }

    storageDialog.close();
    render();
    return;
  }

  if (event.target === storageDialog) storageDialog.close();
});

// GESTION DE L'USINE (fenêtre avec « Réorganiser l'usine », non cliquable pour le moment)

const manageDialog = $("manageDialog");

$("manageBtn").addEventListener("click", () => manageDialog.showModal());

manageDialog.addEventListener("click", event => {
  if (event.target === manageDialog) manageDialog.close();
});

// RÉINITIALISATION DE LA PARTIE (bouton + bouton de confirmation)

function resetConfirmation(show) {
  $("resetConfirm").hidden = !show;
  $("resetBtn").hidden = show;
}

$("resetBtn").addEventListener("click", () => resetConfirmation(true));
$("resetCancelBtn").addEventListener("click", () => resetConfirmation(false));
$("resetConfirmBtn").addEventListener("click", () => window.location.reload());

rulesDialog.addEventListener("close", () => resetConfirmation(false));

// ZOOM (molette) ET DÉPLACEMENT (glisser) DE LA ZONE DE JEU

const view = { zoom: 1, x: 0, y: 0 };
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 4;
const stageEl = $("stage");
const zoomLayer = $("zoomLayer");

function applyView() {
  const w = stageEl.clientWidth;
  const h = stageEl.clientHeight;
  const slackX = w * 0.35;
  const slackY = h * 0.35;

  const loX = Math.min(0, w * (1 - view.zoom)) - slackX;
  const hiX = Math.max(0, w * (1 - view.zoom)) + slackX;
  const loY = Math.min(0, h * (1 - view.zoom)) - slackY;
  const hiY = Math.max(0, h * (1 - view.zoom)) + slackY;

  view.x = Math.min(hiX, Math.max(loX, view.x));
  view.y = Math.min(hiY, Math.max(loY, view.y));

  zoomLayer.style.transform =
    `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
}

function zoomAt(factor, px, py) {
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, view.zoom * factor));
  const ratio = next / view.zoom;

  view.x = px - (px - view.x) * ratio;
  view.y = py - (py - view.y) * ratio;
  view.zoom = next;

  applyView();
}

stageEl.addEventListener("wheel", event => {
  event.preventDefault();

  const rect = stageEl.getBoundingClientRect();

  zoomAt(
    event.deltaY < 0 ? 1.15 : 1 / 1.15,
    event.clientX - rect.left,
    event.clientY - rect.top
  );
}, { passive: false });

const zoomButton = factor => () =>
  zoomAt(factor, stageEl.clientWidth / 2, stageEl.clientHeight / 2);

$("zoomIn").addEventListener("click", zoomButton(1.3));
$("zoomOut").addEventListener("click", zoomButton(1 / 1.3));

$("zoomReset").addEventListener("click", () => {
  view.zoom = 1;
  view.x = 0;
  view.y = 0;
  applyView();
});

let drag = null;
let dragMoved = false;

stageEl.addEventListener("pointerdown", event => {
  if (event.target.closest(".zoom-controls")) return;

  drag = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
  dragMoved = false;
});

window.addEventListener("pointermove", event => {
  if (!drag) return;

  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;

  if (!dragMoved && Math.hypot(dx, dy) < 5) return;

  dragMoved = true;
  stageEl.classList.add("dragging");

  view.x = drag.vx + dx;
  view.y = drag.vy + dy;
  applyView();
});

window.addEventListener("pointerup", () => {
  drag = null;
  stageEl.classList.remove("dragging");
});

// Un glisser ne doit pas être interprété comme un clic sur une zone.
stageEl.addEventListener("click", event => {
  if (dragMoved) {
    event.stopPropagation();
    event.preventDefault();
    dragMoved = false;
  }
}, true);

window.addEventListener("resize", applyView);

// DÉMARRAGE

render();
requestAnimationFrame(gameLoop);
