import { useEffect, useState } from "react";
import { Armario } from "@/components/Armario";
import { EspejoApp } from "@/components/EspejoApp";

const UMBRAL_ESCRITORIO = 1024;

function esEscritorio() {
  return window.innerWidth >= UMBRAL_ESCRITORIO;
}

function App() {
  const [escritorio, setEscritorio] = useState(esEscritorio);

  useEffect(() => {
    function onResize() {
      setEscritorio(esEscritorio());
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return escritorio ? <EspejoApp /> : <Armario />;
}

export default App;
