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
  const resp = await fetch("/requestParticipantListByQuizName", {
    method: "POST",
    body: JSON.stringify({ quizName: quizNameGlobal }),
    headers: { "Content-Type": "application/json" }
  });

  const data = await resp.json();
  const participants = data.participants;

  // Update participant count immediately
  document.getElementById("participantCount").textContent =
    "Participants: " + participants.length;

  // Determine which participants are new
  const newParticipants = participants.filter(p => !nameArray.includes(p));

  // No need to compute averages if nobody new came in
  if (newParticipants.length === 0) return;

  let globalUpdateNeeded = false;

  for (const participant of newParticipants) {

    let numRight = 0;

    // Fetch participant's choices
    const choiceRes = await fetch("/requestChoicesByName", {
      method: "POST",
      body: JSON.stringify({
        quizName: quizNameGlobal,
        participantName: participant
      }),
      headers: { "Content-Type": "application/json" }
    });

    const choiceData = await choiceRes.json();
    const selections = choiceData.choices ?? [];

    // Score calculation (convert both sides to number)
    for (let q = 0; q < selections.length; q++) {
      const selected = Number(selections[q]);
      const correct = Number(quizzes[quizNameGlobal].questions[q].correctAnswer);

      if (selected === correct) numRight++;
    }

    const score = Math.floor(
      (numRight / quizzes[quizNameGlobal].questions.length) * 100
    );

    // Push into global arrays AFTER computing score
    scoreArray.push(score);
    nameArray.push(participant);

    // Determine this participant's global index
    const globalIndex = nameArray.length - 1;

    // Add DOM entry
    const p = document.createElement("p");
    p.id = `participant-${globalIndex}`;
    p.textContent = `${participant} - ${score}%`;
    document.getElementById("participants").append(p);

    globalUpdateNeeded = true;
  }

  // === All new participants processed → Update averages & highlights ===
  if (globalUpdateNeeded) {

    // Compute average
    const sum = scoreArray.reduce((a, b) => a + b, 0);
    const avg = Math.floor(sum / scoreArray.length);

    document.getElementById("avgScore").textContent =
      "Current Average: " + avg + "%";

    // Find global highest score
    const highest = Math.max(...scoreArray);

    // Clear all highlights
    document.querySelectorAll("#participants p").forEach(p => {
      p.style.backgroundColor = "transparent";
    });

    // Highlight all global highest scorers
    scoreArray.forEach((score, idx) => {
      if (score === highest) {
        const elem = document.getElementById(`participant-${idx}`);
        if (elem) elem.style.backgroundColor = "gold";
      }
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
