import React, { useState, useEffect, useMemo, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  RotateCcw, 
  Calendar, 
  Bell, 
  BellOff,
  LogOut,
  ClipboardList
} from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { Task, User, RecurrenceType } from "./types";

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("sync_todo_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [isAdding, setIsAdding] = useState(false);

  // New task form state
  const [newText, setNewText] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newRecurrence, setNewRecurrence] = useState<RecurrenceType>("none");
  const [newReminder, setNewReminder] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem("sync_todo_user", JSON.stringify(user));
      fetchTasks();
      // Poll for updates every 10 seconds for "sync" feel
      const interval = setInterval(fetchTasks, 10000);
      return () => clearInterval(interval);
    } else {
      localStorage.removeItem("sync_todo_user");
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/tasks?userId=${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error(err);
      setError("Failed to sync tasks");
    }
  };

  const handleLogin = (username: string) => {
    if (!username.trim()) return;
    // For demo, we just use the username as ID or hash it
    setUser({ id: username.toLowerCase().trim(), username: username.trim() });
  };

  const addTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || !user) return;

    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          text: newText,
          dueDate: newDueDate || undefined,
          recurrence: newRecurrence,
          reminderEnabled: newReminder,
        }),
      });
      if (!res.ok) throw new Error("Failed to add task");
      const newTask = await res.json();
      setTasks([...tasks, newTask]);
      setNewText("");
      setNewDueDate("");
      setNewRecurrence("none");
      setNewReminder(false);
      setIsAdding(false);
    } catch (err) {
      setError("Failed to add task");
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = async (task: Task) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          completed: !task.completed,
        }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      // If recurring, we need to refresh to see the new task
      if (task.recurrence !== "none" && !task.completed) {
        fetchTasks();
      } else {
        const updatedTask = await res.json();
        setTasks(tasks.map(t => t.id === task.id ? updatedTask : t));
      }
    } catch (err) {
      setError("Failed to update task");
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}?userId=${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete task");
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err) {
      setError("Failed to delete task");
    }
  };

  const filteredTasks = useMemo(() => {
    let list = [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (filter === "active") return list.filter(t => !t.completed);
    if (filter === "completed") return list.filter(t => t.completed);
    return list;
  }, [tasks, filter]);

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-dvh flex flex-col max-w-md mx-auto bg-gray-50 pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-4 pt-[env(safe-area-inset-top)] flex justify-between items-center">
        <div>
          <h1 className="text-xl font-display font-bold text-indigo-600 flex items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            SyncTodo
          </h1>
          <p className="text-xs text-gray-500">Logged in as {user.username}</p>
        </div>
        <button 
          onClick={() => setUser(null)}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Stats & Filters */}
      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="flex justify-around bg-white p-1 rounded-xl shadow-sm border border-gray-100">
          {(["all", "active", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
                filter === f 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <main className="flex-1 px-4 overflow-y-auto pb-24">
        <AnimatePresence mode="popLayout">
          {filteredTasks.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-gray-400"
            >
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <ClipboardList className="w-12 h-12 opacity-20" />
              </div>
              <p>No tasks found</p>
            </motion.div>
          ) : (
            filteredTasks.map((task) => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onToggle={() => toggleTask(task)}
                onDelete={() => deleteTask(task.id)}
              />
            ))
          )}
        </AnimatePresence>
      </main>

      {/* Add Task FAB */}
      <div className="fixed bottom-0 inset-x-0 p-4 flex flex-col items-center gap-4 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <AnimatePresence>
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-4 pointer-events-auto"
            >
              <form onSubmit={addTask} className="flex flex-col gap-4">
                <input
                  autoFocus
                  type="text"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full text-base p-2 border-b border-gray-100 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <div className="flex flex-wrap gap-3 items-center text-sm text-gray-500">
                  <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
                    <Calendar className="w-4 h-4" />
                    <input 
                      type="date" 
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="bg-transparent outline-none text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
                    <RotateCcw className="w-4 h-4" />
                    <select 
                      value={newRecurrence}
                      onChange={(e) => setNewRecurrence(e.target.value as RecurrenceType)}
                      className="bg-transparent outline-none text-xs"
                    >
                      <option value="none">No Repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewReminder(!newReminder)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                      newReminder ? "bg-indigo-50 text-indigo-600" : "bg-gray-50"
                    }`}
                  >
                    {newReminder ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    <span className="text-xs">Reminder</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 py-3 text-gray-500 font-medium bg-gray-50 rounded-xl active:scale-95 transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!newText.trim() || loading}
                    type="submit"
                    className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-indigo-200"
                  >
                    {loading ? "Adding..." : "Add Task"}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsAdding(true)}
          className={`w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-all pointer-events-auto ${isAdding ? "hidden" : ""}`}
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>

      {error && (
        <div className="fixed bottom-24 left-4 right-4 bg-red-500 text-white p-3 rounded-lg text-sm shadow-lg text-center animate-bounce">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}
    </div>
  );
}

const TaskItem: React.FC<{ 
  task: Task; 
  onToggle: () => void | Promise<void>; 
  onDelete: () => void | Promise<void> 
}> = ({ task, onToggle, onDelete }) => {
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && !task.completed;

  const dateLabel = useMemo(() => {
    if (!task.dueDate) return null;
    const d = new Date(task.dueDate);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    return format(d, "MMM d");
  }, [task.dueDate]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`group flex items-center gap-3 p-4 bg-white rounded-2xl mb-3 border transition-all ${
        task.completed ? "border-transparent bg-gray-50/50" : "border-gray-100 shadow-sm"
      }`}
    >
      <button 
        onClick={onToggle}
        className={`shrink-0 transition-colors ${
          task.completed ? "text-green-500" : "text-gray-300 hover:text-indigo-400"
        }`}
      >
        {task.completed ? (
          <CheckCircle2 className="w-6 h-6" />
        ) : (
          <Circle className="w-6 h-6" />
        )}
      </button>
      
      <div className="flex-1 min-w-0">
        <p className={`text-base font-medium break-words transition-all ${
          task.completed ? "text-gray-400 line-through" : "text-gray-800"
        }`}>
          {task.text}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {dateLabel && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
              isOverdue ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-500"
            }`}>
              <Calendar className="w-3 h-3" />
              {dateLabel}
            </span>
          )}
          {task.recurrence !== "none" && (
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              {task.recurrence}
            </span>
          )}
          {task.reminderEnabled && (
            <Bell className="w-3 h-3 text-amber-500" />
          )}
        </div>
      </div>

      <button 
        onClick={onDelete}
        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </motion.div>
  );
}

function Login({ onLogin }: { onLogin: (name: string) => void }) {
  const [name, setName] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onLogin(name);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-indigo-600 text-white pb-[env(safe-area-inset-bottom)]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm flex flex-col items-center gap-8"
      >
        <div className="bg-white/10 p-6 rounded-3xl backdrop-blur-lg">
          <ClipboardList className="w-16 h-16" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold mb-2">SyncTodo</h1>
          <p className="text-indigo-100 opacity-80">Simple, synced, reliable.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 mt-4">
          <div className="bg-white rounded-2xl p-4 shadow-xl">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Enter Username to Sync</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. johndoe"
              className="w-full text-lg font-medium text-gray-800 outline-none placeholder:text-gray-300"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-4 bg-white text-indigo-600 font-bold rounded-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-50"
          >
            Get Started
          </button>
        </form>
        
        <p className="text-indigo-200 text-[10px] text-center max-w-[200px]">
          By entering a username, you can sync your tasks across any device using the same name.
        </p>
      </motion.div>
    </div>
  );
}
