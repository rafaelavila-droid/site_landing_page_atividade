const revealElements = document.querySelectorAll(".reveal");
const heroTypedItems = Array.from(document.querySelectorAll(".hero-card .typed-item"));
const checkoutTypedItems = Array.from(document.querySelectorAll(".checkout-typed-item"));
const checkoutView = document.getElementById("checkoutView");
const checkoutOpeners = Array.from(document.querySelectorAll("[data-open-checkout]"));
const checkoutClosers = Array.from(document.querySelectorAll("[data-close-checkout]"));
const TYPING_LOOP_MS = 20000;
const CLICK_SOUND_SRC = "mouse-click-sound-fx.mp3";
const CLICK_SOUND_TARGETS = "a[href], button, [role='button'], [data-click-sound]";
const CLICK_SOUND_POOL_SIZE = 8;
const CLICK_SOUND_POOL_MAX = 24;
const CLICK_SOUND_VOLUME = 0.42;
const TYPING_SOUND_SRC = "dragon-studio-single-key-press-393908.mp3";
const TYPING_SOUND_POOL_SIZE = 18;
const TYPING_SOUND_POOL_MAX = 48;
const TYPING_SOUND_VOLUME = 0.03;
const TYPING_SOUND_PLAYBACK_RATE = 1.08;
const CHECKOUT_HASH = "#checkout";
const clickSoundPool = [];
const typingSoundPool = [];
let clickSoundPoolIndex = 0;
let typingSoundPoolIndex = 0;
let checkoutTypingLoopTimer = null;
let checkoutTypingSequenceToken = 0;
let landingScrollY = 0;
let lastFocusedElement = null;

function createClickSoundInstance() {
  const audio = new Audio(CLICK_SOUND_SRC);
  audio.preload = "auto";
  audio.volume = CLICK_SOUND_VOLUME;
  audio.load();
  return audio;
}

function createTypingSoundInstance() {
  const audio = new Audio(TYPING_SOUND_SRC);
  audio.preload = "auto";
  audio.volume = TYPING_SOUND_VOLUME;
  audio.defaultPlaybackRate = TYPING_SOUND_PLAYBACK_RATE;
  audio.playbackRate = TYPING_SOUND_PLAYBACK_RATE;
  audio.load();
  return audio;
}

function prepareClickSoundPool() {
  while (clickSoundPool.length < CLICK_SOUND_POOL_SIZE) {
    clickSoundPool.push(createClickSoundInstance());
  }
}

function prepareTypingSoundPool() {
  while (typingSoundPool.length < TYPING_SOUND_POOL_SIZE) {
    typingSoundPool.push(createTypingSoundInstance());
  }
}

function getClickSoundPlayer() {
  const availableAudio = clickSoundPool.find((audio) => {
    if (audio.paused || audio.ended) {
      return true;
    }

    if (!Number.isFinite(audio.duration) || audio.duration === 0) {
      return false;
    }

    return audio.currentTime >= audio.duration - 0.05;
  });

  if (availableAudio) {
    return availableAudio;
  }

  if (clickSoundPool.length < CLICK_SOUND_POOL_MAX) {
    const audio = createClickSoundInstance();
    clickSoundPool.push(audio);
    return audio;
  }

  const recycledAudio = clickSoundPool[clickSoundPoolIndex];
  clickSoundPoolIndex = (clickSoundPoolIndex + 1) % clickSoundPool.length;
  return recycledAudio;
}

function getTypingSoundPlayer() {
  const availableAudio = typingSoundPool.find((audio) => {
    if (audio.paused || audio.ended) {
      return true;
    }

    if (!Number.isFinite(audio.duration) || audio.duration === 0) {
      return false;
    }

    return audio.currentTime >= audio.duration - 0.02;
  });

  if (availableAudio) {
    return availableAudio;
  }

  if (typingSoundPool.length < TYPING_SOUND_POOL_MAX) {
    const audio = createTypingSoundInstance();
    typingSoundPool.push(audio);
    return audio;
  }

  const recycledAudio = typingSoundPool[typingSoundPoolIndex];
  typingSoundPoolIndex = (typingSoundPoolIndex + 1) % typingSoundPool.length;
  return recycledAudio;
}

function revealOnScroll() {
  const triggerBottom = window.innerHeight * 0.85;

  revealElements.forEach((element) => {
    const elementTop = element.getBoundingClientRect().top;

    if (elementTop < triggerBottom) {
      element.classList.add("active");
    }
  });
}

window.addEventListener("scroll", revealOnScroll);
window.addEventListener("load", revealOnScroll);
window.addEventListener("load", prepareClickSoundPool, { once: true });
window.addEventListener("load", prepareTypingSoundPool, { once: true });

