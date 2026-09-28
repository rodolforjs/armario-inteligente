import { Inventario } from "@/components/Inventario";
import { PedirConjunto } from "@/components/PedirConjunto";
import { SubirPrenda } from "@/components/SubirPrenda";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function App() {
  return (
    <div className="max-w-3xl mx-auto p-4">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold mb-4">Armario Inteligente</h1>
        <Tabs defaultValue="subir">
          <TabsList>
            <TabsTrigger value="subir">Subir prenda</TabsTrigger>
            <TabsTrigger value="inventario">Inventario</TabsTrigger>
            <TabsTrigger value="recomendar">Pedir conjunto</TabsTrigger>
          </TabsList>
          <TabsContent value="subir" className="pt-6">
            <SubirPrenda />
          </TabsContent>
          <TabsContent value="inventario" className="pt-6">
            <Inventario />
          </TabsContent>
          <TabsContent value="recomendar" className="pt-6">
            <PedirConjunto />
          </TabsContent>
        </Tabs>
      </header>
    </div>
  );
}

export default App;
