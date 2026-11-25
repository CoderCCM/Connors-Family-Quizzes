// Quiz Creator
//
// A quiz is sent to the server as:
//   quizName, backgroundColor, backgroundImage, and questions[], where each
//   question is one string:  text !@#$%^&*() opt1 {}| opt2 {}| ... !@#$%^&*() correctIndex
// (that format is unchanged, so the server and the quiz pages need no changes)

var DELIM_Q = "!@#$%^&*()";
var DELIM_O = "{}|";
var DRAFT_KEY = "quizCreatorDraft";
var DEFAULT_COLOR = "#24c94d";
var COLOR_PRESETS = [
  { name: "Green (default)", value: "#24c94d" },
  { name: "Blue", value: "#2563eb" },
  { name: "Purple", value: "#7c3aed" },
  { name: "Pink", value: "#db2777" },
  { name: "Red", value: "#dc2626" },
  { name: "Orange", value: "#ea580c" },
  { name: "Teal", value: "#0d9488" },
  { name: "Slate", value: "#334155" },
];

var uid = 0; // gives every question card a permanent id (numbers change when reordering)
var activeCard = null; // the question shown in the preview
var draftTimer, imageTimer;

function byId(id) {
  return document.getElementById(id);
}

function cards() {
  return Array.prototype.slice.call(
    document.querySelectorAll("#questionsDiv .qcard")
  );
}

function optionRows(card) {
  return Array.prototype.slice.call(card.querySelectorAll(".opt"));
}

function hasDelimiter(text) {
  return text.indexOf(DELIM_Q) !== -1 || text.indexOf(DELIM_O) !== -1;
}

/* ------------------------------------------------------------------ */
/* Questions and options                                               */
/* ------------------------------------------------------------------ */

// data (optional): { text, options: [...], correct: index or -1 }
// silent: true when restoring/starting, so the page doesn't scroll or focus
function newQuestion(data, silent) {
  if (data && data.type) data = null; // called from a click event
  uid++;
  var card = document.createElement("section");
  card.className = "qcard";
  card.dataset.uid = uid;
  card.innerHTML =
    '<div class="qhead">' +
    '<span class="qtitle">Question <b class="qnum"></b></span>' +
    '<div class="qtools">' +
    '<button type="button" class="icon" data-act="up" aria-label="Move question up" title="Move up">\u2191</button>' +
    '<button type="button" class="icon" data-act="down" aria-label="Move question down" title="Move down">\u2193</button>' +
    '<button type="button" class="icon danger" data-act="remove" aria-label="Delete question" title="Delete question">\u2715</button>' +
    "</div></div>" +
    '<textarea class="qtext" rows="2"></textarea>' +
    '<p class="hint">Tap the circle beside the right answer. Blank options are ignored.</p>' +
    '<div class="opts"></div>' +
    '<button type="button" class="addopt" data-act="addopt">+ Add option</button>';
  byId("questionsDiv").append(card);

  card.querySelector(".qtext").value = data && data.text ? data.text : "";
  var options =
    data && data.options && data.options.length
      ? data.options
      : ["", "", "", ""];
  options.forEach(function (text, i) {
    newOption(card, text, !!data && data.correct === i);
  });
  while (optionRows(card).length < 2) newOption(card, "", false);

  renumber();
  setActive(card);
  if (!silent) {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    card.querySelector(".qtext").focus({ preventScroll: true });
  }
  return card;
}

function newOption(card, text, checked) {
  var row = document.createElement("div");
  row.className = "opt";
  row.innerHTML =
    '<label class="mark" title="Mark as the correct answer">' +
    '<input type="radio" class="ocorrect" />' +
    '<span class="tick" aria-hidden="true">\u2713</span>' +
    '<span class="sr">Correct answer</span></label>' +
    '<input type="text" class="otext" autocomplete="off" />' +
    '<button type="button" class="icon" data-act="rmopt" aria-label="Remove option" title="Remove option">\u2715</button>';
  var radio = row.querySelector(".ocorrect");
  radio.name = "correct-" + card.dataset.uid;
  radio.checked = !!checked;
  row.querySelector(".otext").value = text || "";
  card.querySelector(".opts").append(row);
  return row;
}