document.addEventListener("dragstart", function (e) {
  e.preventDefault();
});

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function getClickableSoundTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest(CLICK_SOUND_TARGETS);
}

function canPlayClickSound(target) {
  if (!target) {
    return false;
  }

  return !(
    target.hasAttribute("disabled") ||
    target.getAttribute("aria-disabled") === "true" ||
    target.classList.contains("is-disabled")
  );
}

function playClickSound() {
  prepareClickSoundPool();

  const audio = getClickSoundPlayer();

  audio.pause();
  audio.currentTime = 0;

  const playPromise = audio.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }

  return audio;
}

function playTypingSound(character) {
  if (!character || /\s/.test(character) || prefersReducedMotion) {
    return null;
  }

  prepareTypingSoundPool();

  const audio = getTypingSoundPlayer();

  audio.pause();
  audio.currentTime = 0;

  const playPromise = audio.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }

  return audio;
}

function stopTypingSounds() {
  typingSoundPool.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
}

document.addEventListener(
  "pointerdown",
  function (event) {
    if (event.button !== 0) {
      return;
    }

    const clickableTarget = getClickableSoundTarget(event.target);

    if (!canPlayClickSound(clickableTarget)) {
      return;
    }

    playClickSound();
  },
  true
);

document.addEventListener("keydown", function (event) {
  if (event.repeat || (event.key !== "Enter" && event.key !== " ")) {
    return;
  }

  const clickableTarget = getClickableSoundTarget(event.target);

  if (!canPlayClickSound(clickableTarget)) {
    return;
  }

  playClickSound();
});

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getItemText(item, textElement) {
  return item.dataset.text || textElement.textContent || "";
}

function setItemState(item, state) {
  item.classList.remove("is-typing", "typed-done");

  if (state) {
    item.classList.add(state);
  }
}

function resetTypedItems(items, showFullText = false) {
  items.forEach((item) => {
    const textElement = item.querySelector(".typed-text");

    if (!textElement) {
      return;
    }

    setItemState(item, showFullText ? "typed-done" : "");
    textElement.textContent = showFullText ? getItemText(item, textElement) : "";
  });
}

async function typeItem(item, isCancelled = () => false) {
  const textElement = item.querySelector(".typed-text");

  if (!textElement) {
    return;
  }

  const fullText = getItemText(item, textElement);
  textElement.textContent = "";
  setItemState(item, "is-typing");

  if (prefersReducedMotion) {
    textElement.textContent = fullText;
    setItemState(item, "typed-done");
    return;
  }

  for (const character of fullText) {
    if (isCancelled()) {
      return;
    }

    textElement.textContent += character;
    playTypingSound(character);
    await wait(character === " " ? 24 : 40);
  }

  if (isCancelled()) {
    return;
  }

  setItemState(item, "typed-done");
}

function setupTypingSequence(items, triggerElement, options = {}) {
  if (!triggerElement || !items.length) {
    return null;
  }

  const { isActive = () => true } = options;
  let typingStarted = false;
  let typingSequenceRunning = false;
  let typingLoopTimer = null;
  let typingSequenceToken = 0;

  function scheduleNextTypingSequence() {
    if (!typingStarted || prefersReducedMotion || !items.length || !isActive()) {
      return;
    }

    window.clearTimeout(typingLoopTimer);
    typingLoopTimer = window.setTimeout(() => {
      startTypingSequence(true);
    }, TYPING_LOOP_MS);
  }

  function stopSequence(resetItems = false) {
    typingSequenceToken += 1;
    typingSequenceRunning = false;
    window.clearTimeout(typingLoopTimer);
    typingLoopTimer = null;
    stopTypingSounds();

    if (resetItems) {
      resetTypedItems(items, prefersReducedMotion);
    }
  }

  async function startTypingSequence(force = false) {
    if ((!typingStarted && !force) || typingSequenceRunning || !items.length || !isActive()) {
      return;
    }

    if (prefersReducedMotion) {
      resetTypedItems(items, true);
      return;
    }

    typingSequenceRunning = true;
    const currentToken = ++typingSequenceToken;
    resetTypedItems(items, false);

    for (const item of items) {
      if (currentToken !== typingSequenceToken || !isActive()) {
        typingSequenceRunning = false;
        return;
      }

      await wait(120);
      await typeItem(item, () => currentToken !== typingSequenceToken || !isActive());
    }

    if (currentToken !== typingSequenceToken || !isActive()) {
      typingSequenceRunning = false;
      return;
    }

    typingSequenceRunning = false;
    scheduleNextTypingSequence();
  }

  resetTypedItems(items, prefersReducedMotion);

  if ("IntersectionObserver" in window) {
    const typingObserver = new IntersectionObserver(
      (entries, observer) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          typingStarted = true;
          startTypingSequence(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 }
    );

    typingObserver.observe(triggerElement);
  } else {
    window.addEventListener(
      "load",
      function () {
        typingStarted = true;
        startTypingSequence(true);
      },
      { once: true }
    );
  }

  return {
    stop(resetItems = false) {
      stopSequence(resetItems);
    },
    refresh() {
      if (!typingStarted) {
        return;
      }

      if (!isActive()) {
        stopSequence(true);
        return;
      }

      if (!typingSequenceRunning) {
        startTypingSequence(true);
      }
    },
  };
}

