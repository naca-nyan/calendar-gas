# calendar-gas

## 必要環境

- [git]
- [npm]

[git]: https://git-scm.com/
[npm]: https://nodejs.org/ja/download

Windows ユーザは [Scoop] からインストールすることをおすすめします。 PowerShell
から以下を実行してください。

[Scoop]: https://scoop.sh/

Scoop のインストール:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
```

Git のインストール:

```powershell
scoop install git
```

npm (nodejs) のインストール

```powershell
scoop install nvm
nvm install 20.2.0
nvm use 20.2.0
```

## リポジトリの clone とセットアップ

```powershell
git clone "https://github.com/naca-nyan/calendar-gas.git"
cd calendar-gas
npm install
```

## アップロードの仕方

Google Apps Script に [clasp] 経由でログインする必要があります。
一度実行すればそのあとはスキップして大丈夫です。

[clasp]: https://github.com/google/clasp

```powershell
npm run clasp login
```

プロジェクトの ID を `.clasp.json` に設定してください。

```powershell
cp .clasp.json.example .clasp.json
# edit .clasp.json
```

フォーマットして push できます。

```powershell
npm run fmt
npm run clasp push
```
