import { useState } from "react";
import { Armario } from "@/components/Armario";
import { ChatApp } from "@/components/ChatApp";
import { Button } from "@/components/ui/button";

type Vista = "armario" | "chat";

function App() {
  const [vista, setVista] = useState<Vista>("armario");

  return (
    <div className="flex flex-col h-screen">
      <nav className="flex gap-2 p-4 border-b border-[var(--border)]">
        <Button type="button" variant={vista === "armario" ? "default" : "outline"} size="sm" onClick={() => setVista("armario")}>
          👕 Armario
        </Button>
        <Button type="button" variant={vista === "chat" ? "default" : "outline"} size="sm" onClick={() => setVista("chat")}>
          💬 Pedir idea
        </Button>
      </nav>
      <div className="flex-1 overflow-y-auto">{vista === "armario" ? <Armario /> : <ChatApp />}</div>
    </div>
  );
}

export default App;
