import * as fs from "fs";
import * as path from "path";
import { minimatch } from "minimatch";

async function getIgnoreList(ignoreFilePath: string): Promise<string[]> {
  let ignoreList: string[] = [];

  try {
    const data = await fs.promises.readFile(ignoreFilePath, "utf-8");
    const lines = data.split(/\r?\n/);

    for (let line of lines) {
      line = line.trim().replace(/\\/g, "/");
      if (line) {
        ignoreList.push(line);
      }
    }
  } catch (error) {
    // エラー処理（必要に応じて追加）
  }
  return ignoreList;
}

function shouldIgnore(filePath: string, ignoreList: string[]): boolean {
  const normalizedFilePath = filePath.split(path.sep).join("/");
  for (const pattern of ignoreList) {
    if (minimatch(normalizedFilePath, pattern)) {
      return true;
    }
  }
  return false;
}

export interface FileContent {
  filePath: string;
  content: string;
}

export async function getRepositoryContents(repoPath: string): Promise<FileContent[]> {
  const fileContents: FileContent[] = [];

  let ignoreFilePath = path.join(repoPath, ".gptignore");

  let ignoreList: string[] = [];
  try {
    await fs.promises.access(ignoreFilePath, fs.constants.F_OK);
    ignoreList = await getIgnoreList(ignoreFilePath);
  } catch {
    const here = path.dirname(__filename);
    ignoreFilePath = path.join(here, ".gptignore");
    try {
      await fs.promises.access(ignoreFilePath, fs.constants.F_OK);
      ignoreList = await getIgnoreList(ignoreFilePath);
    } catch {
      ignoreList = [];
    }
  }

  async function walkDirectory(currentPath: string) {
    const entries = await fs.promises.readdir(currentPath, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativeFilePath = path.relative(repoPath, fullPath).split(path.sep).join("/");

      if (shouldIgnore(relativeFilePath, ignoreList)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walkDirectory(fullPath);
      } else if (entry.isFile()) {
        try {
          const contentsBuffer = await fs.promises.readFile(fullPath);
          const contents = contentsBuffer.toString("utf8");
          fileContents.push({
            filePath: relativeFilePath,
            content: contents,
          });
        } catch (error) {
          // エラー処理（必要に応じて追加）
        }
      }
    }
  }

  await walkDirectory(repoPath);

  return fileContents;
}
