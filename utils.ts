const scriptProp = PropertiesService.getScriptProperties();
const CALENDAR_ID = scriptProp.getProperty("CALENDAR_ID") ?? "";
const WEBHOOK_URL = scriptProp.getProperty("WEBHOOK_URL") ?? "";
const CALENDAR = CalendarApp.getCalendarById(CALENDAR_ID);

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

function format(format_string, date) {
  return Utilities.formatDate(date, "JST", format_string);
}

function dayOfWeek(date) {
  const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"];
  return daysOfWeek[date.getDay()];
}
