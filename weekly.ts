// https://github.com/naca-nyan/calendar-gas

// 週間予定通知
// トリガーによって毎週日曜日に呼び出される
function notifyWeekly() {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  const calendarId = calendar.getId();
  if (!calendarId) {
    console.error("cannot get calendar id");
    return;
  }

  const dates = Array.from(Array(7).keys(), (i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1); // 次の日からなので + 1
    return date;
  });

  const datesWithEvents = dates.map((date) => {
    const dow = dayOfWeek(date);
    const dateFormat = format("MM/dd", date) + ` (${dow})`;
    const events = calendar.getEventsForDay(date);
    const eventsFormat = events.map((e) => {
      const title = e.getTitle();
      const [start, end] = [e.getStartTime(), e.getEndTime()].map((date) =>
        format("HH:mm", date)
      );
      return `${start}-${end} ${title}`;
    });
    return { date: dateFormat, events: eventsFormat };
  });

  // prettier-ignore
  const message = `\
来週の天ひま！の予定一覧はこちら↓
※毎週日曜日に、週間予定をお知らせしています！

` + 
datesWithEvents.map(({ date, events }) =>
  `★ ${date}\n` +
  (events.length ?
    events.join(`\n`)
  : `予定はありません`)
).join("\n\n");

  send(message);
}
