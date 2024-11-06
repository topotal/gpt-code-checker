# gpt-code-checker

これは ChatGPT にざっとコードをレビューしてもらうためのツールです。

## 使い方

環境変数にOpenAIのAPI KEYを設定してください
```
OPENAI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

このリポジトリを Clone してたら以下のようにコマンド実行すると、指定したレビュー観点でレビュをしてくれます

```bash
npx ts-node main.ts --path ~/xxxxxx --ignore ./.gptignore "セキュリティ上の懸念を指摘してください"

Prompt: 以下のコードをレビューし、指摘事項がある場合は日本語で報告してください。懸念がない場合は何も応答しないでください。
今回レビューしてもらいたい観点は以下です。
1. セキュリティ上の懸念を指摘してください
Processing batch...
----
ファイルパス: getRepositoryContents.ts
指摘内容:
- 外部ライブラリ（minimatch）を使用していますが、悪意のあるパターンが引数として渡されると、意図せずファイルが無視される可能性があります。この種のライブラリを使用する際は、入力の検証を厳格に行い、正規表現の悪用による攻撃を避けるチェックを行うことが推奨されます。
```

## 引数とオプション
- args: レビュー観点を文字列で渡します。
    - 例: npx ts-node main.ts "セキュリティ懸念のある箇所がないか" "コーディング規約違反はないか"
- options
    - `--path`: レビューをしたいファイルのあるディレクトリを指定します。無い場合は `./` になります
    - `--context`: コンテキストとして渡しておきたい文章を書いたファイルを指定します
        - 例: .gptcontext
            ```
            弊社のコーディング規約として〇〇Serviceというクラスは作成できません。
            ```
    - `--ignore`: レビューを避けたいファイルを一覧したファイルの場所を指定します。ファイルの書き方は.gitignore と同じです
        - 例: .gptignore
            ```
            node_modules
            yarn.lock
            dist
            .gptignore
            output.txt
            ```
