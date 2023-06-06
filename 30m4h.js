/*
ver1.1
リファレンス
https://developers.google.com/apps-script/reference/calendar/calendar
ベース
https://qiita.com/McbeEringi/items/8339006dd57ff06308ab
ベース2
https://webird-programming.tech/archives/948
アロー関数記述解説
https://hajiritsu.com/gas-use-arrow-functions/

※ベース1で記載され、現在使用してないコードあり。
　完全解読できてるわけではないから不具合防止のためそのまま。
　いつかは除去したい。


動作
main()が一括通知
trg()が個別通知

daily()が走ると当日分のmain()とtrg()が所定の時間に走るようにトリガーが設定される
当日分以外のmain()とtrg()のトリガーは削除される

カレンダーを変更するとsync()が走り前回の情報取得からの差分をAPIに取りに行きそれを整形して送信する


*/
/*
STX = "本通知は天ひまリマインダー GAS ver システム管理者より配信しております。\n（以下本文）\n\n"
STX = STX + "平素は格別のご高配を賜り厚く御礼申し上げます。また、本サービスをご利用頂きまして誠にありがとうございます。\n\n"
STX = STX + "本通知システムは大幅な改修に伴い、現在試験運用を実施しております。\n"
STX = STX + "試験期間は1か月間を予定しており、その後本運用移行を実施予定でございます。\n"
STX = STX + "期間中も本サービスをご利用頂けますが、本運用移行の際、以下の点が変更となります。\n"
STX = STX + "・bot名が変更\n現：「天ひまリマインダー GAS ver」 →　新：「天ひまリマインダー」\n"
STX = STX + "・時間表記の変更\n現：予定開始時刻からの差分生データ　→　新：4時間及び30分前通知の表記を固定文\n\n"
STX = STX + "何卒ご理解賜りますようお願い申し上げるともに、試験運用中は通知ミス等が発生する恐れがありますため、利用者様間での連携を密にご対応頂きますよう重ねてお願い申し上げます。\n"
STX = STX + "ご迷惑をおかけいたしますが、ご理解とご協力のほど何卒宜しくお願いいたします。\n\n（以上）\n"
*/

