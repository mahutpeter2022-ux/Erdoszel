import bcrypt from 'bcryptjs';
import { db, initDb, syncPriceMeta, ensureLicenses } from './database.js';

initDb();
const count = db.prepare('SELECT COUNT(*) c FROM users').get().c;

if (!count) {
  const pw = bcrypt.hashSync('Jelszo123!', 10);
  const ins = db.prepare('INSERT INTO users(name,email,password,role,phone,membership_date,status) VALUES (?,?,?,?,?,?,?)');
  const users = [
    ['Szabó Gábor','gabor@example.hu','admin','+36 30 111 2233','2011-03-14','Aktív'],
    ['Horváth László','laszlo@example.hu','vador','+36 20 222 3344','2014-09-01','Aktív'],
    ['Kovács Péter','peter@example.hu','vadasz','+36 30 333 4455','2018-05-20','Aktív'],
    ['Nagy Bence','bence@example.hu','vadasz','+36 70 444 5566','2019-02-11','Aktív'],
    ['Tóth Márk','mark@example.hu','vadasz','+36 30 555 6677','2020-10-03','Aktív'],
    ['Varga Eszter','eszter@example.hu','vadasz','+36 20 666 7788','2021-06-18','Aktív'],
    ['Kiss Dániel','daniel@example.hu','vadasz','+36 70 777 8899','2016-01-25','Inaktív'],
    ['Farkas Anna','anna@example.hu','vadasz','+36 30 888 9900','2023-04-09','Aktív']
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

} else console.log('Az adatbázis már tartalmaz adatokat.');