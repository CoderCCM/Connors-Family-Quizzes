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

// Editing an existing quiz
var editingName = null; // name of the quiz being edited, or null when making a new one
var editOriginal = []; // option count of each original question
var editTakers = 0; // people who have taken it (null = couldn't find out)
var editSnapshot = ""; // form contents when editing began, to spot unsaved changes
var BAD_NAME_CHARS = /[.$#\[\]\/]/; // the database can't store quiz names with these

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
  var rows = optionRows(card);
  var hasCorrect = rows.some(function (row) {
    return row.querySelector(".ocorrect").checked;
  });
  var shownWrong = false;
  rows.forEach(function (row) {
    var t = row.querySelector(".otext").value.trim();
    if (!t) return;
    any = true;
    var li = document.createElement("li");
    li.textContent = t;
    if (row.querySelector(".ocorrect").checked) {
      li.className = "correct";
    } else if (hasCorrect && !shownWrong) {
      // the quiz page shows a wrong pick in red, so show one the same way
      li.className = "wrong";
      shownWrong = true;
    }
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
  if (editingName !== null) return; // drafts are for new quizzes only
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
  else if (BAD_NAME_CHARS.test(name))
    problem(nameEl, "Quiz names can\u2019t contain . $ # [ ] or /");

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

function showSuccess(name, edited) {
  var box = byId("result");
  box.innerHTML = "";
  var enc = encodeURIComponent(name);
  var h = document.createElement("h3");
  h.textContent = edited ? "Saved \u2713" : "Published \u2713";
  var p = document.createElement("p");
  p.textContent = edited
    ? "\u201c" + name + "\u201d has been updated."
    : "\u201c" + name + "\u201d is live.";
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
  var actions = document.createElement("div");
  actions.className = "actions";
  function action(label, handler) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn secondary";
    b.textContent = label;
    b.onclick = handler;
    actions.append(b);
  }
  if (edited) {
    action("Keep editing", function () {
      box.hidden = true;
    });
    action("Back to a new quiz", function () {
      exitEdit(true);
    });
  } else {
    action("Create another quiz", resetForm);
  }
  box.append(h, p, links, actions);
  box.hidden = false;
  byId("problems").hidden = true;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

function publishLabel() {
  return editingName !== null ? "Save changes" : "Publish quiz";
}

// The quiz names the server knows about, or null if the request failed
async function fetchQuizList() {
  try {
    var response = await fetch("/requestQuizList", {
      method: "POST",
      body: JSON.stringify({ a: "A" }),
      headers: { "Content-Type": "application/json" },
    });
    var data = await response.json();
    return Array.isArray(data.quizList) ? data.quizList.map(String) : null;
  } catch (e) {
    return null;
  }
}

async function createQuiz() {
  var result = collect();
  if (result.problems.length) {
    showProblems(result.problems);
    return;
  }
  hideNotices();

  var body = result.body;
  var editing = editingName !== null;
  var n = body.questions.length;
  var button = byId("publishBtn");
  button.disabled = true;
  button.textContent = "Checking\u2026";

  try {
    // a new quiz must not reuse a name (that would wipe the old quiz's results)
    if (!editing) {
      var existing = await fetchQuizList();
      if (existing && existing.indexOf(body.quizName) !== -1) {
        showProblems([
          {
            el: byId("quizName"),
            msg:
              "A quiz called \u201c" + body.quizName + "\u201d already exists. Pick another name, or use Edit a quiz to change it.",
          },
        ]);
        return;
      }
    }

    var message = editing
      ? "Save changes to \u201c" + body.quizName + "\u201d?"
      : "Publish \u201c" + body.quizName + "\u201d with " + n + (n === 1 ? " question?" : " questions?");
    if (editing && editTakers !== 0) {
      var notes = structureNotes();
      if (notes.length) {
        message +=
          "\n\nHeads up: " + notes.join("; ") +
          ". Answers people already submitted are saved by position, so their results may change.";
      }
    }
    if (!confirm(message)) return;

    button.textContent = editing ? "Saving\u2026" : "Publishing\u2026";
    var response = await fetch(editing ? "/updateQuiz" : "/createQuiz", {
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
      if (editing) editSnapshot = JSON.stringify(serialize());
      else clearDraft();
      showSuccess(body.quizName, editing);
    }
  } catch (err) {
    console.error(err);
    showProblems([
      { msg: "Couldn\u2019t reach the server. Check your connection and try again." },
    ]);
  } finally {
    button.disabled = false;
    button.textContent = publishLabel();
  }
}

/* ------------------------------------------------------------------ */
/* Reset                                                               */
/* ------------------------------------------------------------------ */

function clearForm() {
  byId("quizName").value = "";
  byId("backgroundColor").value = "";
  byId("backgroundImage").value = "";
  byId("questionsDiv").innerHTML = "";
  activeCard = null;
  hideNotices();
  byId("draftNote").hidden = true;
}

function refreshAll() {
  updateBcColor();
  updateImage();
  updatePreview();
}

function resetForm() {
  clearDraft();
  clearForm();
  newQuestion(null, true);
  refreshAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startOver() {
  if (editingName !== null) {
    exitEdit();
    return;
  }
  if (!isBlank(serialize()) && !confirm("Clear everything and start a new quiz?")) {
    return;
  }
  resetForm();
}

/* ------------------------------------------------------------------ */
/* Editing an existing quiz                                            */
/* ------------------------------------------------------------------ */

function isDirty() {
  return editingName !== null && JSON.stringify(serialize()) !== editSnapshot;
}

function parseQuestion(str) {
  var parts = String(str).split(DELIM_Q);
  var correct = parseInt(parts[2], 10);
  return {
    text: parts[0] || "",
    options: (parts[1] || "").split(DELIM_O),
    correct: isNaN(correct) ? -1 : correct,
  };
}

// Plain-English list of edits that would scramble answers people already gave.
// (Answers are stored by position: "question 3, option 2".)
function structureNotes() {
  var notes = [];
  var list = cards();
  var n0 = editOriginal.length;
  var intact =
    list.length >= n0 &&
    list.slice(0, n0).every(function (c, i) {
      return c.dataset.orig === String(i);
    });
  if (!intact) notes.push("questions were removed or reordered");
  else if (list.length > n0)
    notes.push("new questions were added (people who already took it have no answer for them)");

  list.forEach(function (card, i) {
    if (card.dataset.orig === undefined) return;
    var expected = editOriginal[Number(card.dataset.orig)];
    var rows = optionRows(card).filter(function (row) {
      return row.querySelector(".otext").value.trim();
    });
    var ok =
      rows.length >= expected &&
      rows.slice(0, expected).every(function (row, j) {
        return row.dataset.orig === String(j);
      });
    if (!ok) notes.push("options in question " + (i + 1) + " were removed or reordered");
  });
  return notes;
}

function setEditUI() {
  var editing = editingName !== null;
  byId("quizName").readOnly = editing;
  byId("nameHint").hidden = !editing;
  byId("editBanner").hidden = !editing;
  byId("startOver").textContent = editing ? "Stop editing" : "Start over";
  byId("publishBtn").textContent = publishLabel();
  if (!editing) return;

  byId("editTitle").textContent = "Editing \u201c" + editingName + "\u201d";
  var warn = byId("editWarn");
  if (editTakers === 0) {
    warn.textContent = "Nobody has taken this quiz yet, so you can change anything.";
  } else {
    var who =
      editTakers === null
        ? "Some people may have already taken this quiz"
        : editTakers + (editTakers === 1 ? " person has" : " people have") + " already taken this quiz";
    warn.textContent =
      who +
      ". Fixing typos or the background is safe. Changing a correct answer re-scores everyone, and removing or reordering questions or options would scramble their answers.";
  }
}

function enterEdit(name, data, takers) {
  clearForm();
  editingName = name;
  editTakers = takers;
  editOriginal = [];
  byId("quizName").value = name;
  byId("backgroundColor").value = data.backgroundColor || "";
  byId("backgroundImage").value = data.backgroundImage || "";

  data.questions.forEach(function (str, i) {
    var q = parseQuestion(str);
    var card = newQuestion(q, true);
    card.dataset.orig = i;
    optionRows(card).forEach(function (row, j) {
      if (j < q.options.length) row.dataset.orig = j;
    });
    editOriginal.push(q.options.length);
  });

  renumber();
  setActive(cards()[0]);
  editSnapshot = JSON.stringify(serialize());
  setEditUI();
  refreshAll();
  byId("picker").hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function exitEdit(skipConfirm) {
  if (!skipConfirm && isDirty() && !confirm("Discard your unsaved changes?")) return;
  clearForm();
  editingName = null;
  editOriginal = [];
  editTakers = 0;
  editSnapshot = "";
  setEditUI();
  // go back to whatever new quiz was in progress
  if (loadDraft()) byId("draftNote").hidden = false;
  else newQuestion(null, true);
  renumber();
  setActive(cards()[0]);
  refreshAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function openPicker() {
  var box = byId("picker");
  var list = byId("pickerList");
  box.hidden = false;
  list.textContent = "Loading quizzes\u2026";
  box.scrollIntoView({ behavior: "smooth", block: "start" });

  var names = await fetchQuizList();
  list.textContent = "";
  if (!names) {
    list.textContent = "Couldn\u2019t load the quiz list. Check your connection and try again.";
    return;
  }
  if (!names.length) {
    list.textContent = "There are no quizzes to edit yet.";
    return;
  }
  names.slice().reverse().forEach(function (name) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "pick";
    b.textContent = name;
    b.onclick = function () {
      loadQuizForEdit(name);
    };
    list.append(b);
  });
}

async function loadQuizForEdit(name) {
  if (
    editingName !== null &&
    isDirty() &&
    !confirm("Discard your unsaved changes to \u201c" + editingName + "\u201d?")
  ) {
    return;
  }
  var buttons = Array.prototype.slice.call(byId("pickerList").querySelectorAll("button"));
  function setBusy(busy) {
    buttons.forEach(function (b) {
      b.disabled = busy;
    });
  }
  setBusy(true);
  try {
    var response = await fetch("/requestQuestions", {
      method: "POST",
      body: JSON.stringify({ quizName: name }),
      headers: { "Content-Type": "application/json" },
    });
    var data = await response.json();
    if (!data || !Array.isArray(data.questions) || !data.questions.length) {
      throw new Error("That quiz has no questions to edit.");
    }
    var takers = null;
    try {
      var pr = await fetch("/requestParticipantListByQuizName", {
        method: "POST",
        body: JSON.stringify({ quizName: name }),
        headers: { "Content-Type": "application/json" },
      });
      var pd = await pr.json();
      if (Array.isArray(pd.participants)) takers = pd.participants.length;
    } catch (e) {}

    if (editingName === null) saveDraft(); // keep an unfinished new quiz for later
    enterEdit(name, data, takers);
  } catch (err) {
    console.error(err);
    alert("Couldn\u2019t load that quiz. Please try again.");
    setBusy(false);
  }
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
  byId("editQuiz").addEventListener("click", function () {
    if (byId("picker").hidden) openPicker();
    else byId("picker").hidden = true;
  });
  byId("pickerClose").addEventListener("click", function () {
    byId("picker").hidden = true;
  });
  window.addEventListener("beforeunload", function (e) {
    if (isDirty()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

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