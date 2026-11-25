var quizzes = {};
var bcImage, bcColor;

blah();

async function blah() {
  var response = await fetch("/requestQuizList", {
    method: "POST",
    body: JSON.stringify({ a: "A" }),
    headers: { "Content-Type": "application/json" },
  });
  var data = await response.json();
  var quizList = data.quizList;
  quizList.reverse();
  quizList.forEach(function (item) {
    var button = document.createElement("button");
    button.innerHTML = item;
    button.onclick = function () {
      navigate(quizHash(item));
    };
    document.body.append(
      button,
      document.createElement("BR"),
      document.createElement("BR"),
      document.createElement("BR")
    );
  });
  route();
}

async function openQuizOverview(quizName) {
  var response = await fetch("/requestQuestions", {
    method: "POST",
    body: JSON.stringify({ quizName: quizName }),
    headers: { "Content-Type": "application/json" },
  });
  console.log(response);
  var data = await response.json();
  bcImage = data.backgroundImage;
  bcColor = data.backgroundColor;

  var objToInsert = { questions: [] };
  data.questions.forEach(function (item, index) {
    var questionObject = {};
    var partsOfQuestion = [];
    partsOfQuestion = item.split("!@#$%^&*()");
    var actualChoices = [];
    actualChoices = partsOfQuestion[1].split("{}|");

    questionObject["question"] = partsOfQuestion[0];
    questionObject["choices"] = [];
    questionObject["correctAnswer"] = partsOfQuestion[2];

    actualChoices.forEach(function (choice) {
      questionObject["choices"].push(choice);
    });

    objToInsert.questions.push(questionObject);
  });
  quizzes[quizName] = objToInsert;
  console.log(quizzes);

  paintColumnOne(quizName);
  if (parseRoute().quiz === quizName) {
    document.getElementById("quizOverviewOverlay").style.display = "block";
  }
}
var quizNameGlobal, quizDateGlobal;
async function paintColumnOne(quizName) {
  quizNameGlobal = quizName;
  document.getElementById("participants").innerHTML = "";
  document.getElementById("column1").style.backgroundColor = bcColor;
  document.getElementById("questionsDiv").style.backgroundColor = bcColor;
  var detailPane = document.getElementById("column2");
  detailPane.innerHTML = "";
  detailPane.style.backgroundImage = "";
  var scoreArray = [];
  document.getElementById("quizName").innerHTML = quizName;
  document.getElementById("quizDate").innerHTML = ""; //quizzes[quizName].date;
  quizDateGlobal = ""; //quizzes[quizName].date;

  var response = await fetch("/requestParticipantListByQuizName", {
    method: "POST",
    body: JSON.stringify({ quizName: quizName }),
    headers: { "Content-Type": "application/json" },
  });
  console.log(response);
  var data = await response.json();

  var a = data.participants;
  document.getElementById("participantCount").innerHTML =
    "Participants: " + String(Number(a.length));
  var highestscore = 0,
    highestIndex = [];
  a.forEach(async function (item, indexier) {
    var score;
    var numRight = 0;
    var p = document.createElement("p");

    var response = await fetch("/requestChoicesByName", {
      method: "POST",
      body: JSON.stringify({ quizName: quizName, participantName: item }),
      headers: { "Content-Type": "application/json" },
    }).then(async (response) => {
      var data = await response.json().then(async (data) => {
        var b = data.choices;
        console.log(b);
        b.forEach(function (selection, index) {
          if (selection == quizzes[quizName].questions[index].correctAnswer) {
            numRight++;
          }
        });
        if (numRight > highestscore) {
          highestscore = numRight;
          highestIndex = [];
          highestIndex.push(indexier);
        } else if (numRight == highestscore) {
          highestIndex.push(indexier);
        }
        var score = Math.floor(
          Number(numRight / quizzes[quizName].questions.length) * 100
        );
        scoreArray.push(
          Math.floor(
            Number(numRight / quizzes[quizName].questions.length) * 100
          )
        );
        console.log(scoreArray);
        p.innerHTML = item + " \u2014 " + score + "%";
        p.id = indexier;
        p.onclick = function () {
          var c = document.getElementById("column2");
          c.innerHTML = "";
          c.style.backgroundImage = "url(" + bcImage + ")";
          c.scrollIntoView({ behavior: "smooth", block: "start" });
          var h1 = document.createElement("h1");
          h1.innerHTML = item + "'s Quiz:";
          h1.style.backgroundColor = bcColor;
          h1.style.width = "content";
          c.append(h1);
          quizzes[quizName].questions.forEach(function (question, indexer) {
            var h2 = document.createElement("h2");
            h2.innerHTML = Number(indexer + 1) + ". " + question.question;
            h2.style.backgroundColor = bcColor;
            h2.style.width = "content";
            c.append(h2);
            question.choices.forEach(function (choice, index) {
              console.log(choice);
              var h3 = document.createElement("h3");
              if (index == question.correctAnswer) {
                h3.style.backgroundColor = "lightgreen";
              }
              if (b[indexer] == index) {
                if (index == question.correctAnswer) {
                  h3.style.backgroundColor = "lightgreen";
                } else {
                  h3.style.backgroundColor = "red";
                }
              }
              if (!h3.style.backgroundColor) {
                h3.style.backgroundColor = bcColor;
              }
              h3.style.width = "content";
              h3.innerHTML = choice;
              h3.className = "optionH3";
              c.append(h3);
            });
          });
        };
        document.getElementById("participants").append(p);
        console.log(p);
        if (indexier == a.length - 1) {
          await new Promise((r) => setTimeout(r, 1000));

          console.log(indexier);
          console.log("a");
          //totalPointsPossible=Number(quizzes[quizName].questions.length)*a.length;
          var sum = 0;
          console.log("a");
          console.log(scoreArray);
          scoreArray.forEach(function (score) {
            console.log(score);
            sum = sum + Number(score);
          });

          console.log("a");
          console.log("SUM ", sum);
          var average = Math.floor(sum / scoreArray.length);
          document.getElementById("participantCount").innerHTML =
            "Participants: " +
            Number(a.length) +
            ", avg. score: " +
            average +
            "%";
          highestIndex.forEach(function (item) {
            document.getElementById(item).style.backgroundColor = "gold";
          });
        }
      });
    });
  });
}
var selections = [];
async function openQuestionOverview() {
  document.getElementById("questionOverviewOpener").style.display = "none";
  document.getElementById("questionOverviewOverlay").style.backgroundImage =
    "url(" + bcImage + ")";
  selections = [];

  var response = await fetch("/requestParticipantListByQuizName", {
    method: "POST",
    body: JSON.stringify({ quizName: quizNameGlobal }),
    headers: { "Content-Type": "application/json" },
  });
  console.log(response);
  var data = await response.json();
  var f = data.participants;
  f.forEach(async function (quizTaker, index) {
    console.log("QT: " + quizTaker);
    if (quizTaker !== "QWERTYUIOP") {
      var response = await fetch("/requestChoicesByName", {
        method: "POST",
        body: JSON.stringify({
          quizName: quizNameGlobal,
          participantName: quizTaker,
        }),
        headers: { "Content-Type": "application/json" },
      }).then(async (responsee) => {
        var data = await responsee.json().then(async (datae) => {
          console.log("QTC: ", datae);
          var g = datae.choices;
          selections.push(g);

          if (index == f.length - 1) {
            await new Promise((r) => setTimeout(r, 1000));
            console.log("QTC EOL" + f.length);
            console.log(selections);
            document.getElementById("quizName2").innerHTML = quizNameGlobal;
            document.getElementById("quizDate2").innerHTML = quizDateGlobal;
            var e = document.getElementById("questionsDiv");
            e.innerHTML = "";
            quizzes[quizNameGlobal].questions.forEach(function (
              question,
              indexer
            ) {
              var h2 = document.createElement("h2");
              h2.innerHTML = Number(indexer + 1) + ". " + question.question;
              e.append(h2);
              question.choices.forEach(function (choice, index) {
                console.log(choice);
                var h3 = document.createElement("h3");
                var numPeoplePicked = 0;
                console.log(selections);
                for (var z = 0; z < selections.length - 1; z++) {
                  console.log("RUN2");
                }

                h3.innerHTML =
                  findNumPeopleThatChoseOption(selections, indexer, index) +
                  " \u2014 " +
                  choice;
                if (index == question.correctAnswer) {
                  h3.style.backgroundColor = "lightgreen";
                }
                e.append(h3);
              });
            });
            if (parseRoute().view === "questions") {
              document.getElementById("questionOverviewOverlay").style.display =
                "block";
            }

            document.getElementById("questionOverviewOpener").style.display =
              "inline-block";
          }
        });
      });
    }
  });
}
function findNumPeopleThatChoseOption(selectionsa, indexer, index) {
  var numPeoplePicked = 0;
  var keysArray = [];
  console.log(String(selectionsa));
  selections.forEach(function (item) {
    var y = [];
    y = item;
    if (y[indexer] == index) {
      numPeoplePicked++;
    }
  });
  return String(
    numPeoplePicked +
      " (" +
      Math.round(
        Number(Number(numPeoplePicked / selectionsa.length) * 100) * 10
      ) /
        10 +
      "%)"
  );
}

