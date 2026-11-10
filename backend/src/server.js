import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {initDb} from './db/database.js';
import auth from './routes/auth.js';
import data from './routes/data.js';

initDb();



const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));

app.use(cors({origin:process.env.CORS_ORIGIN||'http://localhost:4200'}));
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use('/uploads',express.static(path.resolve(__dirname,'../uploads'),{maxAge:'7d',setHeaders:res=>res.setHeader('Cross-Origin-Resource-Policy','cross-origin')}));
app.get('/api/health',(req,res)=>res.json({ok:true,service:'vadasztarsasag-api'}));app.use('/api/auth',auth);
app.use('/api',data);app.use((err,req,res,next)=>{console.error(err);res.status(500).json({message:'Szerverhiba történt.'});});


const port=process.env.PORT||3000;app.listen(port,()=>console.log(`API: http://localhost:${port}/api`));
