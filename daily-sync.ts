function sendEventyNotifyById(id: string, timeDiff: string) {
  const e = CALENDAR.getEventById(id);
  if (e === null) {
    console.error("cannot find id", id, "from id4s");
    return;
  }
  const [start, end] = [e.getStartTime(), e.getEndTime()].map((date) =>
    format("yyyy/MM/dd HH:mm", date)
  );
  const content = `\
【リマインド通知】イベント${timeDiff}前通知
--------------------
タイトル：${e.getTitle()}
開始日時：${start} ～ ${end}
${e.getDescription()}
--------------------`;
  send(content);
}

function notify4hour() {
  const ID_QUEUE = scriptProp.getProperty("ID_QUEUE_4HOUR") ?? "";
  // キューに入れたイベントの先頭一つを取得
  const ids = ID_QUEUE.split(",");
  // キューの先頭を削除
  const id = ids.shift();
  if (id === undefined) {
    console.error("cannot pop: ID_QUEUE_4HOUR was empty");
    return;
  }
  sendEventyNotifyById(id, "4時間");
  scriptProp.setProperty("ID_QUEUE_4HOUR", ids.join(","));
}

function notify30min() {
  const ID_QUEUE = scriptProp.getProperty("ID_QUEUE_30MIN") ?? "";
  // キューに入れたイベントの先頭一つを取得
  const ids = ID_QUEUE.split(",");
  // キューの先頭を削除
  const id = ids.shift();
  if (id === undefined) {
    console.error("cannot pop: ID_QUEUE_30MIN was empty");
    return;
  }
  sendEventyNotifyById(id, "30分");
  scriptProp.setProperty("ID_QUEUE_30MIN", ids.join(","));
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
      ["notify4hour", "notify30min"].includes(trigger.getHandlerFunction())
    )
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  // 2 日分のイベントを取得
  const now = new Date();
  const after48hours = new Date();
  after48hours.setDate(now.getDate() + 2);
  const events = CALENDAR.getEvents(now, after48hours);
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
    setNewTriggerAt(notifyAt, "notify4hour");
  });
  // 4時間前キュー設定
  const ID_QUEUE_4HOUR = targetEvents.map((e) => e.getId()).join(",");
  scriptProp.setProperty("ID_QUEUE_4HOUR", ID_QUEUE_4HOUR);

  // 30分前通知トリガー設定
  targetEvents.forEach((e) => {
    const MINUTES = 60 * 1000;
    const timeDiffInMS = 30 * MINUTES;
    const startInMs = e.getStartTime().getTime();
    const notifyAt = new Date(startInMs - timeDiffInMS);
    setNewTriggerAt(notifyAt, "noitfy30min");
  });
  // 30分前キュー設定
  const ID_QUEUE_30MIN = targetEvents.map((e) => e.getId()).join(",");
  scriptProp.setProperty("ID_QUEUE_30MIN", ID_QUEUE_30MIN);
}

// 各カレンダーの `nextSyncToken` をセット
// これを実行したあとの差分が通知される
function setNextSyncTokens() {
  const nextSyncToken = Calendar.Events?.list(CALENDAR_ID, {
    maxResults: 65536,
    showDeleted: true,
  }).nextSyncToken;
  if (nextSyncToken) {
    scriptProp.setProperty("SYNC_TOKEN", nextSyncToken);
  }
}

// カレンダーの変更通知
// カレンダー変更時にその都度呼び出される
function sync(e: GoogleAppsScript.Events.CalendarEventUpdated) {
  if (e.calendarId != CALENDAR_ID) {
    return;
  }
  const syncToken = scriptProp.getProperty("SYNC_TOKEN");
  const events = Calendar.Events?.list(CALENDAR_ID, {
    syncToken: syncToken,
    maxResults: 65536,
    showDeleted: true,
  });
  if (events === undefined) {
    console.error("cannot get events of calendarId:", CALENDAR_ID);
    return;
  }
  const nextSyncToken = events.nextSyncToken;
  if (nextSyncToken) {
    scriptProp.setProperty("SYNC_TOKEN", nextSyncToken);
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
    const e = CALENDAR.getEventById(item.id ?? "");
    if (e === null) {
      console.warn("cannot get event by id:", item.id);
      continue;
    }

    const [start, end] = [e.getStartTime(), e.getEndTime()].map((date) =>
      format("yyyy/MM/dd HH:mm", date)
    );
    const content = `\
【${status}】
--------------------
タイトル：${e.getTitle()}
開始日時：${start} ～ ${end}
${e.getDescription()}
--------------------
`;
    send(content);
  }

  // トリガーを更新
  updateTriggers();
}
