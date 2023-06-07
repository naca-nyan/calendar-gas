const
t=new Date(),//実行時刻
prop=PropertiesService.getScriptProperties(),//ストレージアクセス
cals=CalendarApp.getAllOwnedCalendars(),//カレンダー
cfg={
  locale:'ja-JP',//時刻表示形式
  main:'07:00',//一括通知の時刻
  trg:30,//N分前の個別通知
  webhooks:[//メッセージを送信するwebhook url 複数可
    'https://discord.com/api/webhooks/00000000/xxxxxxxx'
  ],
  opt:{maxResults:65536,showDeleted:true},//変更非推奨 カレンダー参照設定
  col:[//変更非推奨 イベント色パレット
    null,'#a4bdfc','#7AE7BF','#BDADFF','#FF887C','#FBD75B',
    '#FFB878','#46D6DB','#E1E1E1','#5484ED','#51B749','#DC2127'
  ]
},

fmt=(y,x=CalendarApp.getCalendarById(y.getOriginalCalendarId()))=>({
  //使いやすいようフォーマット
  name:x.getName(),
  title:y.getTitle(),
  color:cfg.col[y.getColor()]||x.getColor(),
  desc:y.getDescription(),
  isAD:y.isAllDayEvent(),
  time:y.isAllDayEvent()?[y.getAllDayStartDate(),new Date(y.getAllDayEndDate().getTime()-1)]:[y.getStartTime(),y.getEndTime()],
  id:y.getId()
}),
today=()=>cals.flatMap(x=>x.getEventsForDay(t).map(y=>fmt(y,x))),//カレンダーからイベント取得
eid=id=>cals.flatMap((x,y)=>(y=x.getEventById(id),y?[fmt(y,x)]:[]))[0],//idからイベント取得

widget=x=>({//discord embed形式
  color:parseInt(x.color.slice(1),16),//10進変換
  title:x.title,
  description:(x.desc?x.desc+'\n':'')+
    [...new Set(x.isAD? //Setで重複解除
      x.time.map(x=>x.toLocaleDateString(cfg.locale)):
      x.time.map(x=>x.toLocaleString(cfg.locale)))
    ].join(' ~ '),
  footer:{text:x.name}
}),

send=(x={username:'McbeEringi',avatar_url:'https://mcbeeringi.github.io/img/icon.png',content:'ﾆｬﾝ'})=> //webhook送信
  cfg.webhooks.forEach(y=>UrlFetchApp.fetch(y,{contentType:'application/json',method:'post',payload:JSON.stringify(x),muteHttpExceptions:false})),

main=()=>send({//一括通知
  username:'Google Calendar',
  avatar_url:'https://mcbeeringi.github.io/img/icon.png',
  content:'今日のイベント',
  embeds:today().map(widget)
}),
trg=()=>{//N分前個別通知
  const arr=prop.getProperty('ids').split(','),
    e=eid(arr[0]);//キューに入れたイベントの先頭一つを取得
  send({//usernameとcontentは通知に表示される
    username:`${Math.round((e.time[0].getTime()-t.getTime())/6e4)}分間待ってやる`,//イベントまでの分数を算出
    avatar_url:'https://mcbeeringi.github.io/img/icon.png',
    content:`${e.title} @${e.time[0].toLocaleString(cfg.locale)}`,
    embeds:[widget(e)]
  });
  prop.setProperty('ids',arr.slice(1).join(','));//キューの先頭を削除
},
daily=()=>{//mainとtrgの更新 毎日起動
  ScriptApp.getProjectTriggers().forEach(x=>'main,trg'.includes(x.getHandlerFunction())&&ScriptApp.deleteTrigger(x));//過去のトリガーを削除
  const set=(x,y)=>ScriptApp.newTrigger(y).timeBased().at(x).create();
  
  {//main
    const t1=new Date(t.toDateString()+' '+cfg.main);
    t1.getTime()>t.getTime()&&set(t1,'main');
  }
  prop.setProperty(//trg
    'ids',
    today().flatMap(x=>{
      const t1=new Date(x.time[0]-cfg.trg*6e4);
      if(x.isAD||!(t1.getTime()>t.getTime()))return[];//終日イベントと過去イベントは除外
      set(t1,'trg');return[[t1.getTime(),x.id]];
    }).sort((a,b)=>Math.sign(a[0]-b[0])).map(x=>x[1]).join(',')//イベントの開始時刻順に並べてキューに入れる
  );
},

sync_init=()=>{//APIキー再取得　必要時に手動で起動
  cals.forEach(x=>{
    const id=x.getId();
    prop.setProperty(`nst_${id}`,Calendar.Events.list(id,cfg.opt).nextSyncToken);
  });
},
sync=(e={calendarID:'example.calendar@gmail.com'})=>{//カレンダーdiff取得 カレンダー変更時呼び出し
  const w=Calendar.Events.list(e.calendarId,{...cfg.opt,syncToken:prop.getProperty(`nst_${e.calendarId}`)});
  prop.setProperty(`nst_${e.calendarId}`,w.nextSyncToken);
  w.items.length&&send({
    username:'Google Calendar',
    avatar_url:'https://mcbeeringi.github.io/img/icon.png',
    content:`変更されたイベント`,
    embeds:w.items.map(x=>({...widget(eid(x.id)),fields:[
      {name:'操作',value:{confirmed:Date.parse(x.updated)-Date.parse(x.created)<5e3?'追加':'変更',tentative:'暫定',cancelled:'削除'}[x.status]}
    ]}))
  });
  daily();//trgの更新
};
