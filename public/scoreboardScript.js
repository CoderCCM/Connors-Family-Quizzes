var bcImage,
  bcColor,
  quizzes = {};

blah();
function blah() {
  //get url param qName
  const urlParams = new URLSearchParams(location.search);
  const qName = urlParams.get("qName");
  if (qName) {
    quizNameGlobal = qName;

    //generate a QR code image src from a URL
    const qrcode = new QRCode(document.getElementById("QR"), {
      text:
        "https://" +
        location.host +
        "?qNameAutoOpen=" +
        encodeURIComponent(qName),
      width: 256,
      height: 256,
      colorDark: "#000",
      colorLight: "#fff",
      correctLevel: QRCode.CorrectLevel.H,
    });

    openQuizOverview(qName);
  } else {
    alert("Attempted to open live scoreboard without a quiz parameter.");
  }
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
}
var quizNameGlobal, liveStreamDataFileName;
async function paintColumnOne(quizName) {
  quizNameGlobal = quizName;
  document.getElementById("participants").innerHTML = "";
  document.getElementById("column1").style.backgroundColor = bcColor;
  document.getElementById("column2").style.backgroundColor = bcColor;
  document.getElementById("row").style.backgroundColor = bcColor;
  document.getElementById("header").style.background = bcColor;
  document.getElementById("updateTime").style.background = bcColor;
  document.body.style.backgroundImage = "url(" + bcImage + ")";

  document.getElementById("quizName").innerHTML = quizName;

  var response = await fetch("/requestParticipantListByQuizNameLive", {
    method: "POST",
    body: JSON.stringify({ quizName: quizName }),
    headers: { "Content-Type": "application/json" },
  });
  console.log(response);
  var data = await response.json();
  liveStreamDataFileName = data.fn;
  console.log(liveStreamDataFileName);
  document.getElementById("participantCount").innerHTML = "";
  setInterval(repeatedFileRead, 10000);
}

async function repaint() {
  var scoreArray = [];
  document.getElementById("participants").innerHTML = "";

  var response = await fetch("/requestParticipantListByQuizName", {
    method: "POST",
    body: JSON.stringify({ quizName: quizNameGlobal }),
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
      body: JSON.stringify({ quizName: quizNameGlobal, participantName: item }),
      headers: { "Content-Type": "application/json" },
    }).then(async (response) => {
      var data = await response.json().then(async (data) => {
        var b = data.choices;
        console.log(b);
        b.forEach(function (selection, index) {
          if (
            selection == quizzes[quizNameGlobal].questions[index].correctAnswer
          ) {
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
          Number(numRight / quizzes[quizNameGlobal].questions.length) * 100
        );
        scoreArray.push(
          Math.floor(
            Number(numRight / quizzes[quizNameGlobal].questions.length) * 100
          )
        );
        console.log(scoreArray);
        p.innerHTML = item + "&nbsp;&nbsp;-&nbsp;&nbsp;" + score + "%";
        p.id = indexier;

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
            "Participants: " + Number(a.length);
          document.getElementById("avgScore").innerHTML =
            "Current Average: " + average + "%";
          highestIndex.forEach(function (item) {
            document.getElementById(item).style.backgroundColor = "gold";
          });
        }
      });
    });
  });
}

var prevData = "";
async function repeatedFileRead() {
  var r = await fetch("/readLiveStreamFile", {
    method: "POST",
    body: JSON.stringify({ fn: liveStreamDataFileName }),
    headers: { "Content-Type": "application/json" },
  });
  var data = await r.json();
  data = data.d;
  console.log(data, prevData);
  if (data != prevData) {
    console.log("Repainting!");
    await repaint();
  } else {
    console.log("Equivalent Data. No need to repaint.");
  }
  prevData = data;

  document.getElementById("updateTime").innerHTML =
    "Last Updated: " + new Date().toLocaleTimeString();
}
