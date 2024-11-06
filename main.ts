import { FileContent, getRepositoryContents } from "./getRepositoryContents";
import { OpenAI } from "openai";
import { encode } from "gpt-tokenizer";
import * as fs from "fs"; // ファイルシステムモジュールの追加

async function main() {
  let repoPath = "./"; // デフォルトのディレクトリパス
  let ignoreFilePath: string | undefined;
  let contextFilePath: string | undefined; // コンテキストファイルパスの追加
  const args = process.argv.slice(2);
  let reviewPointsArgs: string[] = [];

  // コマンドライン引数の処理
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--path" && i + 1 < args.length) {
      repoPath = args[i + 1];
      i++; // 次の引数をスキップ
    } else if (args[i] === "--ignore" && i + 1 < args.length) {
      ignoreFilePath = args[i + 1];
      i++; // 次の引数をスキップ
    } else if (args[i] === "--context" && i + 1 < args.length) {
      contextFilePath = args[i + 1];
      i++; // 次の引数をスキップ
    } else {
      reviewPointsArgs.push(args[i]);
    }
  }

  if (reviewPointsArgs.length === 0) {
    console.error("レビュー観点を指定してください。");
    return;
  }

  // コンテキストファイルの読み込み
  let contextContent = "";
  if (contextFilePath) {
    try {
      contextContent = fs.readFileSync(contextFilePath, "utf-8");
    } catch (error) {
      console.error(`コンテキストファイルを読み込めませんでした: ${contextFilePath}`);
      console.error(error);
      return;
    }
  }

  if (process.env.OPENAI_API_KEY === undefined) {
    console.error("環境変数 OPENAI_API_KEY が設定されていません。");
    return;
  }

  const reviewPoints = reviewPointsArgs
    .map((arg, index) => `${index + 1}. ${arg}`)
    .join("\n");

  // basePromptの構築
  let basePrompt = `指定された観点でのみコードをレビューし、指摘事項がある場合は日本語で報告してください。懸念がない場合は何も応答しないでください。\n`;

  basePrompt += `\n今回レビューしてもらいたい観点は以下です。\n${reviewPoints}`;

  if (contextContent) {
    basePrompt += `\n以下は追加のコンテキストです。レビュー時に考慮してください:\n${contextContent}\n`;
  }

  // リポジトリの内容を取得
  const repositoryContents = await getRepositoryContents(repoPath, ignoreFilePath);

  // OpenAI APIの設定
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
  });

  // Function Callingの定義
  const functions = [
    {
      name: "report_review_issues",
      description: "レビュー内容で指摘がある場合に、その詳細を報告します。",
      parameters: {
        type: "object",
        properties: {
          files: {
            type: "array",
            items: {
              type: "object",
              properties: {
                file_path: {
                  type: "string",
                  description: "指摘のあるファイルのパス。",
                },
                issues: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "指摘箇所の行数とその内容のリスト。`ファイルの該当箇所の行番号: 該当コード\n違反内容` の形式で記述してください。",
                },
              },
              required: ["file_path", "issues"],
            },
          },
        },
        required: ["files"],
      },
    },
  ];

  // モデルのトークン制限に応じて最大トークン数を設定
  const maxTokens = 128000 // モデルに応じて調整してください
  const maxPromptTokens = maxTokens * 0.7; // 応答のために余裕を残す

  // バッチ処理の準備
  let batches: FileContent[][] = [];
  let currentBatch: FileContent[] = [];
  let currentTokens = encode(basePrompt).length;

  for (const file of repositoryContents) {
    const fileContent = `\n\nファイルパス: ${file.filePath}\n\nコード:\n${file.content}`;
    const fileTokens = encode(fileContent).length;

    if (currentTokens + fileTokens > maxPromptTokens) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokens = encode(basePrompt).length;
    }

    currentBatch.push(file);
    currentTokens += fileTokens;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  for (const batch of batches) {
    // 複数のファイルを含むプロンプトを作成
    let prompt = `${basePrompt}`;
    for (const file of batch) {
      prompt += `\n\nファイルパス: ${file.filePath}\n\nコード:\n${file.content}`;
    }

    try {
      console.log("レビュー中...");
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        functions: functions,
        function_call: "auto",
      });

      const message = response.choices[0]?.message;

      if (message && message.function_call) {
        // Function Callingを処理
        if (message.function_call.name === "report_review_issues") {
          const functionArgs = JSON.parse(message.function_call.arguments || "{}");

          if (!functionArgs.files) {
            console.log("----");
            console.log("指摘事項はありません。");
            continue;
          }

          for (const fileReport of functionArgs.files) {
            console.log("----");
            console.log(`ファイルパス: ${fileReport.file_path}`);
            console.log("指摘内容:");
            for (const issue of fileReport.issues) {
              console.log(`- ${issue}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error processing batch:`, error);
    }
  }
}

main();
