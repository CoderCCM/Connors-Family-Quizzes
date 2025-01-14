function updateImage() {
  document.getElementById("demo").src = document.getElementById(
    "backgroundImage"
  ).value;
}

function updateBcColor() {
  document.getElementById(
    "bcColorDemo"
  ).style.backgroundColor = document.getElementById("backgroundColor").value;
}

var questionCounter = 1;

function newQuestion() {
  var c = document.getElementById("questionsDiv");
  var h3 = document.createElement("h3");
  h3.innerHTML = questionCounter + ". ";
  h3.style.display = "inline";
  c.append(h3);
  var input = document.createElement("textarea");
  input.id = "question" + questionCounter;
  input.placeholder = "Question " + questionCounter + "...";
  input.style.width = "90%";
  c.append(input, document.createElement("BR"));
  var div = document.createElement("div");
  div.id = "question" + questionCounter + "Options";
  c.append(div);

  newOption(questionCounter);
  newOption(questionCounter);
  newOption(questionCounter);
  newOption(questionCounter);

  questionCounter++;
}

function newOption(questionNumber) {
  var optionsDiv = document.getElementById(
    "question" + questionNumber + "Options"
  );
  var optionCounter = 0;
  document
    .querySelectorAll(".question" + questionNumber + "Option")
    .forEach(function (option) {
      optionCounter++;
    });

  var newOptionDiv = document.createElement("div");
  newOptionDiv.className = "question" + questionNumber + "Option";

  var radioButton = document.createElement("input");
  radioButton.type = "radio";
  radioButton.name = "question" + questionNumber;
  radioButton.value = Number(optionCounter);
  radioButton.className = "question" + questionNumber + "OptionRadio";

  var input = document.createElement("input");
  input.id = "question" + questionNumber + "option" + Number(optionCounter + 1);
  input.className = "question" + questionNumber + "OptionTextbox";
  input.placeholder = "Option " + Number(optionCounter) + "...";

  newOptionDiv.append(radioButton, input);

  optionsDiv.append(newOptionDiv);

  if (optionCounter == 1) {
    var button = document.createElement("button");
    button.innerHTML = "Add Another Option";
    button.onclick = function () {
      newOption(questionNumber);
    };
    document
      .getElementById("questionsDiv")
      .append(button, document.createElement("BR"));
  }
}

async function createQuiz() {
  var p = confirm("ARE YOU SURE?");
  if (!p) {
    return;
  }

  var bodyOfRequest = {
    quizName: document.getElementById("quizName").value,
    questions: [],
    backgroundColor: document.getElementById("backgroundColor").value,
    backgroundImage: document.getElementById("backgroundImage").value,
  };
  for (var i = 1; i < questionCounter; i++) {
    var item = document.getElementById("question" + i).value;
    item += "!@#$%^&*()";

    var optionCounter = 1;
    var optionArray = [];
    document
      .querySelectorAll(".question" + i + "OptionTextbox")
      .forEach(function (textbox) {
        optionArray.push(
          document.getElementById("question" + i + "option" + optionCounter)
            .value
        );
        optionCounter++;
      });

    var optionString = "";
    optionArray.forEach(function (item, index) {
      if (optionString != "") {
        optionString += "{}|";
      }
      optionString += item;
    });

    item += optionString;
    item += "!@#$%^&*()";

    var correctOption = document.querySelector(
      "input[name=question" + i + "]:checked"
    ).value;
    var correctOptionIndex = optionArray.indexOf(correctOption);

    item += correctOption;

    bodyOfRequest.questions.push(item);
  }

  console.log(bodyOfRequest);
  var response = await fetch("/createQuiz", {
    method: "POST",
    body: JSON.stringify(bodyOfRequest),
    headers: { "Content-Type": "application/json" },
  });
  console.log(response);
}