const heroCard = document.querySelector(".hero-card");
const checkoutInfoCard = document.querySelector(".checkout-info-card");
const programToggles = Array.from(document.querySelectorAll(".program-toggle"));
const checkoutButton = document.getElementById("checkoutButton");
const checkoutTotal = document.getElementById("checkoutTotal");
const checkoutHelper = document.getElementById("checkoutHelper");
const checkoutSummaryNote = document.getElementById("checkoutSummaryNote");
const checkoutPixTotal = document.getElementById("checkoutPixTotal");
const checkoutCardTotal = document.getElementById("checkoutCardTotal");
const checkoutMethods = Array.from(document.querySelectorAll(".checkout-method"));

// Final customer-facing price configuration.
const checkoutConfig = {
  providerLabel: "Mercado Pago",
  sharedLink: "",
  pix: {
    total: 50,
    link: "https://mpago.la/2d4Yrj8",
    buttonLabel: "Ir para o pagamento com Pix",
    helper: "Pix com pagamento instant\u00e2neo e valor final j\u00e1 ajustado.",
  },
  card: {
    total: 50,
    link: "https://mpago.li/1anehxX",
    buttonLabel: "Ir para o pagamento com Cart\u00e3o",
    helper: "Cart\u00e3o com checkout seguro e valor final j\u00e1 ajustado.",
  },
};

const heroTypingController = setupTypingSequence(heroTypedItems, heroCard, {
  isActive: () => !isCheckoutActive(),
});

function isCheckoutActive() {
  return document.body.classList.contains("checkout-active");
}

function stopCheckoutTypingLoop(resetItems = false) {
  checkoutTypingSequenceToken += 1;
  window.clearTimeout(checkoutTypingLoopTimer);
  checkoutTypingLoopTimer = null;
  stopTypingSounds();

  if (resetItems && !prefersReducedMotion) {
    resetTypedItems(checkoutTypedItems, false);
  }
}

function syncTypingByActiveView() {
  if (isCheckoutActive()) {
    heroTypingController?.stop(true);
    startCheckoutTypingLoop();
    return;
  }

  stopCheckoutTypingLoop(true);
  heroTypingController?.refresh();
}

async function startCheckoutTypingLoop() {
  if (!checkoutTypedItems.length || !checkoutInfoCard) {
    return;
  }

  stopCheckoutTypingLoop(false);

  if (prefersReducedMotion) {
    resetTypedItems(checkoutTypedItems, true);
    return;
  }

  const currentToken = checkoutTypingSequenceToken;
  resetTypedItems(checkoutTypedItems, false);

  for (const item of checkoutTypedItems) {
    if (currentToken !== checkoutTypingSequenceToken || !isCheckoutActive()) {
      return;
    }

    await wait(120);
    await typeItem(item, () => currentToken !== checkoutTypingSequenceToken || !isCheckoutActive());
  }

  if (currentToken !== checkoutTypingSequenceToken || !isCheckoutActive()) {
    return;
  }

  checkoutTypingLoopTimer = window.setTimeout(() => {
    if (isCheckoutActive()) {
      startCheckoutTypingLoop();
    }
  }, TYPING_LOOP_MS);
}

function setCheckoutScreenState(isOpen) {
  document.body.classList.toggle("checkout-active", isOpen);

  if (checkoutView) {
    checkoutView.setAttribute("aria-hidden", isOpen ? "false" : "true");
  }
}

function openCheckout() {
  if (isCheckoutActive()) {
    return;
  }

  landingScrollY = window.scrollY;
  lastFocusedElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (window.location.hash !== CHECKOUT_HASH) {
    window.location.hash = "checkout";
    return;
  }

  setCheckoutScreenState(true);
  syncTypingByActiveView();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function closeCheckout() {
  if (!isCheckoutActive()) {
    return;
  }

  setCheckoutScreenState(false);
  syncTypingByActiveView();

  if (window.location.hash === CHECKOUT_HASH) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  window.scrollTo({ top: landingScrollY, behavior: "auto" });

  if (lastFocusedElement instanceof HTMLElement) {
    lastFocusedElement.focus({ preventScroll: true });
  }
}

function syncCheckoutWithHash() {
  if (window.location.hash === CHECKOUT_HASH) {
    setCheckoutScreenState(true);
    syncTypingByActiveView();
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }

  const shouldRestoreLandingState = isCheckoutActive();
  setCheckoutScreenState(false);
  syncTypingByActiveView();

  if (shouldRestoreLandingState) {
    window.scrollTo({ top: landingScrollY, behavior: "auto" });

    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus({ preventScroll: true });
    }
  }
}