// Refresh numbering, placeholders and which buttons are enabled
function renumber() {
  var list = cards();
  list.forEach(function (card, i) {
    card.querySelector(".qnum").textContent = i + 1;
    card.querySelector(".qtext").placeholder = "Type question " + (i + 1) + "\u2026";
    card.querySelector('[data-act="up"]').disabled = i === 0;
    card.querySelector('[data-act="down"]').disabled = i === list.length - 1;
    card.querySelector('[data-act="remove"]').disabled = list.length === 1;
    var rows = optionRows(card);
    rows.forEach(function (row, j) {
      row.querySelector(".otext").placeholder = "Option " + (j + 1);
      row.querySelector('[data-act="rmopt"]').disabled = rows.length <= 2;
    });
  });
  var label = list.length + (list.length === 1 ? " question" : " questions");
  byId("qcount").textContent = label;
  byId("publishSummary").textContent = label;
}

function setActive(card) {
  activeCard = card;
  cards().forEach(function (c) {
    c.classList.toggle("active", c === card);
  });
  updatePreview();
}

function cardHasContent(card) {
  if (card.querySelector(".qtext").value.trim()) return true;
  return optionRows(card).some(function (row) {
    return row.querySelector(".otext").value.trim();
  });
}

/* ------------------------------------------------------------------ */
/* Background color and image                                          */
/* ------------------------------------------------------------------ */

// Accept "24c94d" as well as "#24c94d"
function normalizeColor(value) {
  value = value.trim();
  if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return "#" + value;
  return value;
}

