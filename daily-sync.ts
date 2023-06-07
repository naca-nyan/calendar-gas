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

動作
main()が一括通知
trg()が個別通知

daily()が走ると当日分のmain()とtrg()が所定の時間に走るようにトリガーが設定される
当日分以外のmain()とtrg()のトリガーは削除される

カレンダーを変更するとsync()が走り前回の情報取得からの差分をAPIに取りに行きそれを整形して送信する

*/

const message = `\
本通知は天ひまリマインダー GAS ver システム管理者より配信しております。
（以下本文）

平素は格別のご高配を賜り厚く御礼申し上げます。また、本サービスをご利用頂きまして誠にありがとうございます。

本通知システムは大幅な改修に伴い、現在試験運用を実施しております。
試験期間は1か月間を予定しており、その後本運用移行を実施予定でございます。
期間中も本サービスをご利用頂けますが、本運用移行の際、以下の点が変更となります。
・bot名が変更
現：「天ひまリマインダー GAS ver」 →　新：「天ひまリマインダー」
・時間表記の変更
現：予定開始時刻からの差分生データ　→　新：4時間及び30分前通知の表記を固定文

何卒ご理解賜りますようお願い申し上げるともに、試験運用中は通知ミス等が発生する恐れがありますため、
利用者様間での連携を密にご対応頂きますよう重ねてお願い申し上げます。
ご迷惑をおかけいたしますが、ご理解とご協力のほど何卒宜しくお願いいたします。

（以上）
`;

const allOwnedCalendars = CalendarApp.getAllOwnedCalendars();

const getEventInfo = (
  event: GoogleAppsScript.Calendar.CalendarEvent,
  cal = CalendarApp.getCalendarById(event.getOriginalCalendarId())
) => ({
  name: cal.getName(),
  title: event.getTitle(),
  desc: event.getDescription(),
  isAD: event.isAllDayEvent(),
  time: event.isAllDayEvent()
    ? [
        event.getAllDayStartDate(),
        new Date(event.getAllDayEndDate().getTime() - 1),
      ]
    : [event.getStartTime(), event.getEndTime()],
  id: event.getId(),
});

// idからイベント取得
const getEventInfoById = (id: string) => {
  for (const cal of allOwnedCalendars) {
    const e = cal.getEventById(id);
    if (e) {
      return getEventInfo(e, cal);
    }
  }
  return null;
};

function send(content = "こゃ") {
  const payload = {
    username: "天ひまリマインダー",
    content,
  };
  UrlFetchApp.fetch(WEBHOOK_URL, {
    contentType: "application/json",
    method: "post",
    payload: JSON.stringify(payload),
    muteHttpExceptions: false,
  });
}

function sendEventyNotifyById(id: string, timeDiff: string) {
  const e = getEventInfoById(id);
  if (e === null) {
    console.error("cannot find id", id, "from id4s");
    return;
  }
  const [start, end] = e.time.map((date) =>
    // toLocaleString の型定義が間違っていそう
    // 普通の Date 型にキャストすれば動く
    // @ts-ignore
    date.toLocaleString("ja-JP")
  );
  const content = `\
【リマインド通知】イベント${timeDiff}前通知
--------------------
タイトル：${e.getTitle()}
開始日時：${start} ～ ${end}
${e.desc}
--------------------`;
  send(content);
}

function trg4h() {
  const id4sRaw = scriptProp.getProperty("id4s") ?? "";
  // キューに入れたイベントの先頭一つを取得
  const id4s = id4sRaw.split(",");
  // キューの先頭を削除
  const id = id4s.shift();
  if (id === undefined) {
    console.error("cannot pop: id4s was empty");
    return;
  }
  sendEventyNotifyById(id, "4時間");
  scriptProp.setProperty("id4s", id4s.join(","));
}

function trg() {
  // N分前個別通知//←trg4h解析して追加実行
  const idsRaw = scriptProp.getProperty("ids") ?? "";
  // キューに入れたイベントの先頭一つを取得
  const ids = idsRaw.split(",");
  // キューの先頭を削除
  const id = ids.shift();
  if (id === undefined) {
    console.error("cannot pop: ids was empty");
    return;
  }
  sendEventyNotifyById(id, "30分");
  scriptProp.setProperty("ids", ids.join(","));
}

// 毎日起動される
function daily() {
  updateTriggers();
}

