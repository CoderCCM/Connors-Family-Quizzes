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

  // var response = await fetch("/requestParticipantListByQuizNameLive", {
  //   method: "POST",
  //   body: JSON.stringify({ quizName: quizName }),
  //   headers: { "Content-Type": "application/json" },
  // });
  // console.log(response);
  // var data = await response.json();
  // liveStreamDataFileName = data.fn;
  // console.log(liveStreamDataFileName);
  document.getElementById("participantCount").innerHTML = "";
  // setInterval(repeatedFileRead, 10000);
  repeatedFileRead();
  setInterval(repeatedFileRead, 30000);
}

var scoreArray = [];
var nameArray = [];
var highestscore = 0,
  highestIndex = [];

async function repaint() {
  // Fetch participant list
  const response = await fetch("/requestParticipantListByQuizName", {
    method: "POST",
    body: JSON.stringify({ quizName: quizNameGlobal }),
    headers: { "Content-Type": "application/json" },
  });

  const data = await response.json();
  const participants = data.participants;

  // Update participant count immediately
  document.getElementById("participantCount").textContent =
    "Participants: " + participants.length;

  // Determine which participants are new BEFORE processing loop
  const newParticipants = participants.filter(p => !nameArray.includes(p));

  // For average score + highest score
  let localScores = [];
  let localHighest = 0;
  let localHighestIndices = [];

  for (let i = 0; i < newParticipants.length; i++) {
    const participant = newParticipants[i];
    let numRight = 0;

    // Fetch participant choices
    const choiceRes = await fetch("/requestChoicesByName", {
      method: "POST",
      body: JSON.stringify({
        quizName: quizNameGlobal,
        participantName: participant,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const choiceData = await choiceRes.json();
    const selections = choiceData.choices;

    // Calculate correct answers
    for (let q = 0; q < selections.length; q++) {
      if (selections[q] === quizzes[quizNameGlobal].questions[q].correctAnswer) {
        numRight++;
      }
    }

    // Convert to %
    const score = Math.floor(
      (numRight / quizzes[quizNameGlobal].questions.length) * 100
    );

    // Track global arrays
    scoreArray.push(score);
    nameArray.push(participant);

    // Track local stats for this batch
    localScores.push(score);
    if (score > localHighest) {
      localHighest = score;
      localHighestIndices = [i];
    } else if (score === localHighest) {
      localHighestIndices.push(i);
    }

    // Render participant entry
    const p = document.createElement("p");
    p.textContent = `${participant} - ${score}%`;
    p.id = `participant-${nameArray.length - 1}`;
    document.getElementById("participants").append(p);
  }

  // === After ALL new participants processed ===
  if (newParticipants.length > 0) {
    await new Promise(r => setTimeout(r, 300));

    const sum = scoreArray.reduce((a, b) => a + b, 0);
    const average = Math.floor(sum / scoreArray.length);

    document.getElementById("avgScore").textContent =
      "Current Average: " + average + "%";

    // Clear previous highlights
    scoreArray.forEach((_, idx) => {
      const elem = document.getElementById(`participant-${idx}`);
      if (elem) elem.style.backgroundColor = "transparent";
    });

    // Highlight highest scorers
    localHighestIndices.forEach(localIdx => {
      const globalIdx =
        nameArray.length - newParticipants.length + localIdx;
      const elem = document.getElementById(`participant-${globalIdx}`);
      if (elem) elem.style.backgroundColor = "gold";
    });
  }
}


var prevData = "";
async function repeatedFileRead() {
  // var r = await fetch("/readLiveStreamFile", {
  //   method: "POST",
  //   body: JSON.stringify({ fn: liveStreamDataFileName }),
  //   headers: { "Content-Type": "application/json" },
  // });
  // var data = await r.json();
  // data = data.d;
  // console.log(data, prevData);
  // if (data != prevData) {
    console.log("Repainting!");
    await repaint();
  // } else {
  //   console.log("Equivalent Data. No need to repaint.");
  // }
  // prevData = data;

  document.getElementById("updateTime").innerHTML =
    "Last Updated: " + new Date().toLocaleTimeString();
}
