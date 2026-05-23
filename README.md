# Connor's Family Quizzes

A quiz app built on Node and Express with a live scoreboard and quiz analytics. Backed by Firebase Realtime Database and deployed serverlessly on Vercel.

**Live:** [connors-family-quizzes.vercel.app](https://connors-family-quizzes.vercel.app)

---

## Features

- Live scoreboard that updates in real time
- Quiz analytics to track results across rounds
- Firebase Realtime Database for scores and session state
- Serverless deployment on Vercel via `serverless-http`

---

## Project Structure

```
Connors-Family-Quizzes/
├── api/                    # Serverless API route handlers
├── liveStreamDataFiles/    # Data files consumed by the live scoreboard
├── public/                 # Static assets (CSS, client-side JS, images)
├── views/                  # HTML template views
├── index.js                # Express app entry point
├── vercel.json             # Vercel deployment config
└── package.json
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v22 or higher
- A [Firebase](https://firebase.google.com/) project with Realtime Database enabled

### Installation

```bash
git clone https://github.com/CoderCCM/Connors-Family-Quizzes.git
cd Connors-Family-Quizzes
npm install
```

### Environment Variables

Create a `.env` file in the root and add your Firebase config:

```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
databaseURL=https://your_project.firebaseio.com
```

`FIREBASE_SERVICE_ACCOUNT` should be the full service account JSON (as a single-line string) from the Firebase console under **Project Settings > Service Accounts**.

`.env` is already in `.gitignore` — don't commit it.

### Running Locally

```bash
node index.js
```

---

## Deployment

The project uses `vercel.json` and `serverless-http` to run Express as a serverless function. Push to your connected GitHub repo and Vercel deploys automatically, or run manually:

```bash
npm install -g vercel
vercel
```

---

## Tech Stack

| | |
|---|---|
| Runtime | Node.js 22.x |
| Framework | Express 4 |
| Database | Firebase Realtime Database |
| Deployment | Vercel |

---

## License

MIT