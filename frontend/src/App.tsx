import { MapQueryPage } from "./pages/MapQueryPage";
import { QueryProvider } from "./store/queryStore";

export default function App() {
  return (
    <QueryProvider>
      <MapQueryPage />
    </QueryProvider>
  );
}