// トリガーとキューの更新
function updateTriggers() {
  // 過去のトリガーを削除
  ScriptApp.getProjectTriggers()
    .filter((trigger) =>
      ["trg4h", "trg"].includes(trigger.getHandlerFunction())
    )
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  // 3 日分のイベントを取得
  const now = new Date();
  const after48hours = new Date();
  after48hours.setDate(now.getDate() + 2);
  const events = allOwnedCalendars.flatMap((cal) =>
    cal.getEvents(now, after48hours)
  );
  const targetEvents = events
    // 終日イベント or 過去イベントは除外
    .filter((e) => !(e.isAllDayEvent() || e.getStartTime() < now))
    // 開始時間でソート
    .sort(
      (e1, e2) => e1.getStartTime().getTime() - e2.getStartTime().getTime()
    );

  const setNewTriggerAt = (date, funcName) =>
    ScriptApp.newTrigger(funcName).timeBased().at(date).create();

  // 4時間前通知トリガー設定
  targetEvents.forEach((e) => {
    const HOUR = 60 * 60 * 1000;
    const timeDiffInMS = 4 * HOUR;
    const startInMs = e.getStartTime().getTime();
    const notifyAt = new Date(startInMs - timeDiffInMS);
    setNewTriggerAt(notifyAt, "trg4h");
  });
  // 4時間前キュー設定
  const id4sRaw = targetEvents.map((e) => e.getId()).join(",");
  scriptProp.setProperty("id4s", id4sRaw);

  // 30分前通知トリガー設定
  targetEvents.forEach((e) => {
    const MINUTES = 60 * 1000;
    const timeDiffInMS = 30 * MINUTES;
    const startInMs = e.getStartTime().getTime();
    const notifyAt = new Date(startInMs - timeDiffInMS);
    setNewTriggerAt(notifyAt, "trg");
  });
  // 30分前キュー設定
  const idsRaw = targetEvents.map((e) => e.getId()).join(",");
  scriptProp.setProperty("ids", idsRaw);
}

// 各カレンダーの `nextSyncToken` をセット
// これを実行したあとの差分が通知される
function setNextSyncTokens() {
  allOwnedCalendars.forEach((cal) => {
    const id = cal.getId();
    const nextSyncToken = Calendar.Events?.list(id, {
      maxResults: 65536,
      showDeleted: true,
    }).nextSyncToken;
    if (nextSyncToken) {
      scriptProp.setProperty(`nst_${id}`, nextSyncToken);
    }
  });
}

// カレンダーの変更通知
// カレンダー変更時にその都度呼び出される
function sync(e?: GoogleAppsScript.Events.CalendarEventUpdated) {
  // テストで呼び出す用に undefined の時はデフォルト ID をセット
  const calendarId = e ? e.calendarId : CALENDAR_ID;
  const syncToken = scriptProp.getProperty(`nst_${calendarId}`);
  const events = Calendar.Events?.list(calendarId, {
    syncToken: syncToken,
    maxResults: 65536,
    showDeleted: true,
  });
  if (events === undefined) {
    console.error("cannot get events of calendarId:", calendarId);
    return;
  }
  const nextSyncToken = events.nextSyncToken;
  if (nextSyncToken) {
    scriptProp.setProperty(`nst_${calendarId}`, nextSyncToken);
  }

  const items = events.items ?? [];
  for (const item of items) {
    const isFirstCreated = (item: GoogleAppsScript.Calendar.Schema.Event) => {
      const updated = item.updated ?? "";
      const created = item.created ?? "";
      const SECONDS = 1000;
      return Date.parse(updated) - Date.parse(created) < 5 * SECONDS;
    };

    let status = "不明";
    if (item.status == "cancelled") {
      status = "予定削除";
    } else if (item.status == "tentative") {
      status = "暫定";
    } else if (isFirstCreated(item)) {
      status = "予定追加";
    } else {
      status = "予定変更";
    }
    const eventInfo = getEventInfoById(item.id ?? "");
    if (eventInfo === null) {
      console.warn("cannot get event by id:", item.id);
      continue;
    }

    const [start, end] = eventInfo.time.map((date) =>
      // toLocaleString の型定義が間違っていそう
      // 普通の Date 型にキャストすれば動く
      // @ts-ignore
      date.toLocaleString("ja-JP")
    );
    const content = `\
【${status}】
--------------------
タイトル：${eventInfo.title}
開始日時：${start} ～ ${end}
${eventInfo.desc}
--------------------
`;
    send(content);
  }

  // トリガーを更新
  updateTriggers();
}
