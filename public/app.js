(function () {
  var authScreen = document.getElementById("auth-screen");
  var appScreen = document.getElementById("app-screen");
  var authSub = document.getElementById("auth-sub");
  var authForm = document.getElementById("auth-form");
  var authUsername = document.getElementById("auth-username");
  var authPassword = document.getElementById("auth-password");
  var authSubmit = document.getElementById("auth-submit");
  var authError = document.getElementById("auth-error");
  var authToggle = document.getElementById("auth-toggle");

  var usernameDisplay = document.getElementById("username-display");
  var logoutBtn = document.getElementById("logout-btn");
  var todayLabel = document.getElementById("today-label");
  var statDay = document.getElementById("stat-day");
  var statWeek = document.getElementById("stat-week");
  var statTotal = document.getElementById("stat-total");
  var entryForm = document.getElementById("entry-form");
  var entrySubmit = document.getElementById("entry-submit");
  var entryError = document.getElementById("entry-error");
  var eventSelect = document.getElementById("input-event-select");
  var eventCustom = document.getElementById("input-event-custom");
  var inputAmount = document.getElementById("input-amount");
  var presetsToggle = document.getElementById("presets-toggle");
  var presetsPanel = document.getElementById("presets-panel");
  var list = document.getElementById("list");

  var authMode = "login";
  var presets = [];
  var entries = [];

  function api(path, options) {
    options = options || {};
    options.headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    return fetch(path, options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error(body.error || "Something went wrong.");
        return body;
      });
    });
  }

  function formatMoney(n) {
    return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function dateKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function startOfWeek(ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    var day = d.getDay();
    var diff = (day === 0 ? -6 : 1) - day; // Monday as start of week
    d.setDate(d.getDate() + diff);
    return d.getTime();
  }

  // ---- Auth screen ----

  function setAuthMode(mode) {
    authMode = mode;
    authError.hidden = true;
    if (mode === "login") {
      authSub.textContent = "Sign in to your ledger.";
      authSubmit.textContent = "Sign in";
      authToggle.textContent = "Need an account? Create one";
      authPassword.autocomplete = "current-password";
    } else {
      authSub.textContent = "Create an account for your own ledger.";
      authSubmit.textContent = "Create account";
      authToggle.textContent = "Already have an account? Sign in";
      authPassword.autocomplete = "new-password";
    }
  }

  authToggle.addEventListener("click", function () {
    setAuthMode(authMode === "login" ? "signup" : "login");
  });

  authForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    authError.hidden = true;
    authSubmit.disabled = true;

    var payload = { username: authUsername.value.trim(), password: authPassword.value };
    var endpoint = authMode === "login" ? "/api/login" : "/api/signup";

    api(endpoint, { method: "POST", body: JSON.stringify(payload) })
      .then(function (data) {
        authPassword.value = "";
        enterApp(data.username);
      })
      .catch(function (err) {
        authError.textContent = err.message;
        authError.hidden = false;
      })
      .finally(function () {
        authSubmit.disabled = false;
      });
  });

  logoutBtn.addEventListener("click", function () {
    api("/api/logout", { method: "POST" }).finally(function () {
      entries = [];
      showAuth();
    });
  });

  function showAuth() {
    appScreen.hidden = true;
    authScreen.hidden = false;
    authForm.reset();
    setAuthMode("login");
  }

  // ---- App screen ----

  function enterApp(username) {
    usernameDisplay.textContent = "Signed in as " + username;
    authScreen.hidden = true;
    appScreen.hidden = false;

    var now = Date.now();
    todayLabel.textContent = new Date(now).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    });

    Promise.all([api("/api/presets"), api("/api/entries")])
      .then(function (results) {
        presets = results[0];
        entries = results[1];
        populateEventSelect();
        renderPresetsPanel();
        render();
      })
      .catch(function (err) {
        entryError.textContent = err.message;
        entryError.hidden = false;
      });
  }

  function populateEventSelect() {
    eventSelect.innerHTML = "";
    presets.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.label;
      eventSelect.appendChild(opt);
    });
    var customOpt = document.createElement("option");
    customOpt.value = "custom";
    customOpt.textContent = "Custom…";
    eventSelect.appendChild(customOpt);
    syncAmountToPreset();
  }

  function presetById(id) {
    return presets.filter(function (p) { return p.id === id; })[0];
  }

  function syncAmountToPreset() {
    if (eventSelect.value === "custom") {
      eventCustom.hidden = false;
      eventCustom.required = true;
      inputAmount.value = "";
    } else {
      eventCustom.hidden = true;
      eventCustom.required = false;
      var preset = presetById(eventSelect.value);
      inputAmount.value = preset ? preset.cost.toFixed(2) : "";
    }
  }

  eventSelect.addEventListener("change", syncAmountToPreset);

  function renderPresetsPanel() {
    presetsPanel.innerHTML = "";
    presets.forEach(function (p) {
      var row = document.createElement("div");
      row.className = "preset-row";

      var label = document.createElement("span");
      label.className = "preset-label";
      label.textContent = p.label;

      var costWrap = document.createElement("span");
      costWrap.className = "preset-cost";

      var dollar = document.createElement("span");
      dollar.textContent = "$";

      var costInput = document.createElement("input");
      costInput.type = "number";
      costInput.step = "0.01";
      costInput.min = "0";
      costInput.value = p.cost.toFixed(2);
      costInput.addEventListener("change", function () {
        var val = parseFloat(costInput.value);
        if (isNaN(val) || val < 0) val = 0;
        costInput.value = val.toFixed(2);

        api("/api/presets/" + p.id, { method: "PUT", body: JSON.stringify({ cost: val }) })
          .then(function () {
            p.cost = val;
            if (eventSelect.value === p.id) syncAmountToPreset();
          })
          .catch(function (err) {
            costInput.value = p.cost.toFixed(2);
            alert(err.message);
          });
      });

      costWrap.appendChild(dollar);
      costWrap.appendChild(costInput);
      row.appendChild(label);
      row.appendChild(costWrap);
      presetsPanel.appendChild(row);
    });
  }

  presetsToggle.addEventListener("click", function () {
    var open = presetsPanel.hidden;
    presetsPanel.hidden = !open;
    presetsToggle.classList.toggle("open", open);
  });

  function render() {
    var now = Date.now();
    var todayKey = dateKey(now);
    var weekStart = startOfWeek(now);

    var todayEntries = entries.filter(function (e) { return dateKey(e.ts) === todayKey; });
    var weekEntries = entries.filter(function (e) { return e.ts >= weekStart; });

    var dayTotal = todayEntries.reduce(function (sum, e) { return sum + e.amount; }, 0);
    var weekTotal = weekEntries.reduce(function (sum, e) { return sum + e.amount; }, 0);
    var allTotal = entries.reduce(function (sum, e) { return sum + e.amount; }, 0);

    statDay.textContent = formatMoney(dayTotal);
    statWeek.textContent = formatMoney(weekTotal);
    statTotal.textContent = formatMoney(allTotal);

    list.innerHTML = "";

    if (todayEntries.length === 0) {
      var empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Nothing logged yet today.";
      list.appendChild(empty);
      return;
    }

    todayEntries
      .slice()
      .sort(function (a, b) { return b.ts - a.ts; })
      .forEach(function (e) {
        var row = document.createElement("div");
        row.className = "row";

        var bullet = document.createElement("span");
        bullet.className = "bullet";

        var event = document.createElement("span");
        event.className = "event";
        event.textContent = e.event;

        var amount = document.createElement("span");
        amount.className = "amount";
        amount.textContent = "+" + formatMoney(e.amount);

        var del = document.createElement("button");
        del.className = "del";
        del.type = "button";
        del.setAttribute("aria-label", "Remove " + e.event);
        del.textContent = "×";
        del.addEventListener("click", function () {
          api("/api/entries/" + e.id, { method: "DELETE" })
            .then(function () {
              entries = entries.filter(function (x) { return x.id !== e.id; });
              render();
            })
            .catch(function (err) { alert(err.message); });
        });

        row.appendChild(bullet);
        row.appendChild(event);
        row.appendChild(amount);
        row.appendChild(del);
        list.appendChild(row);
      });
  }

  entryForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    entryError.hidden = true;

    var isCustom = eventSelect.value === "custom";
    var preset = presetById(eventSelect.value);
    var eventName = isCustom ? eventCustom.value.trim() : (preset ? preset.label : eventSelect.value);
    var amount = parseFloat(inputAmount.value);

    if (!eventName || isNaN(amount) || amount < 0) {
      entryError.textContent = "Enter an event and a non-negative amount.";
      entryError.hidden = false;
      return;
    }

    entrySubmit.disabled = true;
    api("/api/entries", { method: "POST", body: JSON.stringify({ event: eventName, amount: amount }) })
      .then(function (created) {
        entries.push(created);
        eventCustom.value = "";
        eventSelect.selectedIndex = 0;
        syncAmountToPreset();
        render();
      })
      .catch(function (err) {
        entryError.textContent = err.message;
        entryError.hidden = false;
      })
      .finally(function () {
        entrySubmit.disabled = false;
      });
  });

  // ---- Boot ----

  api("/api/me")
    .then(function (data) { enterApp(data.username); })
    .catch(function () { showAuth(); });
})();
