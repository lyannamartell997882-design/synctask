import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const DATA_FILE = path.join(__dirname, "tasks.json");

  // Initialize data file if it doesn't exist
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
  }

  const getTasksData = () => {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } catch (e) {
      return {};
    }
  };

  const saveTasksData = (data: any) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  };

  // API Routes
  app.get("/api/tasks", (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const data = getTasksData();
    res.json(data[userId as string] || []);
  });

  app.post("/api/tasks", (req, res) => {
    const { userId, text, dueDate, recurrence, reminderEnabled } = req.body;
    if (!userId || !text) return res.status(400).json({ error: "Missing required fields" });

    const data = getTasksData();
    const tasks = data[userId] || [];
    const newTask = {
      id: uuidv4(),
      userId,
      text,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate,
      recurrence: recurrence || "none",
      reminderEnabled: reminderEnabled || false,
    };

    tasks.push(newTask);
    data[userId] = tasks;
    saveTasksData(data);
    res.status(201).json(newTask);
  });

  app.put("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const { userId, text, completed, dueDate, recurrence, reminderEnabled } = req.body;
    
    const data = getTasksData();
    const tasks = data[userId] || [];
    const taskIndex = tasks.findIndex((t: any) => t.id === id);

    if (taskIndex === -1) return res.status(404).json({ error: "Task not found" });

    const updatedTask = {
      ...tasks[taskIndex],
      text: text !== undefined ? text : tasks[taskIndex].text,
      completed: completed !== undefined ? completed : tasks[taskIndex].completed,
      dueDate: dueDate !== undefined ? dueDate : tasks[taskIndex].dueDate,
      recurrence: recurrence !== undefined ? recurrence : tasks[taskIndex].recurrence,
      reminderEnabled: reminderEnabled !== undefined ? reminderEnabled : tasks[taskIndex].reminderEnabled,
      updatedAt: new Date().toISOString(),
    };

    // Handle recurrence logic: if completed and recurring, create a new task
    if (completed === true && tasks[taskIndex].completed === false && updatedTask.recurrence !== "none") {
      const nextDueDate = calculateNextDueDate(updatedTask.dueDate || new Date().toISOString(), updatedTask.recurrence);
      const recurringTask = {
        ...updatedTask,
        id: uuidv4(),
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dueDate: nextDueDate,
      };
      tasks.push(recurringTask);
    }

    tasks[taskIndex] = updatedTask;
    data[userId] = tasks;
    saveTasksData(data);
    res.json(updatedTask);
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const { userId } = req.query;

    const data = getTasksData();
    let tasks = data[userId as string] || [];
    tasks = tasks.filter((t: any) => t.id !== id);
    data[userId as string] = tasks;
    saveTasksData(data);
    res.status(204).send();
  });

  function calculateNextDueDate(currentDateStr: string, recurrence: string) {
    const date = new Date(currentDateStr);
    if (recurrence === "daily") date.setDate(date.getDate() + 1);
    else if (recurrence === "weekly") date.setDate(date.getDate() + 7);
    else if (recurrence === "monthly") date.setMonth(date.getMonth() + 1);
    return date.toISOString();
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
