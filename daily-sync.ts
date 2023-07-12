// https://github.com/naca-nyan/calendar-gas

function sendEventyNotifyById(id: string, message: string) {
  const e = CALENDAR.getEventById(id);
  if (e === null) {
    console.error("cannot find id", id);
    return;
  }
  const [start, end] = [e.getStartTime(), e.getEndTime()].map((date) =>
    format("yyyy/MM/dd HH:mm", date)
  );
  const descriptions = [`開始日時：${start} ～ ${end}`, e.getDescription()];
  const embed = {
    title: e.getTitle(),
    description: descriptions.join("\n"),
    fields: [{ name: message, value: "" }],
  };
  const mentions = Array.from(
    e.getDescription().matchAll(/<@.+?>/g),
    (match) => match[0],
  );
  send({ content: mentions.join(" "), embeds: [embed] });
}

function notify240min() {
  const ID_QUEUE = scriptProp.getProperty("ID_QUEUE_240MIN") ?? "";
  // キューに入れたイベントの先頭一つを取得
  const ids = ID_QUEUE.split(",");
  // キューの先頭を削除
  const id = ids.shift();
  if (!id) {
    console.error("cannot pop: ID_QUEUE_240MIN was empty");
    return;
  }
  sendEventyNotifyById(id, ":tea: イベント4時間前通知");
  scriptProp.setProperty("ID_QUEUE_240MIN", ids.join(","));
}

function notify30min() {
  const ID_QUEUE = scriptProp.getProperty("ID_QUEUE_30MIN") ?? "";
  // キューに入れたイベントの先頭一つを取得
  const ids = ID_QUEUE.split(",");
  // キューの先頭を削除
  const id = ids.shift();
  if (!id) {
    console.error("cannot pop: ID_QUEUE_30MIN was empty");
    return;
  }
  sendEventyNotifyById(id, ":alarm_clock: イベント30分前通知");
  scriptProp.setProperty("ID_QUEUE_30MIN", ids.join(","));
}

// 毎日起動される
function daily() {
  updateTriggers();
}

// トリガーとキューの更新
function updateTriggers() {
  // トリガーを削除してから登録する間、排他制御を行う
  const lock = LockService.getScriptLock();
  // 30 秒待っても Lock が取れなかったら例外を吐く
  lock.waitLock(30 * 1000);

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

  lock.releaseLock();
}

function setEventsTrigger(
  beforeMin: number,
  triggerFuncName: string,
  queueName: string,
  events: GoogleAppsScript.Calendar.CalendarEvent[],
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
  // 対象のカレンダー変更でなければ無視する
  if (e.calendarId != CALENDAR_ID) {
    return;
  }

  // syncToken を使って差分を取得
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
  // 差分があったイベントをすべて通知
  for (const item of items) {
    const id = item.id;
    if (!id) {
      console.warn("invalid item.id");
      continue;
    }

    const updatedAt = Date.parse(item.updated ?? "");
    const createdAt = Date.parse(item.created ?? "");
    const SECOND = 1000; // ms;
    // 5 秒以上経っているものは変更とみなす
    const isUpdated = updatedAt - createdAt > 5 * SECOND;

    const message = (status?: string) => {
      switch (status) {
        case "confirmed":
          return isUpdated
            ? ":arrow_right_hook: 予定変更"
            : ":sparkles: 予定追加";
        case "cancelled":
          return ":wastebasket: 予定削除";
        case "tentative":
          return ":hourglass_flowing_sand: 暫定";
        default:
          return ":question: 不明";
      }
    };
    sendEventyNotifyById(id, message(item.status));
  }

  // トリガーを更新
  updateTriggers();
}
