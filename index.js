// server.js
// where your node app starts

// we've started you off with Express (https://expressjs.com/)
// but feel free to use whatever libraries or frameworks you'd like through `package.json`.
const express = require("express");
var bodyParser = require('body-parser')
const fs = require("fs");
require('dotenv').config();
 
// create application/json parser
var jsonParser = bodyParser.json()
const app = express();

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
  // Your web app's Firebase configuration
  var firebaseConfig = {
    apiKey: process.env.apiKey,
    authDomain: process.env.authDomain,
    databaseURL: process.env.databaseURL,
    projectId: process.env.projectId,
    storageBucket: process.env.storageBucket,
    messagingSenderId: process.env.messagingSenderId,
    appId: process.env.appId
  };
  // Initialize Firebase
  const firebaseApp = initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  const { getDatabase, ref, get, set, onValue } = require('firebase/database');
  const db = getDatabase(firebaseApp);

  signInWithEmailAndPassword(auth, process.env.authEmail, process.env.authPassword)
  .then((userCredential) => console.log('Signed in'))
  .catch((error) => {
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
  });




// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));


app.get("/5", (request, response) => {
  response.sendFile(__dirname + "/views/quizCreator.html");
});

app.get("/437143714371", (request, response) => {
  response.sendFile(__dirname + "/views/adminPortal.html");
});

app.get("/scoreboard", (request, response) => {
  response.sendFile(__dirname + "/views/liveScoreboard.html");
});

// https://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});


// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});


app.post('/requestQuizList', jsonParser, (request, response) => {
  console.log("New Connection!")
  get(ref(db, 'quizList')).then((snapshot) => {
    var c = []
    var c = snapshot.val()
    response.json({quizList: c})
  })
})



app.post('/requestQuestions', jsonParser, (request, response) => {
  console.log(request.body)
    get(ref(db, request.body.quizName + " - Questions")).then((snapshot) => {
        get(ref(db, request.body.quizName + " - Properties")).then((properties) => {
    var c = []
    c = snapshot.val()
        var d = []
        d = properties.val().split("!@#$%^&*()")
    response.json({questions: c, backgroundColor: d[0], backgroundImage: d[1]})
    
    
  })
  })

});


app.post('/requestChoicesByName', jsonParser, (request, response) => {
  
    get(ref(db, request.body.quizName + " - " + request.body.participantName + " - Choices")).then((snapshot) => {
    var c = []
    c = snapshot.val()
    response.json({choices: c})
    
    
  })

});

app.post('/submitChoicesByName', jsonParser, (request, response) => {
  
  set(ref(db, request.body.quizName + " - Questions"), request.body.choices);
  
  get(ref(db, request.body.quizName + " - QuizTakers")).then((snapshot) => {
        var a = []
        a = snapshot.val()
        if (a.indexOf(request.participantName)==-1) {
          a.push(request.body.participantName)
        }
        set(ref(db, request.body.quizName + " - QuizTakers"), a);
    });
  
  
  response.json({"A": "A"})

});


app.post('/requestParticipantListByQuizName', jsonParser, (request, response) => {
  
    get(ref(db, request.body.quizName + " - QuizTakers")).then((snapshot) => {
    var c = new Array();
    c = snapshot.val()

    var dudIndex = c.indexOf("Q!W@E#R$T%Y^U&I*O(P)");//get  "car" index
//remove car from the colors array
c.splice(dudIndex, 1); // colors = ["red","blue","green"]
    console.log(c)
    response.json({participants: c})
    
    
  })

});

app.post('/requestParticipantListByQuizNameLive', jsonParser, async (request, response) => {

var fileName = String(Math.floor(Math.random() * 10000000000) + 1) + "QuizTakers.txt";
  
    onValue(ref(db, request.body.quizName + " - QuizTakers"), (snapshot) => {
    console.log("DATA CHANGE!");
    var c = new Array();
    c = snapshot.val()

    var dudIndex = c.indexOf("Q!W@E#R$T%Y^U&I*O(P)");//get  "car" index
//remove car from the colors array
c.splice(dudIndex, 1); // colors = ["red","blue","green"]
    console.log(c)

    fs.writeFileSync("liveStreamDataFiles/" + fileName, c.toString());


  })
  await sleep(1000);
  response.json({fn: fileName})
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.post('/readLiveStreamFile', jsonParser, async (request, response) => {

fs.readFile("liveStreamDataFiles/" + request.body.fn, 'utf8', function (err, data) {
  if (err) {
    return console.log(err);
  }
  console.log(data);
  response.json({d: String(data)})

});
});

app.post('/requestIfNameAlreadyExists', jsonParser, (request, response) => {
  
  var rc = false;
  get(ref(db, request.body.quiz + ' - QuizTakers')).then((snapshot) => {
    var c = []
    var c = snapshot.val()
    
    
      
          if (c.indexOf(request.body.participantName)>-1) {
            rc = true
          }
        
    
      response.json({alreadyExists: rc})
    
  })
  
});






app.post('/createQuiz', jsonParser, (request, response) => {
  
   
 set(ref(db, request.body.quizName + " - Properties"), request.body.backgroundColor + "!@#$%^&*()" + request.body.backgroundImage);
 set(ref(db, request.body.quizName + " - Questions"), request.body.questions); 
 set(ref(db, request.body.quizName + " - QuizTakers"), ["Q!W@E#R$T%Y^U&I*O(P)"]); 
  
  
 get(ref(db, "quizList")).then((snapshot) => {
        var a = []
        a = snapshot.val()
        a.push(request.body.quizName)

        set(ref(db, "quizList"), a); 
    });
});