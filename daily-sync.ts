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

function notify240min() {
  const ID_QUEUE = scriptProp.getProperty("ID_QUEUE_240MIN") ?? "";
  // キューに入れたイベントの先頭一つを取得
  const ids = ID_QUEUE.split(",");
  // キューの先頭を削除
  const id = ids.shift();
  if (id === undefined) {
    console.error("cannot pop: ID_QUEUE_240MIN was empty");
    return;
  }
  sendEventyNotifyById(id, "4時間");
  scriptProp.setProperty("ID_QUEUE_240MIN", ids.join(","));
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
      ["notify240min", "notify30min"].includes(trigger.getHandlerFunction())
    )
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  // 2 日分のイベントを取得
  const now = new Date();
  const after48hours = new Date();
  after48hours.setDate(now.getDate() + 2);
  const events = CALENDAR.getEvents(now, after48hours);

  setEventsTrigger(240, "notify240min", "ID_QUEUE_240MIN", events);
  setEventsTrigger(30, "notify30min", "ID_QUEUE_30MIN", events);
}

function setEventsTrigger(
  beforeMin: number,
  triggerFuncName: string,
  queueName: string,
  events: GoogleAppsScript.Calendar.CalendarEvent[]
) {
  const now = new Date();
  const MINUTES = 60 * 1000;
  const timeDiffInMS = beforeMin * MINUTES;

  const targetEvents = events
    // 終日イベントは除外
    .filter((e) => !e.isAllDayEvent())
    // 開始時間でソート
    .sort((e1, e2) => e1.getStartTime().getTime() - e2.getStartTime().getTime())
    .map((e) => {
      const startInMs = e.getStartTime().getTime();
      const notifyAt = new Date(startInMs - timeDiffInMS);
      return { notifyAt, event: e };
    })
    // 通知時刻が現在より後のもののみ
    .filter(({ notifyAt }) => now < notifyAt);

  // 通知トリガー設定
  targetEvents.forEach(({ notifyAt, event }) => {
    ScriptApp.newTrigger(triggerFuncName).timeBased().at(notifyAt).create();
  });
  // キュー設定
  const ID_QUEUE = targetEvents.map(({ event }) => event.getId()).join(",");
  scriptProp.setProperty(queueName, ID_QUEUE);
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
