import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { EditorPage } from "@/pages/EditorPage";
import { LogPage } from "@/pages/LogPage";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<EditorPage />} />
        <Route path="/q/*" element={<EditorPage />} />
        <Route path="/log" element={<LogPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
