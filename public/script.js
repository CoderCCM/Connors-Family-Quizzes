blah();
var questions = [];
async function blah() {
  var response = await fetch("/requestQuizList", {
    method: "POST",
    body: JSON.stringify({ a: "A" }),
    headers: { "Content-Type": "application/json" },
  });
  var data = await response.json();
  var quizList = data.quizList;
  quizList.reverse();
  quizList.forEach(function (item, index) {
    var button = document.createElement("button");
    button.innerHTML = item;
    button.id = item;
    if (localStorage.getItem(item + "-Taken")) {
      button.innerHTML += " - View Score";
      button.onclick = function () {
        button.disabled = "true";
        button.innerHTML = "LOADING QUIZ";
        openScorePage(item);
      };
    } else {
      button.style.backgroundColor = "lightgreen";
      button.onclick = function () {
        button.disabled = "true";
        button.innerHTML = "LOADING QUIZ";
        beginQuiz(item);
      };
    }
    button.className = "centerButtons";
    document.getElementById("quizList").appendChild(button);
  });

  //get url param qNameAutoOpen
  const urlParams = new URLSearchParams(location.search);
  const qNameAutoOpen = urlParams.get("qNameAutoOpen");
  if (qNameAutoOpen) {
    document.getElementById(qNameAutoOpen).click();
  }
}

var questionCounter = 0; //Tracks question number
var selections = []; //Array containing user choices
var quiz = $("#quiz"); //Quiz div object
// Display initial question

async function openScorePage(quizName) {
  participantName = participantName || localStorage.getItem("name");
  if (!participantName || !participantName.trim()) {
    alert("Your saved name is missing. Start the quiz again to enter your name.");
    return;
  }

  document.getElementById("currentQuiz").innerHTML = quizName;
  var response = await fetch("/requestQuestions", {
    method: "POST",
    body: JSON.stringify({ quizName: quizName }),
    headers: { "Content-Type": "application/json" },
  });
  console.log(response);
  var data = await response.json();
  document.body.style.backgroundImage = "url(" + data.backgroundImage + ")";

  document.getElementById("container").style.backgroundColor =
    data.backgroundColor;

  var actualQuestions = [];
  actualQuestions = data.questions;
  console.log(actualQuestions);

  var response = await fetch("/requestChoicesByName", {
    method: "POST",
    body: JSON.stringify({
      quizName: quizName,
      participantName: participantName,
    }),
    headers: { "Content-Type": "application/json" },
  });
  var data = await response.json();
  var choices = data.choices;

  document.getElementById("next").style.display = "none";
  var container = document.getElementById("container");
  var c = document.getElementById("container");
  var h2 = document.createElement("h2");
  h2.id = "scoreH2";
  container.append(h2);
  var h2 = document.createElement("h2");
  h2.innerHTML =
    "Attempted: " + new Date(Number(localStorage.getItem(quizName + "-Taken"))).toLocaleDateString() + " " + new Date(Number(localStorage.getItem(quizName + "-Taken"))).toLocaleTimeString();
  c.append(h2);

  var h1 = document.createElement("h1");
  h1.innerHTML = participantName + "'s Quiz:";
  c.append(h1);
  var correctQuestionCounter = 0;
  actualQuestions.forEach(function (question, indexer) {
    var parts = [];
    parts = question.split("!@#$%^&*()");
    var actualQuestion = parts[0];
    var actualChoices = [];
    actualChoices = parts[1].split("{}|");
    var actualCorrectAnswer = parts[2];

    var h2 = document.createElement("h2");
    h2.innerHTML = actualQuestion;
    c.append(h2);
    actualChoices.forEach(function (choice, index) {
      console.log(choice);
      var h3 = document.createElement(h3);
      if (index == actualCorrectAnswer) {
        h3.style.backgroundColor = "lightgreen";
      }

      if (choices[indexer] == index) {
        if (index == actualCorrectAnswer) {
          h3.style.backgroundColor = "lightgreen";
          correctQuestionCounter++;
        } else {
          h3.style.backgroundColor = "red";
        }
      }
      h3.innerHTML = choice;
      c.append(h3, document.createElement("BR"));
    });
  });
  document.getElementById("scoreH2").innerHTML =
    participantName +
    "'s score: " +
    String(
      correctQuestionCounter +
        "/" +
        actualQuestions.length +
        " " +
        String(
          Math.floor(
            Number(correctQuestionCounter / actualQuestions.length) * 100
          )
        ) +
        "%"
    );
  document.getElementById("quizListOverlay").style.display = "none";
}

