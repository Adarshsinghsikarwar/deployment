"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Task = {
  id: number;
  title: string;
  completed: boolean;
};

type Filter = "all" | "active" | "completed";

const starterTasks: Task[] = [
  { id: 1, title: "Sketch the weekend itinerary", completed: false },
  { id: 2, title: "Book a table for Saturday", completed: false },
  { id: 3, title: "Water the balcony herbs", completed: true },
];

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window === "undefined") return starterTasks;
    const savedTasks = window.localStorage.getItem("today-tasks");
    if (!savedTasks) return starterTasks;
    try {
      return JSON.parse(savedTasks) as Task[];
    } catch {
      return starterTasks;
    }
  });
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    window.localStorage.setItem("today-tasks", JSON.stringify(tasks));
  }, [tasks]);

  const visibleTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          filter === "all" ||
          (filter === "active" ? !task.completed : task.completed)
      ),
    [filter, tasks]
  );
  const remaining = tasks.filter((task) => !task.completed).length;

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setTasks((current) => [
      { id: Date.now(), title, completed: false },
      ...current,
    ]);
    setDraft("");
  }

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  function removeTask(id: number) {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  function clearCompleted() {
    setTasks((current) => current.filter((task) => !task.completed));
  }

  return (
    <main className="app-shell">
      <section className="todo-card" aria-labelledby="page-title">
        <header className="todo-header">
          <div>
            <p className="eyebrow">Sunday, September 20</p>
            <h1 id="page-title">A little progress.</h1>
            <p className="subtitle">Keep the day light, one task at a time.</p>
          </div>
          <div
            className="progress-mark"
            aria-label={`${remaining} tasks remaining`}
          >
            <span>{remaining}</span>
            <small>left</small>
          </div>
        </header>

        <form className="add-form" onSubmit={addTask}>
          <input
            aria-label="New task"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What needs doing?"
          />
          <button type="submit">
            Add task <span>+</span>
          </button>
        </form>

        <div className="task-toolbar">
          <div className="filters" aria-label="Filter tasks">
            {(["all", "active", "completed"] as Filter[]).map((option) => (
              <button
                className={filter === option ? "filter active" : "filter"}
                key={option}
                type="button"
                onClick={() => setFilter(option)}
              >
                {option[0].toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
          <button
            className="clear-button"
            type="button"
            onClick={clearCompleted}
          >
            Clear completed
          </button>
        </div>

        <ul className="task-list">
          {visibleTasks.length ? (
            visibleTasks.map((task) => (
              <li
                className={task.completed ? "task completed" : "task"}
                key={task.id}
              >
                <button
                  className="check-button"
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  aria-label={`Mark ${task.title} ${
                    task.completed ? "active" : "complete"
                  }`}
                >
                  {task.completed ? "✓" : ""}
                </button>
                <span>{task.title}</span>
                <button
                  className="delete-button"
                  type="button"
                  onClick={() => removeTask(task.id)}
                  aria-label={`Delete ${task.title}`}
                >
                  ×
                </button>
              </li>
            ))
          ) : (
            <li className="empty-state">
              Nothing here yet. Add a small win above.
            </li>
          )}
        </ul>

        <footer className="todo-footer">
          <span>
            {remaining} {remaining === 1 ? "task" : "tasks"} to go
          </span>
          <span className="footer-dot">•</span>
          <span>Make room for good things</span>
        </footer>
      </section>
    </main>
  );
}