// Returns [r, g, b] for any CSS color the browser understands, else null
function parseColor(value) {
  var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  if (window.CSS && CSS.supports && !CSS.supports("color", value)) return null;
  var canvas = parseColor.canvas || (parseColor.canvas = document.createElement("canvas"));
  var ctx = canvas.getContext && canvas.getContext("2d");
  if (!ctx) return null;
  // an invalid color leaves fillStyle unchanged, so try two different starting points
  ctx.fillStyle = "#000000";
  ctx.fillStyle = value;
  var a = ctx.fillStyle;
  ctx.fillStyle = "#ffffff";
  ctx.fillStyle = value;
  if (a !== ctx.fillStyle) return null;
  m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(a);
  if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(a);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function toHex(rgb) {
  return (
    "#" +
    rgb
      .map(function (n) {
        return ("0" + n.toString(16)).slice(-2);
      })
      .join("")
  );
}

function contrastWithWhite(rgb) {
  var lin = rgb.map(function (c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  var luminance = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return 1.05 / (luminance + 0.05);
}

function updateBcColor() {
  var raw = normalizeColor(byId("backgroundColor").value);
  var rgb = raw ? parseColor(raw) : parseColor(DEFAULT_COLOR);
  var hint = byId("colorHint");
  var shown = raw && rgb ? raw : DEFAULT_COLOR;

  byId("pvCard").style.backgroundColor = shown;
  if (rgb) byId("colorPicker").value = toHex(rgb);

  if (raw && !rgb) {
    hint.textContent =
      "That isn\u2019t a color the browser understands. Try a hex code like #24c94d.";
    hint.className = "hint bad";
  } else if (raw && contrastWithWhite(rgb) < 1.8) {
    hint.textContent =
      "Pretty light: the white quiz text may be hard to read on it.";
    hint.className = "hint warn";
  } else {
    hint.textContent = raw ? "" : "Blank uses the default green.";
    hint.className = "hint";
  }

  Array.prototype.forEach.call(document.querySelectorAll(".swatch"), function (s) {
    s.classList.toggle("on", !!raw && s.dataset.value === raw.toLowerCase());
  });
}

function updateImage() {
  var url = byId("backgroundImage").value.trim();
  var status = byId("imageStatus");
  var screen = byId("pvScreen");
  clearTimeout(imageTimer);

  screen.style.backgroundImage = "";
  screen.style.backgroundSize = "";
  if (!url) {
    status.textContent = "Tiles across the page, so use a seamless pattern.";
    status.className = "hint";
    return;
  }
  if (/[\s()"'\\]/.test(url)) {
    status.textContent =
      "Spaces, quotes and brackets break the quiz page. Replace them with %20, %22, %28 and %29.";
    status.className = "hint bad";
    return;
  }
  status.textContent = "Checking the image\u2026";
  status.className = "hint";
  imageTimer = setTimeout(function () {
    var img = new Image();
    img.onload = function () {
      if (byId("backgroundImage").value.trim() !== url) return;
      // the preview screen is narrower than a phone, so shrink the tile to match
      var scale = (screen.clientWidth || 260) / 390;
      screen.style.backgroundImage = 'url("' + url + '")';
      screen.style.backgroundSize =
        Math.max(1, Math.round(img.naturalWidth * scale)) + "px auto";
      status.textContent =
        "Loaded (" + img.naturalWidth + " \u00d7 " + img.naturalHeight + " px), tiled across the page.";
      status.className = "hint good";
    };
    img.onerror = function () {
      if (byId("backgroundImage").value.trim() !== url) return;
      status.textContent = "Couldn\u2019t load that image. Check the link.";
      status.className = "hint bad";
    };
    img.src = url;
  }, 350);
}

/* ------------------------------------------------------------------ */
/* Preview                                                             */
/* ------------------------------------------------------------------ */

function updatePreview() {
  byId("pvTitle").textContent = byId("quizName").value.trim() || "Quiz name";

  var list = cards();
  var card = activeCard && activeCard.isConnected ? activeCard : list[0];
  if (!card) return;
  byId("pvCount").textContent =
    "Question " + (list.indexOf(card) + 1) + "/" + list.length;
  var text = card.querySelector(".qtext").value.trim();
  byId("pvQuestion").textContent = text || "Your question appears here";
  byId("pvQuestion").classList.toggle("ghost", !text);

  var ul = byId("pvOptions");
  ul.innerHTML = "";
  var any = false;
  optionRows(card).forEach(function (row) {
    var t = row.querySelector(".otext").value.trim();
    if (!t) return;
    any = true;
    var li = document.createElement("li");
    li.textContent = t;
    if (row.querySelector(".ocorrect").checked) li.className = "correct";
    ul.append(li);
  });
  if (!any) {
    ["Option 1", "Option 2"].forEach(function (t) {
      var li = document.createElement("li");
      li.textContent = t;
      li.className = "ghost";
      ul.append(li);
    });
  }
}

/* ------------------------------------------------------------------ */
/* Draft (so a refresh doesn't lose work)                              */
/* ------------------------------------------------------------------ */

function serialize() {
  return {
    name: byId("quizName").value,
    color: byId("backgroundColor").value,
    image: byId("backgroundImage").value,
    questions: cards().map(function (card) {
      var rows = optionRows(card);
      var correct = -1;
      rows.forEach(function (row, i) {
        if (row.querySelector(".ocorrect").checked) correct = i;
      });
      return {
        text: card.querySelector(".qtext").value,
        options: rows.map(function (row) {
          return row.querySelector(".otext").value;
        }),
        correct: correct,
      };
    }),
  };
}

function isBlank(d) {
  return (
    !d.name.trim() &&
    !d.color.trim() &&
    !d.image.trim() &&
    d.questions.every(function (q) {
      return !q.text.trim() && q.options.every(function (o) { return !o.trim(); });
    })
  );
}

function saveDraft() {
  try {
    var d = serialize();
    if (isBlank(d)) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch (e) {}
}

function scheduleDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 400);
}

function clearDraft() {
  clearTimeout(draftTimer);
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {}
}

function loadDraft() {
  try {
    var d = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (!d || !d.questions || !d.questions.length || isBlank(d)) return false;
    byId("quizName").value = d.name || "";
    byId("backgroundColor").value = d.color || "";
    byId("backgroundImage").value = d.image || "";
    d.questions.forEach(function (q) {
      newQuestion(q, true);
    });
    return true;
  } catch (e) {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Validate + publish                                                  */
/* ------------------------------------------------------------------ */

// Returns { problems: [{ el, mark, msg }], body }
function collect() {
  var problems = [];
  function problem(el, msg, mark) {
    problems.push({ el: el, mark: mark || el, msg: msg });
  }

  var nameEl = byId("quizName");
  var name = nameEl.value.trim();
  if (!name) problem(nameEl, "Give the quiz a name.");

  var colorEl = byId("backgroundColor");
  var color = normalizeColor(colorEl.value);
  if (color && !parseColor(color)) {
    problem(
      colorEl,
      "The background color isn\u2019t one the browser understands. Use a hex code like #24c94d, or leave it blank for green."
    );
  }

  var imageEl = byId("backgroundImage");
  var image = imageEl.value.trim();
  if (/[\s()"'\\]/.test(image)) {
    problem(
      imageEl,
      "The background image link has spaces, quotes or brackets, which break the quiz page. Replace them with %20, %22, %28 and %29."
    );
  }

  var questions = [];
  cards().forEach(function (card, i) {
    var label = "Question " + (i + 1);
    var textEl = card.querySelector(".qtext");
    var text = textEl.value.trim();
    if (!text) problem(textEl, label + " needs some text.");
    else if (hasDelimiter(text))
      problem(textEl, label + " can\u2019t contain " + DELIM_Q + " or " + DELIM_O);

    var rows = optionRows(card);
    var options = [];
    var correct = -1;
    var blankCorrect = null;
    rows.forEach(function (row) {
      var input = row.querySelector(".otext");
      var value = input.value.trim();
      var isCorrect = row.querySelector(".ocorrect").checked;
      if (!value) {
        if (isCorrect) blankCorrect = input;
        return;
      }
      if (hasDelimiter(value))
        problem(input, label + ": options can\u2019t contain " + DELIM_Q + " or " + DELIM_O);
      if (isCorrect) correct = options.length;
      options.push(value);
    });

    var optsBox = card.querySelector(".opts");
    if (blankCorrect) {
      problem(blankCorrect, label + ": the option marked correct is empty.");
    } else if (options.length < 2) {
      var firstEmpty = rows
        .map(function (r) { return r.querySelector(".otext"); })
        .filter(function (inp) { return !inp.value.trim(); })[0];
      problem(firstEmpty || rows[0].querySelector(".otext"), label + " needs at least two options.");
    } else if (correct < 0) {
      problem(
        rows[0].querySelector(".ocorrect"),
        label + " needs a correct answer. Tap the circle beside it.",
        optsBox
      );
    }

    questions.push(text + DELIM_Q + options.join(DELIM_O) + DELIM_Q + correct);
  });

  return {
    problems: problems,
    body: {
      quizName: name,
      questions: questions,
      backgroundColor: color,
      backgroundImage: image,
    },
  };
}

function clearMarks() {
  Array.prototype.forEach.call(document.querySelectorAll(".invalid"), function (el) {
    el.classList.remove("invalid");
  });
}

function hideNotices() {
  clearMarks();
  byId("problems").hidden = true;
  byId("result").hidden = true;
}

function showProblems(list) {
  clearMarks();
  var box = byId("problems");
  box.innerHTML = "";
  var h = document.createElement("h3");
  h.textContent =
    list.length === 1 ? "One thing to fix before publishing" : list.length + " things to fix before publishing";
  box.append(h);
  var ul = document.createElement("ul");
  list.forEach(function (p) {
    if (p.mark) p.mark.classList.add("invalid");
    var li = document.createElement("li");
    if (p.el) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = p.msg;
      b.onclick = function () {
        p.el.scrollIntoView({ behavior: "smooth", block: "center" });
        p.el.focus({ preventScroll: true });
      };
      li.append(b);
    } else {
      li.textContent = p.msg;
    }
    ul.append(li);
  });
  box.append(ul);
  box.hidden = false;
  byId("result").hidden = true;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

function showSuccess(name) {
  var box = byId("result");
  box.innerHTML = "";
  var enc = encodeURIComponent(name);
  var h = document.createElement("h3");
  h.textContent = "Published \u2713";
  var p = document.createElement("p");
  p.textContent = "\u201c" + name + "\u201d is live.";
  var links = document.createElement("p");
  links.className = "links";
  [
    ["Take the quiz", "/?qNameAutoOpen=" + enc],
    ["Live scoreboard", "/scoreboard?qName=" + enc],
  ].forEach(function (l) {
    var a = document.createElement("a");
    a.href = l[1];
    a.textContent = l[0];
    links.append(a);
  });
  var again = document.createElement("button");
  again.type = "button";
  again.className = "btn secondary";
  again.textContent = "Create another quiz";
  again.onclick = resetForm;
  box.append(h, p, links, again);
  box.hidden = false;
  byId("problems").hidden = true;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function createQuiz() {
  var result = collect();
  if (result.problems.length) {
    showProblems(result.problems);
    return;
  }
  hideNotices();

  var body = result.body;
  var n = body.questions.length;
  var ok = confirm(
    "Publish \u201c" + body.quizName + "\u201d with " + n + (n === 1 ? " question?" : " questions?")
  );
  if (!ok) return;

  var button = byId("publishBtn");
  button.disabled = true;
  button.textContent = "Publishing\u2026";
  try {
    var response = await fetch("/createQuiz", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    var text = await response.text();
    var data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {}
    var failed = !response.ok || (data && (data.success === false || data.error));
    if (failed) {
      var detail =
        (data && (data.error || data.message)) ||
        (text && text.length < 200 && text.charAt(0) !== "<" ? text : "");
      showProblems([
        {
          msg:
            "The server didn\u2019t accept the quiz (status " +
            response.status +
            ")" +
            (typeof detail === "string" && detail ? ": " + detail : "."),
        },
      ]);
    } else {
      clearDraft();
      showSuccess(body.quizName);
    }
  } catch (err) {
    console.error(err);
    showProblems([
      { msg: "Couldn\u2019t reach the server. Check your connection and try again." },
    ]);
  } finally {
    button.disabled = false;
    button.textContent = "Publish quiz";
  }
}

/* ------------------------------------------------------------------ */
/* Reset                                                               */
/* ------------------------------------------------------------------ */

function resetForm() {
  byId("quizName").value = "";
  byId("backgroundColor").value = "";
  byId("backgroundImage").value = "";
  byId("questionsDiv").innerHTML = "";
  activeCard = null;
  clearDraft();
  hideNotices();
  byId("draftNote").hidden = true;
  newQuestion(null, true);
  updateBcColor();
  updateImage();
  updatePreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startOver() {
  if (!isBlank(serialize()) && !confirm("Clear everything and start a new quiz?")) {
    return;
  }
  resetForm();
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

function init() {
  var questionsDiv = byId("questionsDiv");

  // color swatches
  COLOR_PRESETS.forEach(function (c) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.style.backgroundColor = c.value;
    b.dataset.value = c.value;
    b.title = c.name;
    b.setAttribute("aria-label", "Use " + c.name);
    b.addEventListener("click", function () {
      byId("backgroundColor").value = c.value;
      updateBcColor();
      scheduleDraft();
    });
    byId("swatches").append(b);
  });
  byId("colorPicker").addEventListener("input", function (e) {
    byId("backgroundColor").value = e.target.value;
    updateBcColor();
    scheduleDraft();
  });
  byId("backgroundColor").addEventListener("input", updateBcColor);
  byId("backgroundImage").addEventListener("input", updateImage);
  byId("quizName").addEventListener("input", updatePreview);

  // any edit: clear its red outline, refresh the preview, save the draft
  document.querySelector("main").addEventListener("input", function (e) {
    e.target.classList.remove("invalid");
    var box = e.target.closest(".opts");
    if (box) box.classList.remove("invalid");
    updatePreview();
    scheduleDraft();
  });
  document.querySelector("main").addEventListener("change", function (e) {
    var box = e.target.closest(".opts");
    if (box) box.classList.remove("invalid");
    updatePreview();
    scheduleDraft();
  });
  document.querySelector("main").addEventListener("click", scheduleDraft);

  // which question the preview follows
  questionsDiv.addEventListener("focusin", function (e) {
    var card = e.target.closest(".qcard");
    if (card && card !== activeCard) setActive(card);
  });

  // buttons inside question cards
  questionsDiv.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn || btn.disabled) return;
    var card = btn.closest(".qcard");
    var act = btn.dataset.act;

    if (act === "up" && card.previousElementSibling) {
      card.parentNode.insertBefore(card, card.previousElementSibling);
    } else if (act === "down" && card.nextElementSibling) {
      card.parentNode.insertBefore(card.nextElementSibling, card);
    } else if (act === "remove") {
      if (cardHasContent(card) && !confirm("Delete this question?")) return;
      var neighbour = card.nextElementSibling || card.previousElementSibling;
      card.remove();
      if (activeCard === card) activeCard = neighbour;
    } else if (act === "rmopt") {
      btn.closest(".opt").remove();
    } else if (act === "addopt") {
      var row = newOption(card, "", false);
      row.querySelector(".otext").focus();
    }
    renumber();
    setActive(activeCard && activeCard.isConnected ? activeCard : cards()[0]);
  });

  // Enter in an option jumps to the next one (or adds one after the last)
  questionsDiv.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || e.isComposing || !e.target.classList.contains("otext")) return;
    e.preventDefault();
    var card = e.target.closest(".qcard");
    var rows = optionRows(card);
    var next = rows[rows.indexOf(e.target.closest(".opt")) + 1];
    if (!next) {
      if (!e.target.value.trim()) return;
      next = newOption(card, "", false);
      renumber();
    }
    next.querySelector(".otext").focus();
  });

  byId("addQuestion").addEventListener("click", function () {
    newQuestion();
  });
  byId("publishBtn").addEventListener("click", createQuiz);
  byId("startOver").addEventListener("click", startOver);

  if (loadDraft()) {
    byId("draftNote").hidden = false;
  } else {
    newQuestion(null, true);
  }
  renumber();
  setActive(cards()[0]);
  updateBcColor();
  updateImage();
  updatePreview();
}

init();