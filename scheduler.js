import cron from "node-cron";
import { runJobSearchAgent } from "./agent.js";
import dotenv from "dotenv";
dotenv.config();

// Runs every day at 8:00 AM local time
// Cron format: minute hour day month weekday
cron.schedule("0 8 * * *", () => {
  runJobSearchAgent().catch(console.error);
});

console.log("Job search scheduler started. Runs daily at 8:00 AM.");
console.log("Keep this process running (e.g. with pm2 or nohup).");