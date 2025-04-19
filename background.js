let focusStart = null;
let focusDuration = 0;
let allowBreak = false;
let remainingTime = 0;
let focusTimer = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "focus-start") {
    focusStart = Date.now();
    focusDuration = msg.duration * 60 * 1000;
    allowBreak = msg.allowBreak;
    remainingTime = focusDuration;

    chrome.storage.local.set({
      focusState: {
        isFocusMode: true,
        focusStart,
        focusDuration,
        allowBreak,
        remainingTime,
      },
    });

    chrome.storage.sync.get(["blocklist"], (data) => {
      const redirectUrl = chrome.runtime.getURL("redirect.html");
      const rules = (data.blocklist || []).map((url, index) => ({
        id: index + 1,
        priority: 1,
        action: { type: "redirect", redirect: { url: redirectUrl } },
        condition: { urlFilter: url, resourceTypes: ["main_frame"] },
      }));

      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: Array.from({ length: 1000 }, (_, i) => i + 1),
        addRules: rules,
      });
    });

    startFocusTimer();
    chrome.runtime.sendMessage({ type: "focus-started" });
  }

  if (msg.type === "focus-end") {
    if (!allowBreak && remainingTime > 0) {
      sendResponse({ error: "Cannot end focus mode early unless breaking is allowed." });
      return;
    }

    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: Array.from({ length: 1000 }, (_, i) => i + 1),
    });

    clearTimeout(focusTimer);
    chrome.storage.local.set({ focusState: null });
    endFocusSession();
    chrome.runtime.sendMessage({ type: "focus-ended" });
  }
});

function startFocusTimer() {
  clearTimeout(focusTimer);
  focusTimer = setTimeout(() => {
    chrome.runtime.sendMessage({ type: "focus-end" });
    endFocusSession();
  }, remainingTime);
}

function endFocusSession() {
  if (!focusStart) return;
  const elapsed = Date.now() - focusStart;
  chrome.storage.local.get(["totalFocusTime"], (data) => {
    const total = (data.totalFocusTime || 0) + elapsed;
    chrome.storage.local.set({ totalFocusTime: total }, () => {
      chrome.runtime.sendMessage({ type: "update-total-time", total });
    });
  });
  focusStart = null;
  remainingTime = 0;
}

// Rehydrate timer on browser restart
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(["focusState"], (data) => {
    const focusState = data.focusState;
    if (focusState && focusState.isFocusMode) {
      const now = Date.now();
      const elapsed = now - focusState.focusStart;
      const newRemaining = Math.max(focusState.focusDuration - elapsed, 0);

      if (newRemaining > 0) {
        remainingTime = newRemaining;
        focusStart = now - (focusState.focusDuration - newRemaining);
        focusDuration = focusState.focusDuration;
        allowBreak = focusState.allowBreak;
        startFocusTimer();
      } else {
        chrome.storage.local.set({ focusState: null });
      }
    }
  });
});
