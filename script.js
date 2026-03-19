const revealElements = document.querySelectorAll(".reveal");
const heroDesktopTypedItems = Array.from(document.querySelectorAll(".hero-card--desktop .typed-item"));
const heroMobileTypedItems = Array.from(document.querySelectorAll(".hero-card--mobile .typed-item"));
const checkoutTypedItems = Array.from(document.querySelectorAll(".checkout-typed-item"));
const checkoutView = document.getElementById("checkoutView");
const checkoutOpeners = Array.from(document.querySelectorAll("[data-open-checkout]"));
const checkoutClosers = Array.from(document.querySelectorAll("[data-close-checkout]"));
const mobileNavToggle = document.querySelector("[data-mobile-nav-toggle]");
const mobileNavPanel = document.querySelector("[data-mobile-nav-panel]");
const mobileNavLinks = Array.from(document.querySelectorAll(".mobile-nav-link"));
const TYPING_LOOP_MS = 20000;
const CLICK_SOUND_SRC = "mouse-click-sound-fx.mp3";
const CLICK_SOUND_TARGETS = "a[href], button, [role='button'], [data-click-sound]";
const CLICK_SOUND_POOL_SIZE = 8;
const CLICK_SOUND_POOL_MAX = 24;
const CLICK_SOUND_VOLUME = 0.30;
const TYPING_SOUND_SRC = "dragon-studio-single-key-press-393908.mp3";
const TYPING_SOUND_POOL_SIZE = 6;
const TYPING_SOUND_POOL_MAX = 12;
const TYPING_SOUND_VOLUME = 0.03;
const TYPING_SOUND_PLAYBACK_RATE = 1.08;
const TYPING_SOUND_MIN_INTERVAL_MS = 85;
const CHECKOUT_HASH = "#checkout";
const clickSoundPool = [];
const typingSoundPool = [];
let clickSoundPoolIndex = 0;
let typingSoundPoolIndex = 0;
let lastTypingSoundAt = 0;
let revealObserver = null;
let checkoutTypingLoopTimer = null;
let checkoutTypingSequenceToken = 0;
let landingScrollY = 0;
let lastFocusedElement = null;
const mobileLayoutQuery = window.matchMedia("(max-width: 768px)");
const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
const hoverNoneQuery = window.matchMedia("(hover: none)");
let currentDeviceLayout = "desktop";

function detectDeviceLayout() {
  const userAgent = navigator.userAgent || "";
  const userAgentDataMobile =
    typeof navigator.userAgentData?.mobile === "boolean" ? navigator.userAgentData.mobile : false;
  const isAppleTouchDevice = /Mac/i.test(navigator.platform || "") && navigator.maxTouchPoints > 1;
  const mobileUserAgent =
    userAgentDataMobile ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(userAgent) ||
    isAppleTouchDevice;
  const touchLikeDevice =
    navigator.maxTouchPoints > 0 || coarsePointerQuery.matches || hoverNoneQuery.matches;
  const compactViewport = window.innerWidth <= 1024 || Math.min(window.innerWidth, window.innerHeight) <= 820;

  return mobileUserAgent || (touchLikeDevice && compactViewport && mobileLayoutQuery.matches)
    ? "mobile"
    : "desktop";
}

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

function setupRevealObserver() {
  if (revealObserver) {
    revealObserver.disconnect();
    revealObserver = null;
  }

  if (isMobileLayout() || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => {
      element.classList.add("active");
    });
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("active");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -10% 0px",
    }
  );

  revealElements.forEach((element) => {
    if (element.classList.contains("active")) {
      return;
    }

    revealObserver.observe(element);
  });
}

function setMobileExperienceState() {
  currentDeviceLayout = detectDeviceLayout();
  document.body.classList.toggle("mobile-experience", isMobileLayout());
  document.body.classList.toggle("device-mobile", isMobileLayout());
  document.body.classList.toggle("device-desktop", !isMobileLayout());
  document.body.dataset.deviceLayout = currentDeviceLayout;

  if (isMobileLayout()) {
    stopTypingSounds();
  }

  if (!isMobileLayout()) {
    closeMobileNav();
  }
}

currentDeviceLayout = detectDeviceLayout();
document.body.classList.toggle("device-mobile", currentDeviceLayout === "mobile");
document.body.classList.toggle("device-desktop", currentDeviceLayout === "desktop");
document.body.dataset.deviceLayout = currentDeviceLayout;

window.addEventListener("load", setupRevealObserver);
window.addEventListener("load", prepareClickSoundPool, { once: true });
window.addEventListener("load", setMobileExperienceState);