function openLiveScoreboard() {
  location.assign("/scoreboard?qName=" + encodeURIComponent(quizNameGlobal));
}


// ---------- Browser history / back button ----------
// The URL hash tells us which screen we're on:
//   (none)                        quiz list
//   #quiz=NAME                    that quiz's overview
//   #quiz=NAME&view=questions     that quiz's question overview
// Moving between screens pushes a history entry, so the browser's back
// button (or a phone's back swipe) steps back one screen, and refreshing
// the page keeps you where you were.
var shownQuiz = null; // quiz whose overview is currently loaded

function quizHash(name, view) {
  return "#quiz=" + encodeURIComponent(name) + (view ? "&view=" + view : "");
}

function parseRoute() {
  var params = new URLSearchParams(location.hash.replace(/^#/, ""));
  return { quiz: params.get("quiz"), view: params.get("view") };
}

function navigate(hash) {
  history.pushState({ app: true }, "", hash || location.pathname + location.search);
  route();
}

function showQuestionOverview() {
  navigate(quizHash(quizNameGlobal, "questions"));
}

// target: "list" or "overview" - where to land if there is no in-app
// history to step back through (e.g. the page was opened from a link)
function goBack(target) {
  if (history.state && history.state.app) {
    history.back();
    return;
  }
  var hash = target === "overview" ? quizHash(quizNameGlobal) : "";
  history.replaceState({}, "", hash || location.pathname + location.search);
  route();
}

async function route() {
  var r = parseRoute();
  var overview = document.getElementById("quizOverviewOverlay");
  var questionOverlay = document.getElementById("questionOverviewOverlay");
  var opener = document.getElementById("questionOverviewOpener");

  if (!r.quiz) {
    // quiz list; forget the loaded quiz so reopening it fetches fresh data
    shownQuiz = null;
    overview.style.display = "none";
    questionOverlay.style.display = "none";
    return;
  }

  if (shownQuiz !== r.quiz) {
    shownQuiz = r.quiz;
    questionOverlay.style.display = "none";
    await openQuizOverview(r.quiz);
  } else {
    overview.style.display = "block";
  }

  if (r.view === "questions") {
    // a hidden opener button means the question overview is already loading
    if (questionOverlay.style.display !== "block" && opener.style.display !== "none") {
      openQuestionOverview();
    }
  } else {
    questionOverlay.style.display = "none";
  }
}

window.addEventListener("popstate", route);