let nct = new Date(); //実行時刻
const t = new Date(), //実行時刻
  nt = new Date(nct.setDate(nct.getDate() + 2)), //48時間後
  prop = PropertiesService.getScriptProperties(), //ストレージアクセス
  cals = CalendarApp.getAllOwnedCalendars(), //カレンダー
  cfg = {
    locale: "ja-JP", //時刻表示形式
    main: "07:00", //一括通知の時刻
    trg: 30, //N分前の個別通知
    trg4h: 240, //N分前の個別通知
    webhooks: [
      //メッセージを送信するwebhook url 複数可
      "ウェブフックのURL",
    ],
    opt: { maxResults: 65536, showDeleted: true }, //変更非推奨 カレンダー参照設定
    col: [
      //変更非推奨 イベント色パレット
      null,
      "#a4bdfc",
      "#7AE7BF",
      "#BDADFF",
      "#FF887C",
      "#FBD75B",
      "#FFB878",
      "#46D6DB",
      "#E1E1E1",
      "#5484ED",
      "#51B749",
      "#DC2127",
    ],
  },
  fmt = (y, x = CalendarApp.getCalendarById(y.getOriginalCalendarId())) => ({
    //使いやすいようフォーマット
    name: x.getName(),
    title: y.getTitle(),
    color: cfg.col[y.getColor()] || x.getColor(),
    desc: y.getDescription(),
    isAD: y.isAllDayEvent(),
    time: y.isAllDayEvent()
      ? [y.getAllDayStartDate(), new Date(y.getAllDayEndDate().getTime() - 1)]
      : [y.getStartTime(), y.getEndTime()],
    id: y.getId(),
  }),
  //today=()=>cals.flatMap(x=>x.getEventsForDay(t).map(y=>fmt(y,x))),//カレンダーからイベント取得
  today = () => cals.flatMap((x) => x.getEvents(t, nt).map((y) => fmt(y, x))), //カレンダーから48時間分イベント取得
  eid = (id) =>
    cals.flatMap((x, y) => ((y = x.getEventById(id)), y ? [fmt(y, x)] : []))[0], //idからイベント取得
  widget = (x) => ({
    //discord embed形式
    color: parseInt(x.color.slice(1), 16), //10進変換
    title: x.title,
    description:
      (x.desc ? x.desc + "\n" : "") +
      [
        ...new Set(
          x.isAD //Setで重複解除
            ? x.time.map((x) => x.toLocaleDateString(cfg.locale))
            : x.time.map((x) => x.toLocaleString(cfg.locale))
        ),
      ].join(" ~ "),
    footer: { text: x.name },
  }),
  send = (
    x = { username: "天ひまリマインダー", content: "こゃ" } //webhook送信
  ) =>
    cfg.webhooks.forEach((y) =>
      UrlFetchApp.fetch(y, {
        contentType: "application/json",
        method: "post",
        payload: JSON.stringify(x),
        muteHttpExceptions: false,
      })
    ),
  //main=()=>TX = '',
  trg4h = () => {
    //N分前個別通知//←trg4h解析して追加実行
    const arr = prop.getProperty("id4s").split(","),
      e = eid(arr[0]); //キューに入れたイベントの先頭一つを取得
    TX = "";
    TX += "【リマインド通知】イベント4時間前通知\n";
    TX += "--------------------\n";
    TX += "タイトル：" + e.title + "\n";
    TX +=
      "開始日時:" +
      e.time[0].toLocaleString(cfg.locale) +
      " ～ " +
      e.time[1].toLocaleString(cfg.locale) +
      "\n";
    TX += "" + e.desc + "\n"; //参加予定者：
    TX += "--------------------\n";
    send({
      //usernameとcontentは通知に表示される
      username: `天ひまリマインダー`,
      content: TX,
    });
    prop.setProperty("id4s", arr.slice(1).join(",")); //キューの先頭を削除
  },
  trg = () => {
    //N分前個別通知//←trg4h解析して追加実行
    const arr = prop.getProperty("ids").split(","),
      e = eid(arr[0]); //キューに入れたイベントの先頭一つを取得
    TX = "";
    TX += "【リマインド通知】イベント30分前通知\n";
    TX += "--------------------\n";
    TX += "タイトル：" + e.title + "\n";
    TX +=
      "開始日時:" +
      e.time[0].toLocaleString(cfg.locale) +
      " ～ " +
      e.time[1].toLocaleString(cfg.locale) +
      "\n";
    TX += "" + e.desc + "\n"; //参加予定者：
    TX += "--------------------\n";
    send({
      //usernameとcontentは通知に表示される
      username: `天ひまリマインダー`,
      content: TX,
    });
    prop.setProperty("ids", arr.slice(1).join(",")); //キューの先頭を削除
  },
  daily = () => {
    //mainとtrgの更新 毎日起動
    ScriptApp.getProjectTriggers().forEach(
      (x) =>
        "trg4h,trg".includes(x.getHandlerFunction()) &&
        ScriptApp.deleteTrigger(x)
    ); //過去のトリガーを削除
    const set = (x, y) => ScriptApp.newTrigger(y).timeBased().at(x).create();

    // {//main
    //   const t1=new Date(t.toDateString()+' '+cfg.main);
    //   t1.getTime()>t.getTime()&&set(t1,'main');
    //  }
    prop.setProperty(
      //trg4h
      "id4s",
      today()
        .flatMap((x) => {
          const t1 = new Date(x.time[0] - cfg.trg4h * 6e4);
          if (x.isAD || !(t1.getTime() > t.getTime())) return []; //終日イベントと過去イベントは除外　　予定-4h>タスク実行時間ではない
          set(t1, "trg4h");
          return [[t1.getTime(), x.id]];
        })
        .sort((a, b) => Math.sign(a[0] - b[0]))
        .map((x) => x[1])
        .join(",") //イベントの開始時刻順に並べてキューに入れる
    ),
      prop.setProperty(
        //trg
        "ids",
        today()
          .flatMap((x) => {
            const t1 = new Date(x.time[0] - cfg.trg * 6e4);
            if (x.isAD || !(t1.getTime() > t.getTime())) return []; //終日イベントと過去イベントは除外
            set(t1, "trg");
            return [[t1.getTime(), x.id]];
          })
          .sort((a, b) => Math.sign(a[0] - b[0]))
          .map((x) => x[1])
          .join(",") //イベントの開始時刻順に並べてキューに入れる
      );
  },
  sync_init = () => {
    //APIキー再取得　必要時に手動で起動
    cals.forEach((x) => {
      const id = x.getId();
      prop.setProperty(
        `nst_${id}`,
        Calendar.Events.list(id, cfg.opt).nextSyncToken
      );
    });
  },
  sync = (e = { calendarID: "カレンダーID" }) => {
    //カレンダーdiff取得 カレンダー変更時呼び出し
    const w = Calendar.Events.list(e.calendarId, {
      ...cfg.opt,
      syncToken: prop.getProperty(`nst_${e.calendarId}`),
    });
    prop.setProperty(`nst_${e.calendarId}`, w.nextSyncToken);

    for (let i = 0; i < w.items.length; i++) {
      TX = "";
      const ex = w.items[i];
      const ext = eid(ex.id);
      if (ex.status == "cancelled") {
        TX += "【予定削除】\n";
      } else if (ex.status == "tentative") {
        TX += "【暫定】\n";
      } else if (Date.parse(ex.updated) - Date.parse(ex.created) < 5e3) {
        TX += "【予定追加】\n";
      } else {
        TX += "【予定変更】\n";
      }

      TX += "--------------------\n";
      TX += "タイトル：" + ext.title + "\n";
      TX +=
        "開始日時：" +
        ext.time[0].toLocaleString(cfg.locale) +
        " ～ " +
        ext.time[1].toLocaleString(cfg.locale) +
        "\n";
      TX += "" + ext.desc + "\n"; //参加予定者：
      TX += "--------------------\n";

      send({
        //usernameとcontentは通知に表示される
        username: `天ひまリマインダー`,
        content: TX,
      });
    }

    daily(); //trgの更新
  };