function promptForName() {
  var localName;
  while (!localName || !localName.trim()) {
    localName = prompt(
      "What is your name?\nNOTE: This cannot be changed, please enter your real name."
    );
  }
  return localName.trim();
}

var quizName, participantName;
async function beginQuiz(qName) {
  participantName = localStorage.getItem("name");
  if (!participantName || !participantName.trim()) {
    var allowedToPass = false;
    while (!allowedToPass) {
      var enteredName = promptForName();
      var response = await fetch("/requestIfNameAlreadyExists", {
        method: "POST",
        body: JSON.stringify({ participantName: enteredName, quiz: qName }),
        headers: { "Content-Type": "application/json" },
      });
      var data = await response.json();
      if (data.alreadyExists == false) {
        allowedToPass = true;
        participantName = enteredName;
        localStorage.setItem("name", participantName);
      } else {
        alert("Sorry, that name is already in our system. Please try another.");
      }
    }
  } else {
    participantName = participantName.trim();
    alert("Welcome back, " + participantName + "!");
  }

  var response = await fetch("/requestQuestions", {
    method: "POST",
    body: JSON.stringify({ quizName: qName }),
    headers: { "Content-Type": "application/json" },
  });
  var data = await response.json();
  questions = data.questions;
  document.body.style.backgroundImage = "url(" + data.backgroundImage + ")";
  document.getElementById("container").style.backgroundColor =
    data.backgroundColor;

  quizName = qName;
  document.getElementById("currentQuiz").innerHTML = qName;
  displayNext();
  document.getElementById("quizListOverlay").style.display = "none";
}

// Click handler for the 'next' button
$("#next").on("click", function (e) {
  e.preventDefault();

  // Suspend click listener during fade animation
  if (quiz.is(":animated")) {
    return false;
  }
  choose();

  // If no user selection, progress is stopped
  if (isNaN(selections[questionCounter])) {
    alert("Please make a selection!");
  } else {
    questionCounter++;
    displayNext();
  }
});

// Click handler for the 'prev' button
$("#prev").on("click", function (e) {
  e.preventDefault();

  if (quiz.is(":animated")) {
    return false;
  }
  choose();
  questionCounter--;
  displayNext();
});

// Click handler for the 'Start Over' button
$("#start").on("click", function (e) {
  e.preventDefault();

  if (quiz.is(":animated")) {
    return false;
  }
  questionCounter = 0;
  selections = [];
  displayNext();
  $("#start").hide();
});

// Animates buttons on hover
$(".button").on("mouseenter", function () {
  $(this).addClass("active");
});
$(".button").on("mouseleave", function () {
  $(this).removeClass("active");
});

// Creates and returns the div that contains the questions and
// the answer selections
function createQuestionElement(index) {
  var qElement = $("<div>", {
    id: "question",
  });

  var header = $(
    "<h2>Question " +
      (index + 1) +
      "/" +
      questions.length +
      // " (" +
      // Math.round(Number(index / questions.length) * 100) +
      // "%  completed):</h2>"
      "</h2>"
  );
  qElement.append(header);

  var parts = [];
  parts = questions[index].split("!@#$%^&*()");
  var actualQuestionText = parts[0];
  var question = $("<p>").append(actualQuestionText);
  qElement.append(question);

  var radioButtons = createRadios(index);
  qElement.append(radioButtons);

  return qElement;
}

// Creates a list of the answer choices as radio inputs
function createRadios(index) {
  var radioList = $("<ul>");
  var item;
  var input = "";
  var partsOfQuestion = [];
  partsOfQuestion = questions[index].split("!@#$%^&*()");
  var actualChoices = [];
  actualChoices = partsOfQuestion[1].split("{}|");
  for (var i = 0; i < actualChoices.length; i++) {
    item = $("<li>");
    input = '<input type="radio" name="answer" value=' + i + " />";
    input += actualChoices[i];
    item.append(input);
    radioList.append(item);
  }
  return radioList;
}

