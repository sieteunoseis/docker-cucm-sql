import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { EditorPage } from "@/pages/EditorPage";
import { LogPage } from "@/pages/LogPage";
import { HelpPage } from "@/pages/HelpPage";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<EditorPage />} />
        <Route path="/q/*" element={<EditorPage />} />
        <Route path="/log" element={<LogPage />} />
        <Route path="/help" element={<HelpPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
