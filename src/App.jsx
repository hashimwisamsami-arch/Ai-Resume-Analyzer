import { useEffect, useState } from "react";
import constants, {
  buildPresenceChecklist,
  METRIC_CONFIG,
} from "../constants.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
const App = () => {
  const [aiReady, setAiReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [presenceCheckList, setPresenceCheckList] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.puter?.ai?.chat) {
        setAiReady(true);
        clearInterval(interval);
      }
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const extractPDFText = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const texts = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, i) => {
        const page = await pdf.getPage(i + 1);
        const textContent = await page.getTextContent();

        return textContent.items.map((item) => item.str).join(" ");
      }),
    );
    return texts.join("\n").trim();
  };

  const parseJSONResponse = (response) => {
    try {
      const match = response.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : {};
      if (!parsed.overallScore && !parsed.error) {
        throw new Error("Invalid AI response");
      }
      return parsed;
    } catch (error) {
      console.log("Error:", error);

      throw new Error(`Failed to parse AI response: ${error.message}`, {
        cause: error,
      });
    }
  };

  const analyzeResume = async (text) => {
    if (!aiReady) {
      throw new Error("AI service is not ready. Please wait and try again.");
    }
    const prompt = constants.ANALYZE_RESUME_PROMPT.replace(
      "{{DOCUMENT_TEXT}}",
      text,
    );
    const response = await window.puter.ai.chat(
      [
        { role: "system", content: "You are an expert resume reviewer..." },
        { role: "user", content: prompt },
      ],
      {
        model: "gpt-4o",
      },
    );
    const result = parseJSONResponse(
      typeof response === "string" ? response : response.message?.content || "",
    );
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") {
      return alert("please upload pdf file only");
    }
    setUploadFile(file);
    setIsLoading(true);
    setAnalysis(null);
    setResumeText("");
    setPresenceCheckList([]);
    try {
      const text = await extractPDFText(file);
      setResumeText(text);
      setPresenceCheckList(buildPresenceChecklist(text));
      setAnalysis(await analyzeResume(text));
    } catch (error) {
      alert(`Error:${error.message}`);
      console.error(error);
      reset();
    } finally {
      setIsLoading(false);
    }
  };
  const reset = () => {
    setUploadFile(null);
    setAnalysis(null);
    setResumeText("");
    setPresenceCheckList([]);
  };
  return (
    <div className="min-h-screen bg-main-gradient p-4 sm:p-6 lg:p-8 flex items-center justify-center"></div>
  );
};

export default App;