checkoutOpeners.forEach((opener) => {
  opener.addEventListener("click", function (event) {
    event.preventDefault();
    openCheckout();
  });
});

checkoutClosers.forEach((closer) => {
  closer.addEventListener("click", function (event) {
    event.preventDefault();
    closeCheckout();
  });
});

window.addEventListener("hashchange", syncCheckoutWithHash);
syncCheckoutWithHash();

function setProgramItemState(item, isOpen) {
  const toggle = item?.querySelector(".program-toggle");
  const panel = item?.querySelector(".program-panel");

  if (!toggle || !panel) {
    return;
  }

  item.classList.toggle("is-open", isOpen);
  toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  panel.setAttribute("aria-hidden", isOpen ? "false" : "true");
}

programToggles.forEach((toggle) => {
  const item = toggle.closest(".program-item");

  if (!item) {
    return;
  }

  setProgramItemState(item, toggle.getAttribute("aria-expanded") === "true");

  toggle.addEventListener("click", function () {
    const shouldOpen = toggle.getAttribute("aria-expanded") !== "true";

    programToggles.forEach((otherToggle) => {
      const otherItem = otherToggle.closest(".program-item");

      if (!otherItem || otherItem === item) {
        return;
      }

      setProgramItemState(otherItem, false);
    });

    setProgramItemState(item, shouldOpen);
  });
});

function getCheckoutMethodConfig(methodName) {
  return checkoutConfig[methodName] || checkoutConfig.pix;
}

function getCheckoutLink(methodConfig) {
  return (methodConfig.link || checkoutConfig.sharedLink || "").trim();
}

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getCheckoutTotal(methodConfig) {
  return formatCurrency(Number(methodConfig.total || 0));
}

function getCheckoutFallbackLabel(methodName) {
  return methodName === "card" ? "Defina o total do cart\u00e3o" : "Defina o total do Pix";
}

function setCheckoutButtonState(enabled, label, href) {
  if (!checkoutButton) {
    return;
  }

  checkoutButton.textContent = label;
  checkoutButton.href = enabled ? href : "#";
  checkoutButton.classList.toggle("is-disabled", !enabled);
  checkoutButton.setAttribute("aria-disabled", enabled ? "false" : "true");

  if (enabled) {
    checkoutButton.setAttribute("target", "_blank");
    checkoutButton.setAttribute("rel", "noopener noreferrer");
  } else {
    checkoutButton.removeAttribute("target");
    checkoutButton.removeAttribute("rel");
  }
}

function renderCheckoutMethod(methodName) {
  const methodConfig = getCheckoutMethodConfig(methodName);
  const total = getCheckoutTotal(methodConfig);
  const link = getCheckoutLink(methodConfig);
  const hasFullConfig = Boolean(total && link);

  checkoutMethods.forEach((methodButton) => {
    const isActive = methodButton.dataset.method === methodName;
    methodButton.classList.toggle("is-active", isActive);
    methodButton.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  if (checkoutTotal) {
    checkoutTotal.textContent = total || getCheckoutFallbackLabel(methodName);
  }

  if (checkoutSummaryNote) {
    checkoutSummaryNote.textContent = hasFullConfig
      ? "Valor final fechado para o cliente."
      : "Valor final j\u00e1 calculado.";
  }

  if (checkoutHelper) {
    checkoutHelper.textContent = hasFullConfig
      ? methodConfig.helper
      : "Defina no topo de script.js o link do checkout de " + (methodName === "card" ? "cart\u00e3o" : "Pix") + " ou use sharedLink.";
  }

  setCheckoutButtonState(hasFullConfig, methodConfig.buttonLabel, link);
}

if (checkoutPixTotal) {
  checkoutPixTotal.textContent = getCheckoutTotal(checkoutConfig.pix) || "Defina o total";
}

if (checkoutCardTotal) {
  checkoutCardTotal.textContent = getCheckoutTotal(checkoutConfig.card) || "Defina o total";
}

checkoutMethods.forEach((methodButton) => {
  methodButton.addEventListener("click", function () {
    renderCheckoutMethod(methodButton.dataset.method || "pix");
  });
});

if (checkoutButton) {
  checkoutButton.addEventListener("click", function (e) {
    if (checkoutButton.classList.contains("is-disabled")) {
      e.preventDefault();
      alert("Preencha no topo de script.js o link real do checkout para liberar esse pagamento.");
    }
  });
}

if (checkoutMethods.length) {
  renderCheckoutMethod("pix");
}
