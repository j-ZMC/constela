import { join } from "node:path";

// The interpreter for the scripts in backend/: PYTHON_EXECUTABLE, or the project's .venv.
export function pythonExecutable(): string {
  const win = process.platform === "win32";
  return process.env.PYTHON_EXECUTABLE ?? join(process.cwd(), ".venv", win ? "Scripts" : "bin", win ? "python.exe" : "python");
}
