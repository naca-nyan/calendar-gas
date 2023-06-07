// ver1.0
// リファレンス
// - https://developers.google.com/apps-script/reference/calendar/calendar
//

const scriptProp = PropertiesService.getScriptProperties();
const CALENDAR_ID = scriptProp.getProperty("CALENDAR_ID") ?? "";
const WEBHOOK_URL = scriptProp.getProperty("WEBHOOK_URL") ?? "";

// 週間予定通知
// トリガーによって毎週日曜日に呼び出される
function notifyWeekly() {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  const calendarId = calendar.getId();
  if (!calendarId) {
    console.error("cannot get calendar id");
    return;
  }

  const format = (date, format_string) =>
    Utilities.formatDate(date, "JST", format_string);
  const dayOfWeek = (date) => {
    const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"];
    return daysOfWeek[date.getDay()];
  };

  let message = `\
来週の天ひま！の予定一覧はこちら↓
※毎週日曜日に、週間予定をお知らせしています！

`;

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i + 1); // 次の日からなので + 1

    message += `\
★ ${format(date, "MM/dd")}(${dayOfWeek(date)})
`;

    const events = calendar.getEventsForDay(date);
    let dayText = "";
    if (events.length == 0) {
      dayText = "予定はありません";
    } else {
      for (const e of events) {
        const start = format(e.getStartTime(), "HH:mm");
        const end = format(e.getEndTime(), "HH:mm");
        const title = e.getTitle();
        dayText += `${start}-${end} ${title}`;
      }
    }
    message += dayText + "\n\n";
  }

  const payload = {
    username: "天ひまリマインダー",
    content: message,
  };

  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
  });
}