// Reads the user selection and pushes the value to an array
function choose() {
  selections[questionCounter] = +$('input[name="answer"]:checked').val();
}

// Displays next requested element
function displayNext() {
  quiz.fadeOut(function () {
    $("#question").remove();

    if (questionCounter < questions.length) {
      var nextQuestion = createQuestionElement(questionCounter);
      quiz.append(nextQuestion).fadeIn();
      $("#next a").text(
        questionCounter === questions.length - 1 ? "Submit" : "Next"
      );
      if (!isNaN(selections[questionCounter])) {
        $("input[value=" + selections[questionCounter] + "]").prop(
          "checked",
          true
        );
      }

      // Controls display of 'prev' button
      if (questionCounter === 1) {
        $("#prev").show();
      } else if (questionCounter === 0) {
        $("#prev").hide();
        $("#next").show();
      }
    } else {
      var scoreElem = displayScore();
      quiz.append(scoreElem).fadeIn();
      $("#next").hide();
      $("#prev").hide();
      $("#start").show();
    }
  });
}

// Computes score and returns a paragraph element to be displayed
async function displayScore() {
  var c = document.getElementById("container");

  var score = $("<h2>", { id: "question" });
  if (!participantName || !participantName.trim()) {
    alert("Your name is missing, so your results could not be reported.");
    return score;
  }

  var reportSucceeded = false;
  try {
    var response = await fetch("/submitChoicesByName", {
      method: "POST",
      body: JSON.stringify({
        quizName: quizName,
        participantName: participantName,
        choices: selections,
      }),
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Submission failed with status ${response.status}`);
    }
    var data = await response.json();
    if (!data.success) {
      throw new Error("Submission was not accepted");
    }
    reportSucceeded = true;
  } catch (error) {
    console.error("submitChoicesByName error:", error);
    alert("Your results could not be reported. Please check your connection and try again.");
  }
  if (reportSucceeded) {
    localStorage.setItem(quizName + "-Taken", String(new Date().getTime()));
  }

  var numCorrect = 0;
  for (var i = 0; i < selections.length; i++) {
    var partsOfQuestion = [];
    partsOfQuestion = questions[i].split("!@#$%^&*()");
    var correctAnswer = partsOfQuestion[2];
    if (selections[i] == correctAnswer) {
      numCorrect++;
    }
  }
  var h2 = document.createElement("h2");
  h2.innerHTML =
    participantName +
    "'s score: " +
    numCorrect +
    "/" +
    questions.length +
    " " +
    String(Math.floor(Number(numCorrect / questions.length) * 100)) +
    "%</h2>";
  c.append(h2);
  var h2 = document.createElement("h2");
  h2.innerHTML =
    "Attempted: " + new Date(Number(localStorage.getItem(quizName + "-Taken"))).toLocaleDateString() + " " + new Date(Number(localStorage.getItem(quizName + "-Taken"))).toLocaleTimeString();
  c.append(h2);

  var h1 = document.createElement("h1");
  h1.innerHTML = participantName + "'s Quiz:";
  c.append(h1);
  questions.forEach(function (question, indexer) {
    var partsOfQuestion = [];
    partsOfQuestion = question.split("!@#$%^&*()");
    var actualChoices = [];
    actualChoices = partsOfQuestion[1].split("{}|");

    var h2 = document.createElement("h2");
    h2.innerHTML = partsOfQuestion[0];
    c.append(h2);
    actualChoices.forEach(function (choice, index) {
      console.log(choice);
      var h3 = document.createElement(h3);
      if (index == partsOfQuestion[2]) {
        h3.style.backgroundColor = "lightgreen";
      }

      if (selections[indexer] == index) {
        if (index == partsOfQuestion[2]) {
          h3.style.backgroundColor = "lightgreen";
        } else {
          h3.style.backgroundColor = "red";
        }
      }
      h3.innerHTML = choice;
      c.append(h3, document.createElement("BR"));
    });
  });

  return score;
}
