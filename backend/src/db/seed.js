import bcrypt from 'bcryptjs';
import { db, initDb, syncPriceMeta, ensureLicenses } from './database.js';

initDb();
const count = db.prepare('SELECT COUNT(*) c FROM users').get().c;

if (!count) {
  const pw = bcrypt.hashSync('Jelszo123!', 10);
  const ins = db.prepare('INSERT INTO users(name,email,password,role,phone,membership_date,status) VALUES (?,?,?,?,?,?,?)');
  const users = [
    ['Szabó Gábor','gabor@project.hu','admin','+36 30 111 2233','2011-03-14','Aktív'],
    ['Horváth László','laszlo@project.hu','vador','+36 20 222 3344','2014-09-01','Aktív'],
    ['Kovács Péter','peter@project.hu','vadasz','+36 30 333 4455','2018-05-20','Aktív'],
    ['Nagy Bence','bence@project.hu','vadasz','+36 70 444 5566','2019-02-11','Aktív'],
    ['Tóth Márk','mark@project.hu','vadasz','+36 30 555 6677','2020-10-03','Aktív'],
    ['Varga Eszter','eszter@project.hu','vadasz','+36 20 666 7788','2021-06-18','Aktív'],
    ['Kiss Dániel','daniel@project.hu','vadasz','+36 70 777 8899','2016-01-25','Inaktív'],
    ['Farkas Anna','anna@project.hu','vadasz','+36 30 888 9900','2023-04-09','Aktív']
  ];
  for (const u of users) ins.run(u[0],u[1],pw,u[2],u[3],u[4],u[5]);
  ensureLicenses();   

  const si=db.prepare('INSERT INTO species(name,hunting_season) VALUES (?,?)');
  [
    ['Gímszarvas','szept. 1. – jan. 31.'],
    ['Őz','ápr. 15. – szept. 30. (bak)'],
    ['Vaddisznó','egész évben'],
    ['Dámszarvas','okt. 1. – febr. utolsó napja'],
    ['Muflon','egész évben'],
    ['Róka','egész évben']
  ].forEach(x=>si.run(...x));

  const ai=db.prepare('INSERT INTO hunting_areas(name,identifier,area_size,description) VALUES (?,?,?,?)');
  const areas=[
    ['Északi terület','E-01',1420,'Idős bükkös, meredek oldalakkal és két tisztással.',[1,2,3]],
    ['Délkeleti terület','DK-02',980,'Vegyes erdő szántók mentén, jó vaddisznó-állománnyal.',[3,2,6]],
    ['Völgyi rét','V-03',640,'Nyílt rétek, patakparti égerligetek.',[2,3,6]],
    ['Tölgyes-gerinc','T-04',1150,'Tölgyes gerinc, őszi bőgési időszak fő területe.',[1,4,3]]
  ];
  for(const a of areas){
    ai.run(a[0],a[1],a[2],a[3]);
    const id=db.prepare('SELECT last_insert_rowid() id').get().id;
    for(const s of a[4]) db.prepare('INSERT INTO area_species VALUES (?,?)').run(id,s);
  }

  
  const hi=db.prepare("INSERT INTO hunting_log(hunter_id,area_id,start_datetime,planned_end_datetime,end_datetime,purpose,status,kind,name,gamekeeper_id) VALUES (?,?,?,?,?,?,?,'Közös',?,?)");
  [
    ['Őszi gyakorlóvadászat','2026-10-17','06:00','12:00',1,2,[3,4,5]],
    ['Bőgési szemle','2026-09-19','05:30','10:00',4,2,[3,6,8]],
    ['Társasvadászat – vaddisznó','2026-08-29','07:00','14:00',2,2,[4,5,6,3]],
    ['Nyári őzbak-vadászat','2026-07-11','05:00','09:00',3,2,[5,8]]
  ].forEach(h=>{
    const past=h[1]<'2026-10-08';
    hi.run(h[5],h[4],`${h[1]}T${h[2]}`,`${h[1]}T${h[3]}`,past?`${h[1]}T${h[3]}`:null,h[0],past?'Lezárt':'Aktív',h[0],h[5]);
    const id=db.prepare('SELECT last_insert_rowid() id').get().id;
    for(const u of h[6])db.prepare('INSERT INTO log_participants VALUES (?,?)').run(id,u);
  });

  const gi=db.prepare('INSERT INTO game_records(hunter_id,species_id,area_id,log_id,date,time,gender,age_group,weight,trophy_data,description,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  gi.run(3,1,4,2,'2026-09-19','06:12','Hím','Felnőtt',182,'10 ágas, 7,4 kg','Tiszta lövés, a gerincen.','Elfogadva');
  gi.run(4,3,2,3,'2026-08-29','09:40','Hím','Felnőtt',96,'','','Elfogadva');
  gi.run(5,2,3,4,'2026-07-11','05:48','Hím','Felnőtt',21,'6 ágas, 340 g','','Elfogadva');
  gi.run(6,3,2,3,'2026-08-29','11:05','Nőstény','Fiatal',54,'','','Elfogadva');
  gi.run(3,6,3,null,'2026-10-02','17:30','Nőstény','Felnőtt',6,'','Esti lesen.','Ellenőrzésre vár');
  gi.run(8,1,4,2,'2026-09-19','07:20','Nőstény','Fiatal',74,'','','Módosításra visszaküldve');
  gi.run(4,5,3,null,'2026-10-04','08:15','Hím','Felnőtt',1,'','','Ellenőrzésre vár');

  const li=db.prepare('INSERT INTO hunting_log(hunter_id,area_id,start_datetime,planned_end_datetime,end_datetime,purpose,status) VALUES (?,?,?,?,?,?,?)');
  li.run(3,1,'2026-10-06T06:30','2026-10-06T11:00',null,'Vaddisznó-megfigyelés','Aktív');
  li.run(4,2,'2026-10-06T07:00','2026-10-06T12:00',null,'Les, vaddisznó','Aktív');
  li.run(8,4,'2026-10-04T16:00','2026-10-04T19:30','2026-10-04T19:10','Szarvas-szemle','Lezárt');

  const prices=[
    ['Gímszarvas bika','Csapos bika',240,0,null,null],
    ['Gímszarvas bika','Agancs 2,99 kg-ig',600,0,null,null],
    ['Gímszarvas bika','Agancs 3,00–3,99 kg',850,0,null,null],
    ['Gímszarvas bika','Agancs 4,00–4,99 kg',1100,0,null,null],
    ['Gímszarvas bika','Agancs 5,00–5,99 kg',1200,5,'10 g',null],
    ['Gímszarvas bika','Agancs 6,00–6,99 kg',1700,9,'10 g',null],
    ['Gímszarvas bika','Agancs 7,00–7,99 kg',2600,11,'10 g',null],
    ['Gímszarvas bika','Agancs 8,00–8,99 kg',3700,12,'10 g',null],
    ['Gímszarvas bika','Agancs 9,00–9,99 kg',4900,21,'10 g',null],
    ['Gímszarvas bika','Agancs 10,00–10,99 kg',7000,43,'10 g',null],
    ['Gímszarvas bika','Agancs 11 kg-tól',11300,55,'10 g',null],
    ['Gímszarvas bika','Sebzés (a becsült trófeasúly árának 50%-a, egyedi)',0,0,null,null],
    ['Gímszarvas tehén, ünő, borjú','Tehén vagy ünő – elejtés',150,0,null,null],
    ['Gímszarvas tehén, ünő, borjú','Tehén vagy ünő – sebzés',75,0,null,null],
    ['Gímszarvas tehén, ünő, borjú','Borjú – elejtés',110,0,null,null],
    ['Gímszarvas tehén, ünő, borjú','Borjú – sebzés',55,0,null,null],
    ['Őz','Bak – 150 g-ig',90,0,null,null],
    ['Őz','Bak – 151–249 g',170,0,null,null],
    ['Őz','Bak – 250–299 g',195,3.7,'g',null],
    ['Őz','Bak – 300–399 g',380,7.7,'g',null],
    ['Őz','Bak – 400–499 g',1150,19.5,'g',null],
    ['Őz','Bak – 500 g-tól',3100,30,'g',null],
    ['Őz','Suta vagy gida – elejtés',50,0,null,null],
    ['Őz','Suta vagy gida – sebzés',25,0,null,null],
    ['Dámszarvas','Bika – agancs 1,49 kg-ig',360,0,null,null],
    ['Dámszarvas','Bika – agancs 1,50–1,99 kg',480,0,null,null],
    ['Dámszarvas','Bika – agancs 2,00–2,49 kg',840,0,null,null],
    ['Dámszarvas','Bika – agancs 2,50–2,99 kg',960,9.6,'10 g',null],
    ['Dámszarvas','Bika – agancs 3,00–3,49 kg',1440,14.4,'10 g',null],
    ['Dámszarvas','Bika – agancs 3,50–3,99 kg',2160,28.8,'10 g',null],
    ['Dámszarvas','Bika – agancs 4,00 kg-tól',3600,60,'10 g',null],
    ['Dámszarvas','Tehén vagy ünő – elejtés',100,0,null,null],
    ['Dámszarvas','Tehén vagy ünő – sebzés',50,0,null,null],
    ['Dámszarvas','Borjú – elejtés',100,0,null,null],
    ['Dámszarvas','Borjú – sebzés',50,0,null,null],
    ['Muflon','Kos – szarvhossz 59,99 cm-ig',990,0,null,null],
    ['Muflon','Kos – 60,00–69,99 cm',1100,80,'cm',null],
    ['Muflon','Kos – 70,00–79,99 cm',1900,130,'cm',null],
    ['Muflon','Kos – 80,00–89,99 cm',3200,170,'cm',null],
    ['Muflon','Kos – 90,00 cm-től',4900,250,'cm',null],
    ['Muflon','Jerke vagy bárány – elejtés',120,0,null,null],
    ['Muflon','Jerke vagy bárány – sebzés',60,0,null,null],
    ['Vaddisznó (egyéni)','Kan – agyar 12 cm alatt',300,0,null,null],
    ['Vaddisznó (egyéni)','Kan – agyar 12,00–13,99 cm',320,9,'mm',null],
    ['Vaddisznó (egyéni)','Kan – agyar 14,00–15,99 cm',500,15,'mm',null],
    ['Vaddisznó (egyéni)','Kan – agyar 16,00–17,99 cm',800,17.5,'mm',null],
    ['Vaddisznó (egyéni)','Kan – agyar 18,00–19,99 cm',1150,27.5,'mm',null],
    ['Vaddisznó (egyéni)','Kan – agyar 20,00–21,99 cm',1700,32.5,'mm',null],
    ['Vaddisznó (egyéni)','Kan – agyar 22,00 cm-től',2350,55,'mm',null],
    ['Vaddisznó (egyéni)','Kan – sebzés (agyarmérettől függetlenül)',100,0,null,null],
    ['Vaddisznó (egyéni)','Koca – elejtés',260,0,null,null],
    ['Vaddisznó (egyéni)','Koca – sebzés',130,0,null,null],
    ['Vaddisznó (egyéni)','Süldő (20–50 kg) – elejtés',130,0,null,null],
    ['Vaddisznó (egyéni)','Süldő (20–50 kg) – sebzés',65,0,null,null],
    ['Vaddisznó (egyéni)','Malac (20 kg-ig) – elejtés',90,0,null,null],
    ['Vaddisznó (egyéni)','Malac (20 kg-ig) – sebzés',45,0,null,null],
    ['Vadkárelhárító vadászat','Koca – lődíj',190,0,null,null],
    ['Vadkárelhárító vadászat','Süldő – lődíj',70,0,null,null],
    ['Vadkárelhárító vadászat','Malac – lődíj',55,0,null,null],
    ['Vadkárelhárító vadászat','Gímszarvas ünő vagy borjú – lődíj',70,0,null,null],
    ['Szolgáltatások','Területi egyéni vezetés, szervezési díj (vadász/nap/terület)',20,0,null,null],
    ['Szolgáltatások','Terepjáró használat (km)',0,1.5,'km',null],
    ['Szolgáltatások','Trófea bírálati díj',30,0,null,null],
    ['Szolgáltatások','Nyúzás (vadanként)',30,0,null,null],
    ['Szolgáltatások','Vadbőr (vadanként)',50,0,null,null],
    ['Szolgáltatások','Vadhús – őz (kg)',0,5,'kg',null],
    ['Szolgáltatások','Vadhús – szarvas (kg)',0,3,'kg',null],
    ['Szolgáltatások','Vadhús – dám (kg)',0,3,'kg',null],
    ['Szolgáltatások','Vadhús – muflon (kg)',0,1.5,'kg',null],
    ['Társasági díjak','Éves tagdíj',null,0,'db',45000],
    ['Társasági díjak','Területhasználati díj',null,0,'db',12000]
  ];
  const pi=db.prepare('INSERT INTO price_list(category,name,price_eur,extra_eur,unit,price_huf_fixed,sort) VALUES (?,?,?,?,?,?,?)');
  prices.forEach((p,i)=>{
    const row=[...p];
    if(row[4]==null) row[4]='db';
    pi.run(...row,i);
  });
  syncPriceMeta();
  console.log(' Minden minta jelszó: Jelszo123!');

} else console.log('Az adatbázis már fel van töltve adatokkal');