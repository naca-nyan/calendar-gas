//ver1.0
//リファレンス
// https://developers.google.com/apps-script/reference/calendar/calendar
//

const CALENDAR_ID = "カレンダーID"; //カレンダーID
const WEBHOOK_URL = "ウェブフックのURL"; //ウェブフックのURL
var weekday = ["日", "月", "火", "水", "木", "金", "土"];

function notifyWeekly() {
  //週間予定通知

  var dt = new Date();
  var message =
    "来週の天ひま！の予定一覧はこちら↓\n※毎週日曜日に、週間予定をお知らせしています！\n\n";

  //1LP1日分
  for (var i = 0; i < 7; i++) {
    dt.setDate(dt.getDate() + 1); //実行日基準で1週間1日ずつセット→JST sun 0：00=UTC sat 15:00だから?
    message +=
      Utilities.formatDate(dt, "JST", "★ MM/dd(" + weekday[dt.getDay()] + ")") +
      "\n"; //日付行
    let dayText = ""; //予定時刻クリア
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID); //カレンダーセット
    const events = calendar.getEventsForDay(dt); //取得日の予定

    const calendarName = calendar.getId(); //カレンダー読み取り
    if (calendarName == undefined) {
      //カレンダー全体の予定有無判定
      message += "予定はありません\n\n";
      continue; //LP飛ばす
    }

    //const events = calendar.getEventsForDay(dt);//取得日の予定//←重複排除
    if (events.length == 0) {
      //取得日の予定有無判定
      message += "予定はありません\n\n";
      continue; //LP飛ばす
    }

    for (let j = 0; j < events.length; j++) {
      //取得日の予定全LP
      dayText += String(
        Utilities.formatDate(events[j].getStartTime(), "JST", "HH:mm")
      ); //予定開始時刻
      dayText += "-";
      dayText += String(
        Utilities.formatDate(events[j].getEndTime(), "JST", "HH:mm")
      ); //予定終了時刻
      dayText += " ";
      dayText += String(events[j].getTitle() + "\n"); //予定名
    }

    dayText += "\n";
    message += dayText;
  }

  //JSON用プレフィックス追加
  const payload = {
    username: `天ひまリマインダー`,
    content: message,
  };

  //JSON梱包&発送
  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
  });
}