if (typeof mobileLayoutQuery.addEventListener === "function") {
  mobileLayoutQuery.addEventListener("change", setupRevealObserver);
  mobileLayoutQuery.addEventListener("change", syncTypingByActiveView);
  mobileLayoutQuery.addEventListener("change", setMobileExperienceState);
  coarsePointerQuery.addEventListener("change", setMobileExperienceState);
  hoverNoneQuery.addEventListener("change", setMobileExperienceState);
} else if (typeof mobileLayoutQuery.addListener === "function") {
  mobileLayoutQuery.addListener(setupRevealObserver);
  mobileLayoutQuery.addListener(syncTypingByActiveView);
  mobileLayoutQuery.addListener(setMobileExperienceState);
  coarsePointerQuery.addListener(setMobileExperienceState);
  hoverNoneQuery.addListener(setMobileExperienceState);
}

window.addEventListener("resize", setMobileExperienceState, { passive: true });
window.addEventListener("orientationchange", setMobileExperienceState);

document.addEventListener("dragstart", function (e) {
  e.preventDefault();
});

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobileLayout = () => currentDeviceLayout === "mobile";

function setMobileNavState(isOpen) {
  if (!mobileNavToggle || !mobileNavPanel) {
    return;
  }

  document.body.classList.toggle("mobile-nav-open", isOpen);
  mobileNavToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  mobileNavPanel.setAttribute("aria-hidden", isOpen ? "false" : "true");
}

function openMobileNav() {
  if (!isMobileLayout()) {
    return;
  }

  setMobileNavState(true);
}

function closeMobileNav() {
  setMobileNavState(false);
}

function toggleMobileNav() {
  const isOpen = document.body.classList.contains("mobile-nav-open");
  setMobileNavState(!isOpen);
}

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

function shouldPlayTypingSound(character, characterIndex) {
  if (!character || /\s/.test(character)) {
    return false;
  }

  if (!/[0-9A-Za-zÀ-ÿ]/.test(character)) {
    return false;
  }

  return characterIndex === 0 || characterIndex % 2 === 0;
}

function playTypingSound(character, characterIndex) {
  if (isMobileLayout() || prefersReducedMotion || !shouldPlayTypingSound(character, characterIndex)) {
    return null;
  }

  const now = performance.now();

  if (now - lastTypingSoundAt < TYPING_SOUND_MIN_INTERVAL_MS) {
    return null;
  }

  prepareTypingSoundPool();

  const audio = getTypingSoundPlayer();
  lastTypingSoundAt = now;

  audio.pause();
  audio.currentTime = 0;

  const playPromise = audio.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }

  return audio;
}

function stopTypingSounds() {
  lastTypingSoundAt = 0;
  typingSoundPool.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
}

document.addEventListener(
  "click",
  function (event) {
    const clickableTarget = getClickableSoundTarget(event.target);

    if (!canPlayClickSound(clickableTarget)) {
      return;
    }

    playClickSound();
  },
  true
);

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

  const characters = Array.from(fullText);

  for (const [characterIndex, character] of characters.entries()) {
    if (isCancelled()) {
      return;
    }

    textElement.textContent += character;
    playTypingSound(character, characterIndex);
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

const heroCardDesktop = document.querySelector(".hero-card--desktop");
const heroCardMobile = document.querySelector(".hero-card--mobile");
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
    buttonLabel: "Continuar com Pix",
    helper: "Pix com confirma\u00e7\u00e3o r\u00e1pida e valor final j\u00e1 definido.",
  },
  card: {
    total: 50,
    link: "https://mpago.li/1anehxX",
    buttonLabel: "Continuar com Cart\u00e3o",
    helper: "Cart\u00e3o em ambiente seguro, com valor final j\u00e1 definido.",
  },
};

const heroTypingControllers = [
  setupTypingSequence(heroDesktopTypedItems, heroCardDesktop, {
    isActive: () => !isCheckoutActive() && !isMobileLayout(),
  }),
  setupTypingSequence(heroMobileTypedItems, heroCardMobile, {
    isActive: () => !isCheckoutActive() && isMobileLayout(),
  }),
].filter(Boolean);

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
    heroTypingControllers.forEach((controller) => controller.stop(true));
    startCheckoutTypingLoop();
    return;
  }

  stopCheckoutTypingLoop(true);
  heroTypingControllers.forEach((controller) => controller.refresh());
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
    closeMobileNav();
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

if (mobileNavToggle) {
  mobileNavToggle.addEventListener("click", function () {
    toggleMobileNav();
  });
}

mobileNavLinks.forEach((link) => {
  link.addEventListener("click", function () {
    closeMobileNav();
  });
});

document.addEventListener("click", function (event) {
  if (!document.body.classList.contains("mobile-nav-open")) {
    return;
  }

  if (
    mobileNavPanel?.contains(event.target) ||
    mobileNavToggle?.contains(event.target)
  ) {
    return;
  }

  closeMobileNav();
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeMobileNav();
  }
});

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
      ? "Valor final \u00fanico para confirmar sua vaga."
      : "Valor final pronto para confirma\u00e7\u00e3o.";
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
