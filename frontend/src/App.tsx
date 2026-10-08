import { useEffect, useState } from "react";
import { Armario } from "@/components/Armario";
import { EscanerPerchero } from "@/components/EscanerPerchero";
import { EspejoApp } from "@/components/EspejoApp";
import { PruebaVision } from "@/components/PruebaVision";

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

  if (window.location.pathname === "/escaner") {
    return <EscanerPerchero />;
  }

  if (window.location.pathname === "/prueba") {
    return <PruebaVision />;
  }

  return escritorio ? <EspejoApp /> : <Armario />;
}

export default App;
