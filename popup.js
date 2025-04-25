document.addEventListener("DOMContentLoaded", function () {
  const taskInput = document.getElementById("taskInput");
  const addTaskBtn = document.getElementById("addTask");
  const taskList = document.getElementById("taskList");
  const toggleFocusBtn = document.getElementById("toggleFocus");
  const allowBreakCheckbox = document.getElementById("allowBreak");
  const focusStatus = document.getElementById("focusStatus");
  const totalTimeSpan = document.getElementById("totalTime");
  const siteInput = document.getElementById("siteInput");
  const addSiteBtn = document.getElementById("addSite");
  const siteList = document.getElementById("siteList");
  const quoteText = document.getElementById("quoteText");
  
  let isFocusMode = false;
  let intervalId = null;
  
  fetchQuote(); // Fetch a quote when the popup loads
  
  

  chrome.storage.local.get(["focusState"], function (data) {
      const focusState = data.focusState;
      if (focusState && focusState.isFocusMode) {
          isFocusMode = true;
          allowBreakCheckbox.checked = focusState.allowBreak;
          siteInput.disabled = true;
          addSiteBtn.disabled = true;
          toggleFocusBtn.textContent = "End Focus Mode";
          updateRemainingTime();
      } else {
          focusStatus.textContent = "Focus Mode: OFF";
          toggleFocusBtn.textContent = "Enable Focus Mode";
      }
  });

  function updateRemainingTime() {
      clearInterval(intervalId);
      intervalId = setInterval(() => {
          chrome.storage.local.get(["focusState"], function (data) {
              const focusState = data.focusState;
              if (!focusState || !focusState.isFocusMode) {
                  clearInterval(intervalId);
                  focusStatus.textContent = "Focus Mode: OFF";
                  toggleFocusBtn.textContent = "Enable Focus Mode";
                  isFocusMode = false;
                  siteInput.disabled = false;
                  addSiteBtn.disabled = false;
                  return;
              }
              const now = Date.now();
              const elapsed = focusState.focusStart ? now - focusState.focusStart : 0;
              const remainingTime = Math.max(focusState.focusDuration - elapsed, 0);
              const minutes = Math.floor(remainingTime / 60000);
              const seconds = Math.floor((remainingTime % 60000) / 1000);
              focusStatus.textContent = `Focus Mode: ON (${minutes}m ${seconds}s remaining)`;
          });
      }, 1000);
  }
  addTaskBtn.addEventListener("click", addTask);
  taskInput.addEventListener("keypress", function (event) {
      if (event.key === "Enter") addTask();
  });

  function addTask() {
      let taskText = taskInput.value.trim();
      if (taskText === "") return;
      addTaskToUI(taskText);
      chrome.storage.sync.get(["tasks"], function (data) {
          let tasks = data.tasks || [];
          tasks.push(taskText);
          chrome.storage.sync.set({ tasks });
      });
      taskInput.value = "";
  }

  function addTaskToUI(taskText) {
      const li = document.createElement("li");
      li.textContent = taskText;
      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = "&times;";
      deleteBtn.classList.add("remove-btn");
      deleteBtn.addEventListener("click", function () {
          li.remove();
          chrome.storage.sync.get(["tasks"], function (data) {
              let tasks = data.tasks || [];
              tasks = tasks.filter((task) => task !== taskText);
              chrome.storage.sync.set({ tasks });
          });
      });
      li.appendChild(deleteBtn);
      taskList.appendChild(li);
  }

  chrome.storage.sync.get(["tasks"], function (data) {
      if (data.tasks) {
          data.tasks.forEach((task) => addTaskToUI(task));
      }
  });

  chrome.storage.sync.get(["blocklist"], function (data) {
      if (data.blocklist) {
          data.blocklist.forEach((site) => addSiteToUI(site));
      }
  });

  chrome.storage.local.get(["totalFocusTime"], function (data) {
      const total = data.totalFocusTime || 0;
      updateTotalTimeDisplay(total);
  });

  addSiteBtn.addEventListener("click", function () {
      if (isFocusMode) {
          alert("Can't edit blocklist during focus mode.");
          return;
      }
      const site = siteInput.value.trim();
      if (!site) return;
      chrome.storage.sync.get(["blocklist"], function (data) {
          let list = data.blocklist || [];
          if (!list.includes(site)) {
              list.push(site);
              chrome.storage.sync.set({ blocklist: list });
              addSiteToUI(site);
              siteInput.value = "";
          }
      });
  });

  function addSiteToUI(site) {
      const li = document.createElement("li");
      li.textContent = site;

      if (!isFocusMode) {
          const del = document.createElement("button");
          del.innerHTML = "&times;";
          del.classList.add("remove-btn");
          del.onclick = function () {
              li.remove();
              chrome.storage.sync.get(["blocklist"], function (data) {
                  let list = data.blocklist || [];
                  list = list.filter((s) => s !== site);
                  chrome.storage.sync.set({ blocklist: list });
              });
          };
          li.appendChild(del);
      }

      siteList.appendChild(li);
  }

  function updateTotalTimeDisplay(ms) {
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      totalTimeSpan.textContent = `${h}h ${m}m`;
  }

  chrome.runtime.onMessage.addListener(function (msg) {
      if (msg.type === "update-total-time") {
          updateTotalTimeDisplay(msg.total);
      }
  });

  toggleFocusBtn.addEventListener("click", function () {
      if (isFocusMode) {
          chrome.runtime.sendMessage({ type: "focus-end" }, function (response) {
              if (response && response.error) {
                  alert(response.error);
              } else {
                  focusStatus.textContent = "Focus Mode: OFF";
                  toggleFocusBtn.textContent = "Enable Focus Mode";
                  isFocusMode = false;
                  clearInterval(intervalId);
                  siteInput.disabled = false;
                  addSiteBtn.disabled = false;
              }
          });
      } else {
          const duration = parseInt(document.getElementById("focusDuration").value, 10);
          if (isNaN(duration) || duration <= 0) {
              alert("Please enter a valid focus duration (in minutes).");
              return;
          }

          chrome.runtime.sendMessage({
              type: "focus-start",
              duration: duration,
              allowBreak: allowBreakCheckbox.checked,
          });

          isFocusMode = true;
          toggleFocusBtn.textContent = "End Focus Mode";
          siteInput.disabled = true;
          addSiteBtn.disabled = true;
          updateRemainingTime();
      }
  });

  function fetchQuote() {
    fetch("https://api.api-ninjas.com/v1/quotes", {
        headers: {
            'X-Api-Key': 'zpHvyhkL/p52tomrzZxgKQ==AUZBsX7CnJKoG4k7'
        }    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (data.length > 0) {
            const quote = data[0];
            quoteText.textContent = `"${quote.quote}"`;
        } else {
            quoteText.textContent = "No quote available.";
        }
    })
    .catch(err => {
        console.error("Failed to fetch quote:", err);
        quoteText.textContent = "Stay strong. Stay focused.";
    });
}
  

});
