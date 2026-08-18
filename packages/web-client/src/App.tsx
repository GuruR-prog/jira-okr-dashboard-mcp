import { useState } from "react";
import { TicketsView } from "./TicketsView.js";
import { OnCallIncidentsView } from "./OnCallIncidentsView.js";

type Tab = "tickets" | "oncall";

export default function App() {
  const [tab, setTab] = useState<Tab>("tickets");

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Team Jira Dashboard</h1>
          <nav className="app-tabs">
            <button
              type="button"
              className={`app-tab ${tab === "tickets" ? "app-tab-active" : ""}`}
              onClick={() => setTab("tickets")}
            >
              Tickets
            </button>
            <button
              type="button"
              className={`app-tab ${tab === "oncall" ? "app-tab-active" : ""}`}
              onClick={() => setTab("oncall")}
            >
              On-Call & Incidents
            </button>
          </nav>
        </div>
      </header>

      {tab === "tickets" ? <TicketsView /> : <OnCallIncidentsView />}
    </div>
  );
}
