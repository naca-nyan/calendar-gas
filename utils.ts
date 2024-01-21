// https://github.com/naca-nyan/calendar-gas

const scriptProp = PropertiesService.getScriptProperties();
const CALENDAR_ID = scriptProp.getProperty("CALENDAR_ID") ?? "";
const WEBHOOK_URL = scriptProp.getProperty("WEBHOOK_URL") ?? "";

function send(payload: any) {
  const response = UrlFetchApp.fetch(WEBHOOK_URL, {
    contentType: "application/json",
    method: "post",
    payload: JSON.stringify(payload),
    muteHttpExceptions: false,
  });
  console.log("send:", response.getResponseCode(), JSON.stringify(payload));
}

function format(format_string: string, date: GoogleAppsScript.Base.Date) {
  return Utilities.formatDate(date, "JST", format_string);
}

function dayOfWeek(date: Date) {
  const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"];
  return daysOfWeek[date.getDay()];
}
