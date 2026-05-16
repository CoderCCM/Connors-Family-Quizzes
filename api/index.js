// server.js

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const serverless = require("serverless-http");
require("dotenv").config();

// Firebase Admin
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
    databaseURL: process.env.databaseURL,
  });
}

const db = admin.database();

const app = express();
const jsonParser = bodyParser.json();

// Serve static files
app.use(express.static(path.join(__dirname, "../public")));

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/index.html"));
});

app.get("/5", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/quizCreator.html"));
});

app.get("/437143714371", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/adminPortal.html"));
});

app.get("/scoreboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/liveScoreboard.html"));
});

// =======================
// API ROUTES
// =======================

app.post("/requestQuizList", jsonParser, async (req, res) => {
  try {
    const snapshot = await db.ref("quizList").once("value");
    res.json({ quizList: snapshot.val() || [] });
  } catch (err) {
    console.error("requestQuizList error:", err);
    res.status(500).send("Internal error");
  }
});

app.post("/requestQuestions", jsonParser, async (req, res) => {
  try {
    const quizName = req.body.quizName;

    const [questionsSnap, propsSnap] = await Promise.all([
      db.ref(`${quizName} - Questions`).once("value"),
      db.ref(`${quizName} - Properties`).once("value"),
    ]);

    const questions = questionsSnap.val();
    const props = (propsSnap.val() || "").split("!@#$%^&*()");

    res.json({
      questions,
      backgroundColor: props[0],
      backgroundImage: props[1],
    });
  } catch (err) {
    console.error("requestQuestions error:", err);
    res.status(500).send("Internal error");
  }
});

app.post("/requestChoicesByName", jsonParser, async (req, res) => {
  try {
    const { quizName, participantName } = req.body;

    const snapshot = await db
      .ref(`${quizName} - ${participantName} - Choices`)
      .once("value");

    res.json({ choices: snapshot.val() });
  } catch (err) {
    console.error("requestChoicesByName error:", err);
    res.status(500).send("Internal error");
  }
});

app.post("/submitChoicesByName", jsonParser, async (req, res) => {
  try {
    const { quizName, participantName, choices } = req.body;

    await db
      .ref(`${quizName} - ${participantName} - Choices`)
      .set(choices);

    const snapshot = await db
      .ref(`${quizName} - QuizTakers`)
      .once("value");

    let list = snapshot.val() || [];

    // ✅ fixed bug here
    if (!list.includes(participantName)) {
      list.push(participantName);
      await db.ref(`${quizName} - QuizTakers`).set(list);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("submitChoicesByName error:", err);
    res.status(500).send("Internal error");
  }
});

app.post("/requestParticipantListByQuizName", jsonParser, async (req, res) => {
  try {
    const { quizName } = req.body;

    const snapshot = await db
      .ref(`${quizName} - QuizTakers`)
      .once("value");

    let list = snapshot.val() || [];

    // remove dummy entry
    list = list.filter(
      (x) => x !== "Q!W@E#R$T%Y^U&I*O(P)"
    );

    res.json({ participants: list });
  } catch (err) {
    console.error("requestParticipantList error:", err);
    res.status(500).send("Internal error");
  }
});

app.post("/requestIfNameAlreadyExists", jsonParser, async (req, res) => {
  try {
    const { quiz, participantName } = req.body;

    const snapshot = await db
      .ref(`${quiz} - QuizTakers`)
      .once("value");

    const list = snapshot.val() || [];

    res.json({ alreadyExists: list.includes(participantName) });
  } catch (err) {
    console.error("requestIfNameAlreadyExists error:", err);
    res.status(500).send("Internal error");
  }
});

app.post("/createQuiz", jsonParser, async (req, res) => {
  try {
    const { quizName, backgroundColor, backgroundImage, questions } = req.body;

    await Promise.all([
      db
        .ref(`${quizName} - Properties`)
        .set(`${backgroundColor}!@#$%^&*()${backgroundImage}`),

      db.ref(`${quizName} - Questions`).set(questions),

      db
        .ref(`${quizName} - QuizTakers`)
        .set(["Q!W@E#R$T%Y^U&I*O(P)"]),
    ]);

    const snapshot = await db.ref("quizList").once("value");
    let list = snapshot.val() || [];

    list.push(quizName);

    await db.ref("quizList").set(list);

    res.json({ success: true });
  } catch (err) {
    console.error("createQuiz error:", err);
    res.status(500).send("Internal error");
  }
});

// =======================

module.exports = app;
module.exports.handler = serverless(app);