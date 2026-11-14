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

} else console.log('Az adatbázis már tartalmaz adatokat.');